import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DOMAIN_EVENT_CONTRACTS, validateDomainEvent } from 'src/common/events/domain-event.contracts';
import { PrismaDomainEventInboxRepository } from 'src/infra/events/prisma-domain-event-inbox.repository';
import { PrismaDomainEventOutboxRepository } from 'src/infra/events/prisma-domain-event-outbox.repository';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { assertDomainEventQueueMutationEnabled, assessDomainEventReplayEligibility, requiredConsumerKeys } from 'src/infra/events/domain-event-replay-policy';
import { PrismaDomainEventParkingRepository } from 'src/infra/events/prisma-domain-event-parking.repository';
import { DOMAIN_EVENT_REDIS_OUTAGE_MESSAGE } from 'src/infra/events/domain-event-delivery-policy';

const RECONCILE_JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2_000, jitter: 0.5 },
  removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
  removeOnFail: false,
};

@Injectable()
export class DomainEventQueueReconciler {
  constructor(
    @Inject(PrismaDomainEventOutboxRepository)
    private readonly outbox: PrismaDomainEventOutboxRepository,
    @Inject(PrismaDomainEventInboxRepository)
    private readonly inbox: PrismaDomainEventInboxRepository,
    @Inject(DomainEventHandlerRegistry)
    private readonly registry: DomainEventHandlerRegistry,
    @InjectQueue('domain-events')
    private readonly queue: Queue,
    @Inject(PrismaDomainEventParkingRepository)
    private readonly parking: PrismaDomainEventParkingRepository,
  ) {}

  async reconcile(limit = 25, after?: { createdAt: Date; eventId: string }): Promise<{
    examined: number; enqueued: number; retained: number; completed: number; blocked: number; parked: number; failed: number;
    nextCursor: string | null;
  }> {
    assertDomainEventQueueMutationEnabled();
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('Invalid event reconciliation limit');
    const rows = await this.outbox.listEnqueuedForReconciliation(limit, after);
    const result = { examined: rows.length, enqueued: 0, retained: 0, completed: 0, blocked: 0, parked: 0, failed: 0 };
    for (const row of rows) {
      let event: ReturnType<typeof validateDomainEvent>;
      try {
        event = validateDomainEvent({
          eventId: row.eventId, eventName: row.eventName, eventVersion: row.eventVersion,
          payload: row.payload, occurredAt: row.occurredAt.toISOString(), correlationId: row.correlationId ?? undefined,
        }, { requireEventId: true });
      } catch (error) {
        result.blocked += 1;
        if (error && typeof error === 'object' && 'code' in error) {
          const category = (error as { code?: string }).code === 'UNSUPPORTED_VERSION' ? 'UNSUPPORTED_VERSION' : 'INVALID_ENVELOPE';
          await this.parking.recordFailure({
            eventId: row.eventId, eventName: row.eventName, consumerKey: 'domain-event-routing.v1',
            failureClass: 'terminal', errorCategory: category, businessAttempts: 1,
          });
          result.parked += 1;
        }
        continue;
      }
      const contract = DOMAIN_EVENT_CONTRACTS[event.eventName];
      const registeredConsumers = this.registry.consumerKeys(event.eventName);
      const requiredKeys = requiredConsumerKeys(contract.inMemoryConsumers);
      const completedConsumers = await this.inbox.completedConsumerKeys(event.eventId!, requiredKeys);
      const eligibility = assessDomainEventReplayEligibility({
        eligibility: 'eligible', disposition: contract.disposition,
        requiredConsumers: contract.inMemoryConsumers, registeredConsumers, completedConsumers,
      });
      if (!eligibility.eligible) {
        if (eligibility.reason === 'CONSUMERS_ALREADY_COMPLETED') result.completed += 1;
        else result.blocked += 1;
        continue;
      }

      try {
        const job = await this.queue.getJob(event.eventId!);
        const parking = await this.parking.findByEvent(event.eventId!);
        const parked = parking.some((delivery) => delivery.status === 'parked');
        const replayRequested = parking.find((delivery) => delivery.status === 'replay_requested');
        const replayLeaseActive = parking.some((delivery) => delivery.replayClaimToken !== null &&
          delivery.replayLeaseUntil !== null && delivery.replayLeaseUntil.getTime() > Date.now());
        if (replayLeaseActive) {
          result.retained += 1;
          continue;
        }
        if (job) {
          const jobState = await job.getState();
          if (jobState === 'failed' && parked) {
            result.retained += 1;
            continue;
          }
          if (['waiting', 'active', 'delayed', 'waiting-children', 'paused', 'prioritized'].includes(jobState)) {
            result.retained += 1;
            continue;
          }
          if (jobState === 'completed') {
            if (parked) {
              result.retained += 1;
              continue;
            }
            // A prior explicit replay may have lost its Redis job after acceptance.
            // PostgreSQL already proved a required consumer receipt is still missing.
            await job.remove();
          } else if (jobState === 'failed') {
            const failedReason = job.failedReason ?? '';
            const retrying = parking.some((delivery) => delivery.status === 'retrying');
            if (!parked && !retrying && failedReason !== DOMAIN_EVENT_REDIS_OUTAGE_MESSAGE) {
              await this.parking.recordFailure({
                eventId: event.eventId!, eventName: event.eventName, consumerKey: 'domain-event-routing.v1',
                failureClass: 'ambiguous', errorCategory: 'CONSUMER_OUTCOME_UNCERTAIN',
                businessAttempts: Math.min(100, Math.max(1, job.attemptsMade)),
              });
              result.parked += 1;
              result.retained += 1;
              continue;
            }
            // PG retry evidence is authoritative. A broker-only outage failure is
            // reconstructible; a business failure without PG evidence is parked.
            await job.remove();
          }
        } else if (parked || (replayRequested?.replayClaimToken && replayRequested.replayLeaseUntil?.getTime()! > Date.now())) {
          result.retained += 1;
          continue;
        }
        if (await this.queue.getJob(event.eventId!)) {
          result.retained += 1;
          continue;
        }
        await this.queue.add(event.eventName, event, { jobId: event.eventId!, ...RECONCILE_JOB_OPTIONS });
        result.enqueued += 1;
      } catch {
        result.failed += 1;
      }
    }
    const last = rows.at(-1);
    return {
      ...result,
      nextCursor: rows.length === limit && last ? `${last.createdAt.toISOString()}|${last.eventId}` : null,
    };
  }
}
