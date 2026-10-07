import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import type { DeliveryFailureClass } from 'src/infra/events/domain-event-delivery-policy';

export const DOMAIN_EVENT_PARKING_CATEGORIES = [
  'INVALID_ENVELOPE', 'UNSUPPORTED_VERSION', 'MISSING_REQUIRED_CONSUMER',
  'CONSUMER_RETRY_EXHAUSTED', 'CONSUMER_OUTCOME_UNCERTAIN', 'INBOX_IDENTITY_CONFLICT',
  'CONSUMER_RETRYABLE_FAILURE', 'HELD_EVENT_NOT_ELIGIBLE',
] as const;
export type DomainEventParkingCategory = (typeof DOMAIN_EVENT_PARKING_CATEGORIES)[number];
export const MAX_BUSINESS_DELIVERY_ATTEMPTS = 5;

@Injectable()
export class PrismaDomainEventParkingRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findByEvent(eventId: string) {
    return this.prisma.domainEventParking.findMany({ where: { eventId } });
  }

  async getOutboxEligibility(eventId: string, eventName: string): Promise<'eligible' | 'held' | null> {
    const row = await this.prisma.domainEventOutbox.findFirst({
      where: { eventId, eventName }, select: { eligibility: true },
    });
    return row?.eligibility === 'eligible' || row?.eligibility === 'held' ? row.eligibility : null;
  }

  async recordFailure(input: {
    eventId: string;
    eventName: string;
    consumerKey: string;
    failureClass: Exclude<DeliveryFailureClass, 'outage'>;
    errorCategory: DomainEventParkingCategory;
    businessAttempts: number;
  }): Promise<void> {
    if (!Number.isInteger(input.businessAttempts) || input.businessAttempts < 1 || input.businessAttempts > 100 ||
        !input.consumerKey.trim() || input.consumerKey.length > 120 ||
        !DOMAIN_EVENT_PARKING_CATEGORIES.includes(input.errorCategory)) {
      throw new Error('Invalid durable domain event parking evidence');
    }
    await this.prisma.$executeRaw(Prisma.sql`
      INSERT INTO domain_event_parking (
        id, event_id, consumer_key, event_name, failure_class, error_category,
        business_attempts, status, first_failed_at, last_failed_at
      )
      SELECT ${uuidv7()}::uuid, o.event_id, ${input.consumerKey}, ${input.eventName},
        ${input.failureClass}, ${input.errorCategory}, ${input.businessAttempts}, 'parked',
        clock_timestamp(), clock_timestamp()
      FROM domain_event_outbox AS o
      WHERE o.event_id = ${input.eventId}::uuid AND o.event_name = ${input.eventName}
        AND o.eligibility IN ('eligible', 'held')
      ON CONFLICT (event_id, consumer_key) DO UPDATE SET
        event_name = EXCLUDED.event_name,
        failure_class = EXCLUDED.failure_class,
        error_category = EXCLUDED.error_category,
        business_attempts = GREATEST(domain_event_parking.business_attempts, EXCLUDED.business_attempts),
        status = 'parked', last_failed_at = clock_timestamp(),
        replay_claim_token = NULL, replay_lease_until = NULL
    `);
  }

  async recordTransientFailure(input: { eventId: string; eventName: string; consumerKey: string }): Promise<{
    businessAttempts: number; attemptsInReplay: number; parked: boolean;
  }> {
    const rows = await this.prisma.$queryRaw<Array<{
      business_attempts: number; replay_attempt_baseline: number; status: string;
    }>>(Prisma.sql`
      INSERT INTO domain_event_parking (
        id, event_id, consumer_key, event_name, failure_class, error_category,
        business_attempts, replay_attempt_baseline, status, first_failed_at, last_failed_at
      )
      SELECT ${uuidv7()}::uuid, o.event_id, ${input.consumerKey}, ${input.eventName},
        'transient', 'CONSUMER_RETRYABLE_FAILURE', 1, 0, 'retrying', clock_timestamp(), clock_timestamp()
      FROM domain_event_outbox AS o
      WHERE o.event_id = ${input.eventId}::uuid AND o.event_name = ${input.eventName}
        AND o.eligibility IN ('eligible', 'held')
      ON CONFLICT (event_id, consumer_key) DO UPDATE SET
        event_name = EXCLUDED.event_name,
        failure_class = 'transient',
        error_category = CASE
          WHEN domain_event_parking.business_attempts + 1 - domain_event_parking.replay_attempt_baseline >= ${MAX_BUSINESS_DELIVERY_ATTEMPTS}
            THEN 'CONSUMER_RETRY_EXHAUSTED'
          ELSE 'CONSUMER_RETRYABLE_FAILURE'
        END,
        business_attempts = domain_event_parking.business_attempts + 1,
        status = CASE
          WHEN domain_event_parking.business_attempts + 1 - domain_event_parking.replay_attempt_baseline >= ${MAX_BUSINESS_DELIVERY_ATTEMPTS}
            THEN 'parked'
          ELSE 'retrying'
        END,
        last_failed_at = clock_timestamp()
      RETURNING business_attempts, replay_attempt_baseline, status
    `);
    const row = rows[0];
    if (!row) throw new Error('Durable event intent was not eligible for retry accounting');
    return {
      businessAttempts: row.business_attempts,
      attemptsInReplay: row.business_attempts - row.replay_attempt_baseline,
      parked: row.status === 'parked',
    };
  }

  async resolve(eventId: string): Promise<number> {
    return this.prisma.domainEventParking.updateMany({
      where: { eventId, status: { in: ['retrying', 'parked', 'replay_requested'] } },
      data: { status: 'resolved', replayClaimToken: null, replayLeaseUntil: null },
    }).then((result) => result.count);
  }
}
