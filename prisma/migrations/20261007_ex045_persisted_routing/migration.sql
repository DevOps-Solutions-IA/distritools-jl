ALTER TABLE "domain_event_outbox"
    DROP CONSTRAINT "outbox_eligibility";

ALTER TABLE "domain_event_outbox"
    ADD CONSTRAINT "outbox_eligibility"
    CHECK ("eligibility" IN ('held', 'eligible', 'cutover_pending'));

CREATE TABLE "domain_event_routing_decisions" (
    "event_id" UUID NOT NULL,
    "route" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "policy_version" TEXT NOT NULL,
    "decided_at" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT "domain_event_routing_decisions_pkey" PRIMARY KEY ("event_id"),
    CONSTRAINT "domain_event_routing_decisions_event_id_fkey"
      FOREIGN KEY ("event_id") REFERENCES "domain_event_outbox"("event_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "domain_event_routing_decisions_route_check"
      CHECK ("route" IN ('legacy_hold', 'durable')),
    CONSTRAINT "domain_event_routing_decisions_reason_check"
      CHECK ("reason" IN ('DEFAULT_LEGACY_HOLD', 'TEST_ONLY_DURABLE', 'REQUIRED_CONSUMER_GAP', 'NO_REQUIRED_CONSUMERS', 'REGISTERED_CONSUMER_MISSING', 'PRODUCER_MISSING')),
    CONSTRAINT "domain_event_routing_decisions_policy_version_check"
      CHECK ("policy_version" = 'ex045.v1')
);

CREATE INDEX "domain_event_routing_decisions_route_decided_at_idx"
    ON "domain_event_routing_decisions"("route", "decided_at");

CREATE FUNCTION prevent_domain_event_routing_decision_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'domain event routing decisions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "domain_event_routing_decisions_immutable"
    BEFORE UPDATE OR DELETE ON "domain_event_routing_decisions"
    FOR EACH ROW EXECUTE FUNCTION prevent_domain_event_routing_decision_mutation();
