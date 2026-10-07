CREATE TABLE "domain_event_parking" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "consumer_key" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "failure_class" TEXT NOT NULL,
    "error_category" TEXT NOT NULL,
    "business_attempts" INTEGER NOT NULL DEFAULT 0,
    "replay_attempt_baseline" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'parked',
    "first_failed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_failed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "replay_count" INTEGER NOT NULL DEFAULT 0,
    "replay_claim_token" UUID,
    "replay_lease_until" TIMESTAMP(3),
    "last_replay_by_id" UUID,

    CONSTRAINT "domain_event_parking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "domain_event_parking_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "domain_event_outbox"("event_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "domain_event_parking_failure_class_check" CHECK ("failure_class" IN ('transient', 'terminal', 'ambiguous')),
    CONSTRAINT "domain_event_parking_error_category_check" CHECK ("error_category" IN ('INVALID_ENVELOPE', 'UNSUPPORTED_VERSION', 'MISSING_REQUIRED_CONSUMER', 'CONSUMER_RETRY_EXHAUSTED', 'CONSUMER_OUTCOME_UNCERTAIN', 'INBOX_IDENTITY_CONFLICT', 'CONSUMER_RETRYABLE_FAILURE')),
    CONSTRAINT "domain_event_parking_status_check" CHECK ("status" IN ('retrying', 'parked', 'replay_requested', 'resolved')),
    CONSTRAINT "domain_event_parking_attempts_check" CHECK ("business_attempts" >= 0 AND "replay_attempt_baseline" >= 0 AND "replay_attempt_baseline" <= "business_attempts" AND "replay_count" >= 0)
);

CREATE UNIQUE INDEX "domain_event_parking_event_id_consumer_key_key" ON "domain_event_parking"("event_id", "consumer_key");
CREATE INDEX "domain_event_parking_status_last_failed_at_idx" ON "domain_event_parking"("status", "last_failed_at");
CREATE INDEX "domain_event_parking_event_id_idx" ON "domain_event_parking"("event_id");
