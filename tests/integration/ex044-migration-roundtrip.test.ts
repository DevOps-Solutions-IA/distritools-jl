import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { it } from 'node:test';

it('EX-04.4 parking migration forwards, refuses populated reverse, then test-reverses and forwards', () => {
  assert.equal(process.env.EX044_MIGRATION_ROUNDTRIP, 'true', 'explicit disposable migration opt-in required');
  assert.equal(process.env.CI, 'true');
  assert.equal(process.env.APP_ENV, 'test');
  assert.equal(process.env.NODE_ENV, 'test');
  const url = new URL(process.env.EX044_MIGRATION_TEST_DATABASE_URL ?? 'missing://target');
  assert.ok(['postgresql:', 'postgres:'].includes(url.protocol));
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.ok(!['55440', '56379'].includes(url.port));
  assert.equal(url.pathname, '/ex044_migration_test');

  const env = {
    PATH: process.env.PATH,
    PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: 'ex044_migration_test',
  };
  const sql = (args: string[]) => execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', ...args], { env, encoding: 'utf8' }).trim();
  const root = path.resolve('prisma/migrations');
  const outboxMigration = path.join(root, '20261006_durable_domain_event_outbox', 'migration.sql');
  const directory = path.join(root, '20261007_ex044_durable_delivery_parking');
  const heldEvidenceMigration = path.join(root, '20261007_ex044_held_delivery_evidence');
  assert.equal(sql(['-Atc', "SELECT to_regclass('public.domain_event_outbox') IS NULL AND to_regclass('public.domain_event_parking') IS NULL"]), 't');

  sql(['-f', outboxMigration]);
  sql(['-f', path.join(directory, 'migration.sql')]);
  sql(['-f', path.join(heldEvidenceMigration, 'migration.sql')]);
  assert.equal(sql(['-Atc', "SELECT count(*) FROM domain_event_parking"]), '0');
  const identity = sql(['-Atc', "SELECT count(*) FROM information_schema.columns WHERE table_name='domain_event_parking'"]);
  assert.equal(identity, '15');

  const eventId = 'f408e92e-82e6-4e17-8b29-360bbc46103e';
  sql(['-c', `INSERT INTO domain_event_outbox(event_id,event_name,event_version,payload,occurred_at) VALUES ('${eventId}','order.cancelled','v1','{}',clock_timestamp())`]);
  sql(['-c', `INSERT INTO domain_event_parking(id,event_id,consumer_key,event_name,failure_class,error_category,business_attempts) VALUES ('0b1f3fd5-77db-4cdd-b859-0016a39388aa','${eventId}','domain-event-routing.v1','order.cancelled','terminal','HELD_EVENT_NOT_ELIGIBLE',1)`]);
  assert.throws(() => sql(['-f', path.join(heldEvidenceMigration, 'rollback.test-only.sql')]));
  assert.throws(() => sql(['-f', path.join(directory, 'rollback.test-only.sql')]));
  assert.equal(sql(['-Atc', 'SELECT count(*) FROM domain_event_parking']), '1');
  sql(['-c', `DELETE FROM domain_event_parking WHERE event_id='${eventId}'`]);
  sql(['-f', path.join(heldEvidenceMigration, 'rollback.test-only.sql')]);
  sql(['-f', path.join(directory, 'rollback.test-only.sql')]);
  assert.equal(sql(['-Atc', "SELECT to_regclass('public.domain_event_parking') IS NULL"]), 't');
  sql(['-f', path.join(directory, 'migration.sql')]);
  sql(['-f', path.join(heldEvidenceMigration, 'migration.sql')]);
  assert.equal(sql(['-Atc', "SELECT count(*) FROM domain_event_parking"]), '0');
  assert.equal(sql(['-Atc', `SELECT count(*) FROM domain_event_outbox WHERE event_id='${eventId}'`]), '1');
});
