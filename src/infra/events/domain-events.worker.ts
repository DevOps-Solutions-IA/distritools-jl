import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, UnrecoverableError } from 'bullmq';
import { DomainEventContractError, validateDomainEvent } from 'src/common/events/domain-event.contracts';
import { domainEventFailureConsumer, DomainEventHandlerRegistry, MissingDomainEventHandlerError, MissingRequiredDomainEventConsumersError } from 'src/infra/events/domain-event-handler.registry';
import { ConflictingDomainEventReplayError } from 'src/infra/events/prisma-domain-event-inbox.repository';
import { classifyDeliveryFailure, DomainEventRedisOutageError } from 'src/infra/events/domain-event-delivery-policy';
import { PrismaDomainEventParkingRepository } from 'src/infra/events/prisma-domain-event-parking.repository';
import { boundedWorkerShutdown } from 'src/infra/queue/bounded-worker-shutdown';

@Processor({ name: 'domain-events', configKey: 'domainWorker' })
@Injectable()
export class DomainEventsWorker extends WorkerHost implements OnApplicationShutdown {
  private readonly logger = new Logger(DomainEventsWorker.name);

  constructor(
    @Inject(DomainEventHandlerRegistry)
    private readonly handlerRegistry: DomainEventHandlerRegistry,
    @Inject(PrismaDomainEventParkingRepository)
    private readonly parking: PrismaDomainEventParkingRepository,
  ) {
    super();
  }

  async process(job: Job<unknown>): Promise<void> {
    let event: ReturnType<typeof validateDomainEvent>;
    try {
      event = validateDomainEvent(job.data, { requireEventId: true });
    } catch (error) {
      const identity = safeEnvelopeIdentity(job.data);
      if (identity) {
        await this.parking.recordFailure({
          ...identity,
          consumerKey: 'domain-event-routing.v1',
          failureClass: 'terminal',
          errorCategory: error instanceof DomainEventContractError && error.code === 'UNSUPPORTED_VERSION'
            ? 'UNSUPPORTED_VERSION' : 'INVALID_ENVELOPE',
          businessAttempts: 1,
        });
      }
      throw new UnrecoverableError('Domain event envelope is terminally invalid');
    }

    const eligibility = await this.parking.getOutboxEligibility(event.eventId!, event.eventName);
    if (eligibility === 'held') {
      await this.parking.recordFailure({
        eventId: event.eventId!, eventName: event.eventName, consumerKey: 'domain-event-routing.v1',
        failureClass: 'terminal', errorCategory: 'HELD_EVENT_NOT_ELIGIBLE', businessAttempts: 1,
      });
      throw new UnrecoverableError('Held domain event is not eligible for delivery');
    }
    if (eligibility !== 'eligible') {
      throw new UnrecoverableError('Domain event has no matching durable outbox intent');
    }

    try {
      await this.handlerRegistry.dispatch(event);
      await this.parking.resolve(event.eventId!);
    } catch (error) {
      const redisStatus = await this.workerRedisStatus();
      const failureClass = redisStatus && redisStatus !== 'ready'
        ? 'outage'
        : classifyDeliveryFailure(error, 'consumer');
      if (failureClass === 'outage') {
        this.logger.warn(JSON.stringify({ eventId: event.eventId, category: 'REDIS_OUTAGE', action: 'retry_without_parking' }));
        throw error instanceof DomainEventRedisOutageError ? error : new DomainEventRedisOutageError();
      }

      if (failureClass === 'transient') {
        const failureConsumer = domainEventFailureConsumer(error);
        const consumerKey = failureConsumer?.consumerKey ?? 'domain-event-routing.v1';
        const delivery = await this.parking.recordTransientFailure({
          eventId: event.eventId!, eventName: event.eventName, consumerKey,
        });
        if (delivery.parked) {
          throw new UnrecoverableError('Domain event delivery parked after bounded business retries');
        }
        throw error;
      }
      if (failureClass === 'terminal' || failureClass === 'ambiguous') {
        const failureConsumer = domainEventFailureConsumer(error);
        const consumerKey = failureConsumer
          ? failureConsumer.consumerKey
          : error instanceof MissingDomainEventHandlerError || error instanceof MissingRequiredDomainEventConsumersError
            ? error.consumerKey : 'domain-event-routing.v1';
        const errorCategory = failureClass === 'ambiguous'
          ? 'CONSUMER_OUTCOME_UNCERTAIN'
          : error instanceof ConflictingDomainEventReplayError
            ? 'INBOX_IDENTITY_CONFLICT'
          : error instanceof DomainEventContractError && error.code === 'UNSUPPORTED_VERSION'
            ? 'UNSUPPORTED_VERSION'
            : error instanceof MissingDomainEventHandlerError || error instanceof MissingRequiredDomainEventConsumersError ? 'MISSING_REQUIRED_CONSUMER'
              : error instanceof DomainEventContractError ? 'INVALID_ENVELOPE'
                : 'CONSUMER_RETRY_EXHAUSTED';
        await this.parking.recordFailure({
          eventId: event.eventId!, eventName: event.eventName, consumerKey,
          failureClass, errorCategory, businessAttempts: 1,
        });
      }
      if (failureClass === 'terminal' || failureClass === 'ambiguous') {
        throw new UnrecoverableError('Domain event delivery parked for operator review');
      }
      throw error;
    }
  }

  async onApplicationShutdown(): Promise<void> {
    const result = await boundedWorkerShutdown(this.worker);
    if (!result.drained) {
      this.logger.warn(JSON.stringify({ category: 'WORKER_SHUTDOWN_DEADLINE', action: 'leave_delivery_recoverable' }));
    }
  }

  private async workerRedisStatus(): Promise<string | undefined> {
    try {
      const worker = this.worker as unknown as { client?: Promise<{ status?: string }> | { status?: string } };
      const client = await worker.client;
      return client?.status;
    } catch {
      return undefined;
    }
  }
}

function safeEnvelopeIdentity(input: unknown): { eventId: string; eventName: string } | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (typeof value.eventId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.eventId) ||
      typeof value.eventName !== 'string' || value.eventName.length > 120) return null;
  return { eventId: value.eventId, eventName: value.eventName };
}
