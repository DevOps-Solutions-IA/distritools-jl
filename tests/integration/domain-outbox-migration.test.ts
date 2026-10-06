import { it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

it('forwards, rolls back and forwards the additive outbox migration on a disposable database', () => {
  assert.equal(process.env.CI, 'true', 'CI-owned disposable test services required');
  assert.equal(process.env.NODE_ENV, 'test');
  const url = new URL(process.env.EX042_MIGRATION_TEST_DATABASE_URL ?? 'missing://target');
  assert.ok(['postgresql:', 'postgres:'].includes(url.protocol), 'explicit disposable database URL required');
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.ok(!['55440', '56379'].includes(url.port), 'Shared developer services are forbidden');
  assert.equal(url.pathname, '/ex042_migration_test', 'dedicated disposable migration database required');
  // Do not inherit PGHOSTADDR, PGSERVICE or PGOPTIONS that could redirect this disposable target.
  const env = { PATH: process.env.PATH, PGHOST: url.hostname.replace(/^\[|\]$/g, ''), PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: 'ex042_migration_test' };
  const sql = (args: string[]) => execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', ...args], { env, encoding: 'utf8' }).trim();
  const directory = path.resolve('prisma/migrations/20261006_durable_domain_event_outbox');
  assert.equal(sql(['-Atc', "SELECT to_regclass('public.domain_event_outbox') IS NULL"]), 't', 'database must start empty');
  sql(['-f', path.join(directory, 'migration.sql')]);
  assert.equal(sql(['-Atc', 'SELECT count(*) FROM domain_event_outbox']), '0');
  sql(['-f', path.join(directory, 'rollback.test-only.sql')]);
  assert.equal(sql(['-Atc', "SELECT to_regclass('public.domain_event_outbox') IS NULL"]), 't');
  sql(['-f', path.join(directory, 'migration.sql')]);
  assert.equal(sql(['-Atc', 'SELECT count(*) FROM domain_event_outbox']), '0');
});
