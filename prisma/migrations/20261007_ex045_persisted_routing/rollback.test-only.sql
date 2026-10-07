DO $$
BEGIN
  IF current_database() <> 'ex045_migration_test' THEN
    RAISE EXCEPTION 'EX-04.5 test-only rollback refused outside ex045_migration_test';
  END IF;
  IF EXISTS (SELECT 1 FROM domain_event_routing_decisions) THEN
    RAISE EXCEPTION 'EX-04.5 test-only rollback refused while routing history exists';
  END IF;
END $$;

DROP TABLE "domain_event_routing_decisions";
DROP FUNCTION prevent_domain_event_routing_decision_mutation();

ALTER TABLE "domain_event_outbox"
    DROP CONSTRAINT "outbox_eligibility";

ALTER TABLE "domain_event_outbox"
    ADD CONSTRAINT "outbox_eligibility"
    CHECK ("eligibility" IN ('held', 'eligible'));
