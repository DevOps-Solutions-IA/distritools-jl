DO $$
BEGIN
  IF current_database() <> 'ex051_migration_test' THEN
    RAISE EXCEPTION 'test-only reverse refused outside ex051_migration_test';
  END IF;
  IF EXISTS (SELECT 1 FROM auth_two_factor_challenges) THEN
    RAISE EXCEPTION 'test-only reverse refused with persisted challenge evidence';
  END IF;
END $$;

DROP TABLE auth_two_factor_challenges;
