import { DomainEventContractError } from 'src/common/events/domain-event.contracts';
import { MissingDomainEventHandlerError, MissingRequiredDomainEventConsumersError } from 'src/infra/events/domain-event-handler.registry';
import { ConflictingDomainEventReplayError } from 'src/infra/events/prisma-domain-event-inbox.repository';
import { NotificationDeliveryError } from 'src/modules/notifications/application/ports/notification-delivery-error';

export type DeliveryFailureClass = 'transient' | 'terminal' | 'ambiguous' | 'outage';
export type DeliveryFailureContext = 'consumer' | 'provider';
export const DOMAIN_EVENT_REDIS_OUTAGE_MESSAGE = 'Domain event queue Redis is unavailable';

export class DomainEventRedisOutageError extends Error {
  constructor(readonly safeCode: 'REDIS_OUTAGE' = 'REDIS_OUTAGE') {
    super(DOMAIN_EVENT_REDIS_OUTAGE_MESSAGE);
    this.name = 'DomainEventRedisOutageError';
  }
}

export function classifyDeliveryFailure(
  error: unknown,
  context: DeliveryFailureContext = 'provider',
): DeliveryFailureClass {
  if (error instanceof DomainEventContractError || error instanceof MissingDomainEventHandlerError ||
      error instanceof MissingRequiredDomainEventConsumersError || error instanceof ConflictingDomainEventReplayError) return 'terminal';
  if (error instanceof NotificationDeliveryError && error.deliveryOutcome === 'not_sent') return 'transient';
  if (error instanceof DomainEventRedisOutageError) return 'outage';
  return context === 'consumer' ? 'transient' : 'ambiguous';
}

export function shouldParkDelivery(failureClass: DeliveryFailureClass, businessAttempts: number): boolean {
  if (!Number.isInteger(businessAttempts) || businessAttempts < 0) throw new Error('Invalid delivery attempt count');
  if (failureClass === 'terminal' || failureClass === 'ambiguous') return true;
  if (failureClass === 'outage') return false;
  return businessAttempts >= 5;
}

export function deliveryRetryDelayMs(attempt: number, random: () => number = Math.random): number {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error('Invalid delivery attempt');
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample > 1) throw new Error('Invalid jitter sample');
  const exponential = Math.min(60_000, 2_000 * 2 ** Math.min(attempt - 1, 5));
  return Math.min(60_000, Math.round(exponential * (0.5 + sample)));
}
