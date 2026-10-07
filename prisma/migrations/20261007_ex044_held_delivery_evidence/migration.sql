ALTER TABLE "domain_event_parking"
    DROP CONSTRAINT "domain_event_parking_error_category_check";

ALTER TABLE "domain_event_parking"
    ADD CONSTRAINT "domain_event_parking_error_category_check"
    CHECK ("error_category" IN ('INVALID_ENVELOPE', 'UNSUPPORTED_VERSION', 'MISSING_REQUIRED_CONSUMER', 'CONSUMER_RETRY_EXHAUSTED', 'CONSUMER_OUTCOME_UNCERTAIN', 'INBOX_IDENTITY_CONFLICT', 'CONSUMER_RETRYABLE_FAILURE', 'HELD_EVENT_NOT_ELIGIBLE'));
