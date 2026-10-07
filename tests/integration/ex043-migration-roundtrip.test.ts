import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { it } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { reverseEmptyEx043 } from './fixtures/ex043-empty-reverse';

it('EX043 fresh owned database forward / guarded reverse / forward', async () => {
  assert.equal(process.env.EX043_ROUNDTRIP, 'true', 'Explicit disposable migration opt-in required');
  assert.equal(process.env.CI, 'true');
  assert.equal(process.env.APP_ENV, 'test');
  assert.equal(process.env.NODE_ENV, 'test');
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(['postgresql:', 'postgres:'].includes(url.protocol));
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.ok(!['55440', '56379'].includes(url.port));
  assert.match(url.pathname, /test/i);
  const name = `ex043_test_roundtrip_${randomBytes(8).toString('hex')}`;
  const marker = `EX043_DISPOSABLE_${randomBytes(16).toString('hex')}`;
  const admin = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  let db: PrismaClient | undefined;
  let owned = false;
  const assertForward = async () => {
    const states = await db!.$queryRawUnsafe<Array<{ enumlabel: string }>>(`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'NotificationStatus' AND n.nspname = 'public' ORDER BY e.enumsortorder`);
    assert.deepEqual(states.map((row) => row.enumlabel).sort(), ['failed', 'queued', 'sending', 'sent', 'uncertain']);
    const indexes = await db!.$queryRawUnsafe<Array<{ indexdef: string }>>(`SELECT indexdef FROM pg_indexes WHERE indexname = 'notifications_dispatch_recovery_idx'`);
    assert.match(indexes[0].indexdef, /dispatch_eligible, status, dispatch_lease_until, created_at/);
    assert.equal(await db!.domainEventInbox.count(), 0);
    assert.equal(await db!.notificationAuditIntent.count(), 0);
    const columns = await db!.$queryRawUnsafe<Array<{ column_name: string; column_default: string | null }>>(`SELECT column_name, column_default FROM information_schema.columns WHERE table_name = 'notifications' AND column_name IN ('dispatch_eligible', 'dispatch_claim_token', 'dispatch_lease_until', 'last_error_code') ORDER BY column_name`);
    assert.equal(columns.length, 4);
    assert.equal(columns.find((row) => row.column_name === 'dispatch_eligible')?.column_default, 'false');
  };
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    owned = true;
    await admin.$executeRawUnsafe(`COMMENT ON DATABASE "${name}" IS '${marker}'`);
    url.pathname = `/${name}`;
    const migrate = () => {
      // Buffer output: do not leak a connection URL through CLI diagnostics.
      execFileSync('./node_modules/.bin/prisma', ['migrate', 'deploy'], { env: { ...process.env, DATABASE_URL: url.toString() }, stdio: 'pipe' });
    };
    migrate();
    db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    await assertForward();
    await assert.rejects(reverseEmptyEx043(db, name, `${marker}-wrong`), /marker mismatch/);
    await assert.rejects(reverseEmptyEx043(db, `${name}a`, marker), /marker mismatch/);
    await assertForward();
    const id = randomUUID();
    await db.domainEventInbox.create({ data: { id, consumerKey: 'test-only', eventId: randomUUID(), envelopeHash: 'f'.repeat(64) } });
    await assert.rejects(reverseEmptyEx043(db, name, marker), /populated durable backlog/);
    assert.equal(await db.domainEventInbox.count(), 1);
    const intentId = randomUUID();
    await db.notificationAuditIntent.create({ data: { id: intentId, notificationId: randomUUID(), transitionKey: 'queued', action: 'notification.queued', eventId: randomUUID(), afterData: { status: 'queued' } } });
    await db.domainEventInbox.delete({ where: { id } });
    await assert.rejects(reverseEmptyEx043(db, name, marker), /populated durable backlog/);
    assert.equal(await db.notificationAuditIntent.count(), 1);
    await db.notificationAuditIntent.delete({ where: { id: intentId } });
    const notificationId = randomUUID();
    await db.notification.create({ data: {
      id: notificationId, eventId: randomUUID(), eventName: 'test-only', channel: 'internal',
      recipient: 'internal', content: 'test-only', provider: 'internal', status: 'uncertain',
    } });
    await assert.rejects(reverseEmptyEx043(db, name, marker), /populated durable backlog/);
    assert.equal((await db.notification.findUniqueOrThrow({ where: { id: notificationId } })).status, 'uncertain');
    await db.notification.delete({ where: { id: notificationId } });
    const outboxId = randomUUID();
    await db.domainEventOutbox.create({ data: {
      eventId: outboxId, eventName: 'test-only', eventVersion: 'v1', payload: {}, occurredAt: new Date(),
    } });
    await assert.rejects(reverseEmptyEx043(db, name, marker), /populated durable backlog/);
    assert.equal((await db.domainEventOutbox.findUniqueOrThrow({ where: { eventId: outboxId } })).eligibility, 'held');
    await db.domainEventOutbox.delete({ where: { eventId: outboxId } });
    await reverseEmptyEx043(db, name, marker);
    const reversed = await db.$queryRawUnsafe<Array<{ inbox: string | null; intents: string | null; recovery: string | null }>>(`SELECT to_regclass('domain_event_inbox')::text AS inbox, to_regclass('notification_audit_intents')::text AS intents, to_regclass('notifications_dispatch_recovery_idx')::text AS recovery`);
    assert.deepEqual(reversed[0], { inbox: null, intents: null, recovery: null });
    const states = await db.$queryRawUnsafe<Array<{ enumlabel: string }>>(`SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE t.typname = 'NotificationStatus' AND n.nspname = 'public' ORDER BY e.enumsortorder`);
    assert.deepEqual(states.map((row) => row.enumlabel), ['queued', 'sent', 'failed']);
    const removed = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'notifications' AND column_name IN ('dispatch_eligible', 'dispatch_claim_token', 'dispatch_lease_until', 'last_error_code')`);
    assert.equal(removed[0].count, 0n);
    await db.$disconnect();
    migrate();
    await assertForward();
  } finally {
    await db?.$disconnect();
    if (owned) await admin.$executeRawUnsafe(`DROP DATABASE "${name}"`);
    await admin.$disconnect();
  }
});
