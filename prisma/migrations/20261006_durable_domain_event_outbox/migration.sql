CREATE TABLE "domain_event_outbox" (
    "event_id" UUID NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_version" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "correlation_id" TEXT,
    "eligibility" TEXT NOT NULL DEFAULT 'held',
    "hold_reason" TEXT DEFAULT 'legacy_delivery_requires_reconciliation',
    "state" TEXT NOT NULL DEFAULT 'pending',
    "claim_token" UUID,
    "lease_until" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enqueued_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "domain_event_outbox_pkey" PRIMARY KEY ("event_id"),
    CONSTRAINT "outbox_eligibility" CHECK ("eligibility" IN ('held', 'eligible')),
    CONSTRAINT "outbox_state" CHECK ("state" IN ('pending', 'claimed', 'enqueued')),
    CONSTRAINT "outbox_attempts" CHECK ("attempts" >= 0),
    CONSTRAINT "outbox_held" CHECK ("eligibility" <> 'held' OR
        ("state" = 'pending' AND "hold_reason" IS NOT NULL AND "claim_token" IS NULL
         AND "lease_until" IS NULL AND "enqueued_at" IS NULL)),
    CONSTRAINT "outbox_claim" CHECK (
        ("state" = 'claimed' AND "claim_token" IS NOT NULL AND "lease_until" IS NOT NULL) OR
        ("state" <> 'claimed' AND "claim_token" IS NULL AND "lease_until" IS NULL)),
    CONSTRAINT "outbox_enqueued" CHECK (("state" = 'enqueued') = ("enqueued_at" IS NOT NULL))
);
CREATE INDEX "domain_event_outbox_eligibility_state_next_attempt_at_lease_idx"
    ON "domain_event_outbox" ("eligibility", "state", "next_attempt_at", "lease_until");
CREATE INDEX "domain_event_outbox_eligibility_created_at_idx"
    ON "domain_event_outbox" ("eligibility", "created_at");
