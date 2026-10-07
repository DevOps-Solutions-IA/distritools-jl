-- DISPOSABLE TEST DATABASE ONLY. Production rollback preserves durable parking.
DO $$
BEGIN
    IF current_database() <> 'ex044_migration_test' THEN
        RAISE EXCEPTION 'Refusing test-only reverse outside ex044_migration_test';
    END IF;
    IF EXISTS (SELECT 1 FROM domain_event_parking WHERE error_category = 'HELD_EVENT_NOT_ELIGIBLE') THEN
        RAISE EXCEPTION 'Refusing reverse while held-delivery evidence exists';
    END IF;
END $$;

ALTER TABLE "domain_event_parking"
    DROP CONSTRAINT "domain_event_parking_error_category_check";

ALTER TABLE "domain_event_parking"
    ADD CONSTRAINT "domain_event_parking_error_category_check"
    CHECK ("error_category" IN ('INVALID_ENVELOPE', 'UNSUPPORTED_VERSION', 'MISSING_REQUIRED_CONSUMER', 'CONSUMER_RETRY_EXHAUSTED', 'CONSUMER_OUTCOME_UNCERTAIN', 'INBOX_IDENTITY_CONFLICT', 'CONSUMER_RETRYABLE_FAILURE'));
