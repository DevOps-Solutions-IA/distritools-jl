import { validateDomainEvent, DomainEventContractError } from 'src/common/events/domain-event.contracts';
import type { OutboxRelayRepository } from 'src/common/events/domain-event-outbox.port';
import type { DomainEventPublisher } from 'src/common/events/domain-event.publisher';
import { DomainEventEnqueueOutcomeUnknownError } from 'src/infra/events/bullmq-domain-event.publisher';

// No Nest registration, timer, endpoint or CLI. EX-04.3 owns activation and historical reconciliation.
export class DomainEventOutboxRelay {
  private circuitUntil = 0;
  private outageCount = 0;

  constructor(private readonly repository: OutboxRelayRepository, private readonly publisher: DomainEventPublisher) {}

  async runIsolatedBatch(options: { batchSize?: number; leaseMs?: number } = {}) {
    if (process.env.NODE_ENV !== 'test' || process.env.APP_ENV !== 'test') {
      throw new Error('OUTBOX_RELAY_DISABLED: isolated test execution only');
    }
    if (Date.now() < this.circuitUntil) return { claimed: 0, enqueued: 0, failed: 0, lostClaims: 0 };
    const claims = await this.repository.claimEligible(options.batchSize ?? 20, options.leaseMs ?? 30000);
    const result = { claimed: claims.length, enqueued: 0, failed: 0, lostClaims: 0 };
    for (const claim of claims) {
      if (this.circuitUntil > Date.now()) {
        const delay = Math.max(1000, Math.min(60000, this.circuitUntil - Date.now()));
        if (await this.repository.defer(claim.eventId, claim.claimToken, 'REDIS_OUTAGE', delay)) result.failed++;
        else result.lostClaims++;
        continue;
      }
      try {
        const event = validateDomainEvent(claim.event, { requireEventId: true });
        if (event.eventId !== claim.eventId) throw new DomainEventContractError('INVALID_ENVELOPE', 'eventId mismatch');
        await this.publisher.publish(event);
      } catch (error) {
        if (error instanceof DomainEventContractError && this.repository.parkTerminal) {
          const category = error.code === 'UNSUPPORTED_VERSION' ? 'UNSUPPORTED_VERSION' : 'INVALID_ENVELOPE';
          if (await this.repository.parkTerminal(claim.eventId, claim.claimToken, category)) result.failed++;
          else result.lostClaims++;
          continue;
        }
        const outage = error instanceof DomainEventEnqueueOutcomeUnknownError;
        if (outage) this.openCircuit();
        const safeCode = outage ? 'REDIS_OUTAGE' : error instanceof DomainEventContractError ? 'INVALID_ENVELOPE' : 'ENQUEUE_FAILED';
        const delay = outage
          ? Math.min(60000, Math.max(1000, this.circuitUntil - Date.now()))
          : Math.min(60000, 1000 * 2 ** Math.min(claim.attempts - 1, 6));
        if (await this.repository.defer(claim.eventId, claim.claimToken, safeCode, delay)) result.failed++;
        else result.lostClaims++;
        continue;
      }
      this.outageCount = 0;
      // A crash/DB error here retains the lease; its eventual expiry recovers the same event ID.
      if (await this.repository.markEnqueued(claim.eventId, claim.claimToken)) result.enqueued++;
      else result.lostClaims++;
    }
    return result;
  }

  private openCircuit(): void {
    this.outageCount += 1;
    const delay = Math.min(60_000, 5_000 * 2 ** Math.min(this.outageCount - 1, 4));
    this.circuitUntil = Date.now() + delay;
  }
}
