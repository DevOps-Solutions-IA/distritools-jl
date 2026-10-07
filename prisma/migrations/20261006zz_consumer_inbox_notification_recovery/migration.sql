-- Additive EX-04.3 consumer receipts and fenced notification dispatch state.
CREATE TABLE "domain_event_inbox" (
  "id" UUID NOT NULL,
  "consumer_key" TEXT NOT NULL,
  "event_id" UUID NOT NULL,
  "envelope_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'completed',
  "progress_cursor" UUID,
  "progress_upper_bound" UUID,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "domain_event_inbox_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "domain_event_inbox_consumer_key_event_id_key"
  ON "domain_event_inbox"("consumer_key", "event_id");
CREATE INDEX "domain_event_inbox_created_at_idx" ON "domain_event_inbox"("created_at");

ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'sending';
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'uncertain';
ALTER TABLE "notifications"
  ADD COLUMN "dispatch_claim_token" UUID,
  ADD COLUMN "dispatch_lease_until" TIMESTAMP(3),
  ADD COLUMN "last_error_code" TEXT,
  ADD COLUMN "dispatch_eligible" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "notifications_dispatch_recovery_idx"
  ON "notifications"("dispatch_eligible", "status", "dispatch_lease_until", "created_at");

CREATE TABLE "notification_audit_intents" (
  "id" UUID NOT NULL PRIMARY KEY,
  "notification_id" UUID NOT NULL,
  "transition_key" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "after_data" JSONB NOT NULL,
  "recorded_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "notification_audit_intents_notification_id_transition_key_key"
  ON "notification_audit_intents"("notification_id", "transition_key");
CREATE INDEX "notification_audit_intents_recorded_at_created_at_idx"
  ON "notification_audit_intents"("recorded_at", "created_at");
