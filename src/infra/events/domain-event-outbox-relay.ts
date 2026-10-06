import { validateDomainEvent, DomainEventContractError } from 'src/common/events/domain-event.contracts';
import type { OutboxRelayRepository } from 'src/common/events/domain-event-outbox.port';
import type { DomainEventPublisher } from 'src/common/events/domain-event.publisher';

// No Nest registration, timer, endpoint or CLI. EX-04.3 owns activation and historical reconciliation.
export class DomainEventOutboxRelay {
  constructor(private readonly repository: OutboxRelayRepository, private readonly publisher: DomainEventPublisher) {}

  async runIsolatedBatch(options: { batchSize?: number; leaseMs?: number } = {}) {
    if (process.env.NODE_ENV !== 'test' || process.env.APP_ENV !== 'test') {
      throw new Error('OUTBOX_RELAY_DISABLED: isolated test execution only');
    }
    const claims = await this.repository.claimEligible(options.batchSize ?? 20, options.leaseMs ?? 30000);
    const result = { claimed: claims.length, enqueued: 0, failed: 0, lostClaims: 0 };
    for (const claim of claims) {
      try {
        const event = validateDomainEvent(claim.event, { requireEventId: true });
        if (event.eventId !== claim.eventId) throw new DomainEventContractError('INVALID_ENVELOPE', 'eventId mismatch');
        await this.publisher.publish(event);
      } catch (error) {
        const safeCode = error instanceof DomainEventContractError ? 'INVALID_ENVELOPE' : 'ENQUEUE_FAILED';
        const delay = Math.min(60000, 1000 * 2 ** Math.min(claim.attempts - 1, 6));
        if (await this.repository.defer(claim.eventId, claim.claimToken, safeCode, delay)) result.failed++;
        else result.lostClaims++;
        continue;
      }
      // A crash/DB error here retains the lease; its eventual expiry recovers the same event ID.
      if (await this.repository.markEnqueued(claim.eventId, claim.claimToken)) result.enqueued++;
      else result.lostClaims++;
    }
    return result;
  }
}
