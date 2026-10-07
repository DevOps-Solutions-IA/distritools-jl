-- DISPOSABLE TEST DATABASE ONLY. Production rollback preserves durable parking.
DO $$
BEGIN
    IF current_database() <> 'ex044_migration_test' THEN
        RAISE EXCEPTION 'Refusing test-only reverse outside ex044_migration_test';
    END IF;
    IF EXISTS (SELECT 1 FROM domain_event_parking) THEN
        RAISE EXCEPTION 'Refusing reverse with durable parking history';
    END IF;
END $$;

DROP TABLE domain_event_parking;
