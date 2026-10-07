import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { DOMAIN_EVENT_CONTRACTS, validateDomainEvent } from 'src/common/events/domain-event.contracts';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import type { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { assertDomainEventQueueMutationEnabled, assessDomainEventReplayEligibility, requiredConsumerKeys } from 'src/infra/events/domain-event-replay-policy';
import { DOMAIN_EVENTS_QUEUE } from 'src/infra/queue/bullmq.module';

const REPLAY_LEASE_MS = 30_000;
const JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2_000, jitter: 0.5 },
  removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10_000 },
  removeOnFail: false,
};

@Injectable()
export class DomainEventReplayService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DomainEventHandlerRegistry) private readonly registry: DomainEventHandlerRegistry,
    @InjectQueue(DOMAIN_EVENTS_QUEUE) private readonly queue: Queue,
  ) {}

  async preview(actor: CurrentUser, eventId: string, consumerKey: string) {
    assertHasPermissions(actor.permissions, ['domain_events.replay']);
    const item = await this.load(eventId, consumerKey);
    const assessment = await this.assess(item);
    const job = await this.queue.getJob(eventId);
    const jobState = job ? await job.getState() : 'missing';
    const replayLeaseActive = item.parking.replayClaimToken !== null &&
      item.parking.replayLeaseUntil !== null && item.parking.replayLeaseUntil.getTime() > Date.now();
    const replayableQueueState = ['missing', 'failed', 'completed'].includes(jobState);
    const replayableState = assessment.eligible && !replayLeaseActive && (item.parking.status === 'parked' ||
      (item.parking.status === 'replay_requested' && !replayLeaseActive && replayableQueueState));
    return {
      eventId,
      consumerKey,
      status: item.parking.status,
      eligible: assessment.eligible && replayableState,
      reason: replayableState && item.parking.status === 'replay_requested'
        ? 'REPLAY_RECOVERABLE_AFTER_QUEUE_LOSS'
        : item.parking.status === 'replay_requested' ? 'REPLAY_ALREADY_ACCEPTED' : assessment.reason,
      queueJob: jobState,
      identityStable: true,
      dryRun: true,
    };
  }

  async replay(actor: CurrentUser, eventId: string, consumerKey: string) {
    assertHasPermissions(actor.permissions, ['domain_events.replay']);
    assertDomainEventQueueMutationEnabled();
    const item = await this.load(eventId, consumerKey);
    const assessment = await this.assess(item);
    if (!assessment.eligible) throw new ConflictException(`Replay blocked: ${assessment.reason}`);
    const existingJob = await this.queue.getJob(eventId);
    const existingState = existingJob ? await existingJob.getState() : 'missing';
    const replayLeaseActive = item.parking.replayClaimToken !== null && item.parking.replayLeaseUntil !== null &&
      item.parking.replayLeaseUntil.getTime() > Date.now();
    if (replayLeaseActive) throw new ConflictException('Replay is already accepted or in progress');
    if (item.parking.status === 'replay_requested') {
      if (!['missing', 'failed', 'completed'].includes(existingState)) {
        throw new ConflictException('Replay is already accepted or in progress');
      }
    }

    const replayToken = uuidv7();
    const claimed = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.$executeRaw(Prisma.sql`
        UPDATE domain_event_parking SET replay_claim_token = ${replayToken}::uuid,
          replay_lease_until = clock_timestamp() + ${REPLAY_LEASE_MS} * interval '1 millisecond',
          replay_count = replay_count + 1, replay_attempt_baseline = business_attempts,
          last_replay_by_id = ${actor.sub}::uuid
        WHERE event_id = ${eventId}::uuid AND consumer_key = ${consumerKey}
          AND status IN ('parked', 'replay_requested')
          AND (replay_claim_token IS NULL OR replay_lease_until <= clock_timestamp())
      `);
      if (changed !== 1) return false;
      await tx.domainEventParking.updateMany({
        where: { eventId, consumerKey, replayClaimToken: replayToken },
        data: { status: 'replay_requested' },
      });
      await tx.auditLog.create({ data: {
        id: uuidv7(), actorUserId: actor.sub, action: 'domain_event.replay_requested',
        entityType: 'domain_event_delivery', entityId: eventId,
        afterData: { consumerKey, stableEventId: eventId, dryRun: false },
      } });
      return true;
    });
    if (!claimed) throw new ConflictException('Replay is already in progress');

    let queueAction: 'added' | 'retried' | 'recreated';
    if (!existingJob) {
      await this.queue.add(item.event.eventName, item.event, { jobId: eventId, ...JOB_OPTIONS });
      queueAction = 'added';
    } else {
      if (existingState === 'failed') {
        await existingJob.retry('failed');
        queueAction = 'retried';
      } else if (existingState === 'completed') {
        // PostgreSQL receipts were checked above; a completed Redis job is not completion evidence.
        await existingJob.remove();
        await this.queue.add(item.event.eventName, item.event, { jobId: eventId, ...JOB_OPTIONS });
        queueAction = 'recreated';
      } else {
        throw new ConflictException(`Queue job is already ${existingState}`);
      }
    }
    const current = await this.prisma.domainEventParking.findUnique({ where: { eventId_consumerKey: { eventId, consumerKey } } });
    if (current?.status === 'resolved') {
      return { eventId, consumerKey, queueAction, identityStable: true, acceptedByQueue: true, completed: true };
    }
    if (current?.status !== 'replay_requested' || current.replayClaimToken !== replayToken) {
      throw new ConflictException('Replay lease expired before durable acceptance was recorded');
    }
    return { eventId, consumerKey, queueAction, identityStable: true, acceptedByQueue: true };
  }

  private async load(eventId: string, consumerKey: string) {
    const parking = await this.prisma.domainEventParking.findUnique({
      where: { eventId_consumerKey: { eventId, consumerKey } },
    });
    if (!parking || !['parked', 'replay_requested'].includes(parking.status)) throw new NotFoundException('Parked delivery not found');
    const outbox = await this.prisma.domainEventOutbox.findUnique({
      where: { eventId }, include: { routingDecision: { select: { route: true } } },
    });
    if (!outbox) throw new NotFoundException('Durable event intent not found');
    let event: ReturnType<typeof validateDomainEvent>;
    try {
      event = validateDomainEvent({
        eventId: outbox.eventId, eventName: outbox.eventName, eventVersion: outbox.eventVersion,
        payload: outbox.payload, occurredAt: outbox.occurredAt.toISOString(), correlationId: outbox.correlationId ?? undefined,
      }, { requireEventId: true });
    } catch {
      throw new ConflictException('Stored event envelope is not replayable');
    }
    return { parking, outbox, event };
  }

  private async assess(item: Awaited<ReturnType<DomainEventReplayService['load']>>) {
    const contract = DOMAIN_EVENT_CONTRACTS[item.event.eventName];
    const requiredKeys = requiredConsumerKeys(contract.inMemoryConsumers);
    const completed = await this.prisma.domainEventInbox.findMany({
      where: { eventId: item.event.eventId!, consumerKey: { in: requiredKeys }, status: 'completed' },
      select: { consumerKey: true },
    });
    return assessDomainEventReplayEligibility({
      eligibility: item.outbox.routingDecision?.route === 'durable' ? item.outbox.eligibility : 'held',
      disposition: contract.disposition,
      requiredConsumers: contract.inMemoryConsumers,
      registeredConsumers: this.registry.consumerKeys(item.event.eventName),
      completedConsumers: completed.map((receipt) => receipt.consumerKey),
    });
  }
}
