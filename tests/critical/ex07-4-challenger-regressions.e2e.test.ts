import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';
import { Prisma, type NotificationEvent } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AUDIT_REPOSITORY, type AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';

// Prisma proxies expose virtual descriptors without a value. node:test's
// mock.method reads that descriptor and rejects the method as undefined.
// Assign through the proxy instead; restore both function and descriptor.
function replacePrismaMethod(target: object, method: string, original: unknown, replacement: unknown) {
  const descriptor = Object.getOwnPropertyDescriptor(target, method);
  assert.equal(typeof original, 'function');
  assert.equal(typeof replacement, 'function');
  assert.equal(Reflect.set(target, method, replacement), true);
  assert.equal(Reflect.get(target, method), replacement);
  return () => {
    if (descriptor === undefined) {
      assert.equal(Reflect.deleteProperty(target, method), true);
    } else {
      assert.equal(Reflect.set(target, method, original), true);
    }
    assert.equal(Reflect.get(target, method), original);
    assert.deepEqual(Object.getOwnPropertyDescriptor(target, method), descriptor);
  };
}

// NOT_TESTED in A11: execute only after the orchestrator verifies owned,
// disposable PostgreSQL/Redis. resetDatabase truncates the configured target.
// Real HTTP, auth/RBAC, Prisma inserts and post-request durable reads. The
// injected errors occur after real inserts; they never simulate DB success.
describe('EX-07.4 challenger persisted regressions', { concurrency: false }, () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'] | undefined;
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let adminToken: string;
  let viewerToken: string;
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  const customerIds: string[] = [];
  const quoteIds: string[] = [];
  let sequence = 0;

  before(async () => {
    assert.equal(process.env.CI, 'true');
    assert.equal(process.env.NODE_ENV, 'test');
    assert.equal(process.env.APP_ENV, 'test');
    const { validateTestEnvironment } = require('../../scripts/ci/assert-test-environment') as {
      validateTestEnvironment: (env: NodeJS.ProcessEnv) => { ok: boolean; failures: string[] };
    };
    const target = validateTestEnvironment(process.env);
    assert.equal(target.ok, true, target.failures.join('; '));
    await resetDatabase();
    seeded = await seedBaseData();
    ({ app, http } = await createTestApp());
    const admin = await loginAsAdmin(http, seeded.users.adminEmail, seeded.users.adminPassword, seeded.users.twoFactorSecret);
    const viewer = await loginAsAdmin(http, seeded.users.viewerEmail, seeded.users.viewerPassword, seeded.users.twoFactorSecret);
    for (const permission of ['quotes.write', 'customers.notes.write', 'footer.read']) {
      assert.equal(admin.user.permissions.includes(permission), true);
      assert.equal(viewer.user.permissions.includes(permission), false);
    }
    adminToken = admin.accessToken; viewerToken = viewer.accessToken;
    assert.equal(typeof adminToken, 'string'); assert.equal(typeof viewerToken, 'string');
  });

  after(async () => {
    try { await app?.close(); } finally { await disconnectDatabase(); }
  });

  async function fixture(status: 'requested' | 'quoted' = 'requested') {
    sequence++;
    const customer = await prisma.customer.create({ data: {
      id: uuidv7(), fullName: 'Synthetic Challenger Customer', email: `a11-${sequence}@example.invalid`,
      phone: '00000007411', marketingConsent: false, dataTreatmentConsent: false,
    } });
    customerIds.push(customer.id);
    const quote = await prisma.quote.create({ data: {
      id: uuidv7(), quoteNumber: `QTE-A11-${sequence}`, customerId: customer.id, status,
      subtotal: 10, createdById: seeded.users.adminUserId, updatedById: seeded.users.adminUserId,
    } });
    quoteIds.push(quote.id);
    return { customer, quote };
  }

  async function businessState() {
    return {
      customers: await prisma.customer.findMany({ where: { id: { in: customerIds } }, orderBy: { id: 'asc' } }),
      quotes: await prisma.quote.findMany({ where: { id: { in: quoteIds } }, include: { items: true }, orderBy: { id: 'asc' } }),
      audits: await prisma.auditLog.findMany({ where: { entityId: { in: [...customerIds, ...quoteIds] },
        entityType: { in: ['customer', 'quote'] } }, orderBy: { id: 'asc' } }),
      events: await prisma.notificationEvent.findMany({ where: { entityId: { in: quoteIds }, entityType: 'quote' }, orderBy: { id: 'asc' } }),
    };
  }

  async function withProvider(provider: string, operation: () => Promise<void>) {
    const original = process.env.NOTIFICATION_PROVIDER;
    try { process.env.NOTIFICATION_PROVIDER = provider; await operation(); }
    finally {
      if (original === undefined) delete process.env.NOTIFICATION_PROVIDER;
      else process.env.NOTIFICATION_PROVIDER = original;
    }
  }

  async function deniedSend(quoteId: string) {
    const route = `/api/v1/admin/quotes/${quoteId}/send`;
    const beforeState = await businessState();
    assert.equal((await http.post(route)).status, 401);
    assert.equal((await http.post(route).set('Authorization', `Bearer ${viewerToken}`)).status, 403);
    assert.deepEqual(await businessState(), beforeState);
  }

  it('returns 401/403/503 for unsupported send and never persists a sent claim', async () => {
    const { quote } = await fixture('quoted');
    await withProvider('ex074-unconfigured-provider', async () => {
      await deniedSend(quote.id);
      const beforeState = await businessState();
      const response = await http.post(`/api/v1/admin/quotes/${quote.id}/send`).set('Authorization', `Bearer ${adminToken}`);
      assert.deepEqual({ status: response.status, state: await businessState() }, { status: 503, state: beforeState });
    });
  });

  it('permits only an audited skipped manual-send intent after 401/403', async () => {
    const { quote, customer } = await fixture();
    await withProvider('none', async () => {
      await deniedSend(quote.id);
      const response = await http.post(`/api/v1/admin/quotes/${quote.id}/send`).set('Authorization', `Bearer ${adminToken}`);
      assert.equal(response.status, 201); assert.equal(response.body.operationalState.status, 'pending_manual_send');
      const row = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });
      assert.equal(row.status, 'quoted'); assert.equal(row.sentAt, null);
      const audits = await prisma.auditLog.findMany({ where: { entityType: 'quote', entityId: quote.id } });
      assert.equal(audits.length, 1); assert.equal(audits[0].action, 'quote.manual_send_required');
      assert.equal(audits[0].actorUserId, seeded.users.adminUserId);
      const events = await prisma.notificationEvent.findMany({ where: { entityType: 'quote', entityId: quote.id } });
      assert.equal(events.length, 1); assert.equal(events[0].status, 'skipped_provider_not_configured');
      assert.equal(events[0].provider, 'none'); assert.notEqual(events[0].recipientMasked, customer.email);
      assert.equal(response.body.sentAt, null); assert.equal(response.body.customer.email.includes('***'), true);
    });
  });

  it('rolls back quote, audit and event after a real skipped-event insert throws', async () => {
    assert.ok(app);
    const { quote } = await fixture();
    const applicationPrisma = app.get<PrismaService>(PrismaService);
    const originalTransaction = applicationPrisma.$transaction;
    const observed: { event: NotificationEvent | null; status: string | null; auditId: string | null } = {
      event: null, status: null, auditId: null,
    };
    await withProvider('none', async () => {
      const beforeState = await businessState();
      const restoreTransaction = replacePrismaMethod(applicationPrisma, '$transaction', originalTransaction, async (
        operation: (tx: Prisma.TransactionClient) => Promise<unknown>,
        options?: { isolationLevel?: Prisma.TransactionIsolationLevel; maxWait?: number; timeout?: number },
      ) => originalTransaction.call(applicationPrisma, async (tx) => {
        const eventDelegate = tx.notificationEvent;
        const originalCreate = eventDelegate.create;
        const restoreEvent = replacePrismaMethod(eventDelegate, 'create', originalCreate, async (args: Prisma.NotificationEventCreateArgs) => {
          const inserted = await originalCreate.call(eventDelegate, args);
          if (inserted.entityId === quote.id) {
            observed.event = await tx.notificationEvent.findUniqueOrThrow({ where: { id: inserted.id } });
            observed.status = (await tx.quote.findUniqueOrThrow({ where: { id: quote.id } })).status;
            observed.auditId = (await tx.auditLog.findFirstOrThrow({ where: {
              entityId: quote.id, action: 'quote.manual_send_required',
            } })).id;
            throw new Error('EX074 A11 failure after real skipped-event insert');
          }
          return inserted;
        });
        try { return await operation(tx); } finally { restoreEvent(); }
      }, options));
      let responseStatus: number;
      try {
        responseStatus = (await http.post(`/api/v1/admin/quotes/${quote.id}/send`)
          .set('Authorization', `Bearer ${adminToken}`)).status;
      } finally { restoreTransaction(); }
      const afterState = await businessState();
      assert.ok(observed.event); assert.ok(observed.auditId); assert.equal(observed.status, 'quoted');
      assert.deepEqual({ status: responseStatus, state: afterState }, { status: 500, state: beforeState });
      assert.equal(await prisma.notificationEvent.findUnique({ where: { id: observed.event.id } }), null);
      assert.equal(await prisma.auditLog.findUnique({ where: { id: observed.auditId } }), null);
    });
  });

  it('requires 401/403 and rolls back profile, consent and a real inserted customer audit on error', async () => {
    assert.ok(app);
    const { customer } = await fixture();
    const route = `/api/v1/admin/customers/${customer.id}`;
    const payload = { fullName: ' Changed Challenger ', marketingConsent: true, dataTreatmentConsent: true };
    const beforeState = await businessState();
    assert.equal((await http.patch(route).send(payload)).status, 401);
    assert.equal((await http.patch(route).set('Authorization', `Bearer ${viewerToken}`).send(payload)).status, 403);
    assert.deepEqual(await businessState(), beforeState);
    const audit = app.get<AuditRepository>(AUDIT_REPOSITORY);
    const originalWrite = audit.write;
    const observed: { auditId: string | null; changedName: string | null; consent: boolean | null } = {
      auditId: null, changedName: null, consent: null,
    };
    const auditFault = mock.method(audit, 'write', async (...args: Parameters<AuditRepository['write']>) => {
      const [entry, tx] = args;
      await originalWrite.call(audit, ...args);
      if (entry.action === 'customer.updated' && entry.entityId === customer.id) {
        observed.auditId = (await (tx ?? prisma).auditLog.findFirstOrThrow({ where: {
          action: entry.action, entityId: customer.id,
        } })).id;
        const changed = await (tx ?? prisma).customer.findUniqueOrThrow({ where: { id: customer.id } });
        observed.changedName = changed.fullName; observed.consent = changed.dataTreatmentConsent;
        throw new Error('EX074 A11 failure after real customer audit insert');
      }
    });
    let responseStatus: number;
    try { responseStatus = (await http.patch(route).set('Authorization', `Bearer ${adminToken}`).send(payload)).status; }
    finally { auditFault.mock.restore(); }
    const afterState = await businessState();
    assert.ok(observed.auditId); assert.equal(observed.changedName, 'Changed Challenger'); assert.equal(observed.consent, true);
    assert.deepEqual({ status: responseStatus, state: afterState }, { status: 500, state: beforeState });
    assert.equal(await prisma.auditLog.findUnique({ where: { id: observed.auditId } }), null);
    const success = await http.patch(route).set('Authorization', `Bearer ${adminToken}`).send(payload);
    assert.equal(success.status, 200); assert.equal(success.body.fullName.includes('***'), true);
    const changed = await prisma.customer.findUniqueOrThrow({ where: { id: customer.id } });
    assert.equal(changed.fullName, 'Changed Challenger'); assert.equal(changed.marketingConsent, true);
    assert.equal(changed.dataTreatmentConsent, true);
    const inserted = await prisma.auditLog.findFirstOrThrow({ where: { action: 'customer.updated', entityId: customer.id } });
    assert.equal(inserted.actorUserId, seeded.users.adminUserId);
    for (const data of [inserted.beforeData, inserted.afterData]) {
      const fields = data as { fullName: string; email: string; phone: string };
      assert.equal(fields.fullName, '[REDACTED]'); assert.equal(fields.email, '[REDACTED]'); assert.equal(fields.phone, '[REDACTED]');
    }
  });

  it('returns 401/403/200 and retains the published footer under twenty-one newer drafts', async () => {
    const highest = await prisma.footerRevision.findFirst({ orderBy: { version: 'desc' } });
    const version = (highest?.version ?? 0) + 1;
    const published = await prisma.footerRevision.create({ data: {
      id: uuidv7(), version, status: 'published', publishedAt: new Date(),
      groupsJson: [{ title: 'Synthetic publication', links: [] }],
      links: { create: [{ id: uuidv7(), group: 'Synthetic', label: 'Published link', href: '/politica-de-privacidad', order: 0 }] },
    } });
    await prisma.footerRevision.createMany({ data: Array.from({ length: 21 }, (_, index) => ({
      id: uuidv7(), version: version + index + 1, status: 'draft', groupsJson: [],
    })) });
    const beforeRows = await prisma.footerRevision.findMany({ include: { links: true }, orderBy: { version: 'desc' } });
    const route = '/api/v1/admin/content/footer';
    assert.equal((await http.get(route)).status, 401);
    assert.equal((await http.get(route).set('Authorization', `Bearer ${viewerToken}`)).status, 403);
    const response = await http.get(route).set('Authorization', `Bearer ${adminToken}`);
    const afterRows = await prisma.footerRevision.findMany({ include: { links: true }, orderBy: { version: 'desc' } });
    assert.deepEqual(afterRows, beforeRows);
    assert.equal(response.status, 200); assert.equal(response.body.history.length, 20);
    assert.equal(response.body.data.version, version + 21);
    assert.equal(response.body.history.some((row: { status: string }) => row.status === 'published'), false);
    assert.equal(response.body.published.id, published.id); assert.equal(response.body.published.status, 'published');
    assert.equal(response.body.published.links[0].label, 'Published link');
  });
});
