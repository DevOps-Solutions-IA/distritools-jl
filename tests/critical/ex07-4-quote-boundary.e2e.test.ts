import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import { AUDIT_REPOSITORY, AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
  seedBaseData,
} from 'tests/helpers/test-db';

// Run only after the orchestrator verifies owned, disposable PostgreSQL/Redis.
// resetDatabase truncates the configured database; A8 has NOT run this suite.
describe('EX-07.4 quote transaction boundaries', { concurrency: false }, () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'] | undefined;
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let adminToken: string;
  let viewerToken: string;

  before(async () => {
    await resetDatabase();
    seeded = await seedBaseData();
    const testApp = await createTestApp();
    app = testApp.app;
    http = testApp.http;
    const admin = await loginAsAdmin(
      http, seeded.users.adminEmail, seeded.users.adminPassword,
      seeded.users.twoFactorSecret,
    );
    const viewer = await loginAsAdmin(
      http, seeded.users.viewerEmail, seeded.users.viewerPassword,
      seeded.users.twoFactorSecret,
    );
    assert.equal(admin.user.permissions.includes('quotes.write'), true);
    assert.equal(viewer.user.permissions.includes('quotes.write'), false);
    adminToken = admin.accessToken;
    viewerToken = viewer.accessToken;
  });

  after(async () => {
    try {
      await app?.close();
    } finally {
      await disconnectDatabase();
    }
  });

  function quoteBody(label: string) {
    return {
      customer: {
        fullName: `Synthetic A6 ${label}`,
        email: `a6-${label}@example.invalid`,
        dataTreatmentConsent: true,
      },
      items: [{
        productId: seeded.inventory.productId,
        variantId: seeded.inventory.variantId,
        nameSnapshot: 'Synthetic A6 item',
        quantity: 2,
        unitPrice: '100',
      }],
    };
  }

  async function createQuote(label: string) {
    const response = await http.post('/api/v1/admin/quotes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(quoteBody(label));
    assert.equal(response.status, 201);
    assert.equal(typeof response.body.id, 'string');
    const quote = await prisma.quote.findUniqueOrThrow({
      where: { id: response.body.id as string },
      include: { items: { orderBy: { id: 'asc' } } },
    });
    assert.equal(quote.items.length, 1);
    assert.equal(quote.items[0].quoteId, quote.id);
    assert.equal(quote.subtotal.toFixed(2), '200.00');
    assert.equal(await prisma.auditLog.count({
      where: {
        action: 'quote.created', entityType: 'quote', entityId: quote.id,
        actorUserId: seeded.users.adminUserId,
      },
    }), 1);
    return quote;
  }

  async function quoteAudits() {
    // Includes both quotes and item entities, catching misattributed writes too.
    // Auth/security denial logs are outside this business-mutation assertion.
    return prisma.auditLog.findMany({
      where: {
        OR: [
          { entityType: { in: ['quote', 'quoteItem'] } },
          { action: { startsWith: 'quote.' } },
        ],
      },
      orderBy: { id: 'asc' },
    });
  }

  async function quoteState(ids: string[]) {
    return {
      quotes: await prisma.quote.findMany({
        where: { id: { in: ids } },
        include: { items: { orderBy: { id: 'asc' } } },
        orderBy: { id: 'asc' },
      }),
      audit: await quoteAudits(),
    };
  }

  it('rejects a real Q2 item submitted to Q1 without changing either quote or audit', async () => {
    const q1 = await createQuote('boundary-q1');
    const q2 = await createQuote('boundary-q2');
    assert.notEqual(q1.id, q2.id);
    assert.notEqual(q1.customerId, q2.customerId);
    assert.notEqual(q1.items[0].id, q2.items[0].id);
    assert.equal(q2.items[0].quoteId, q2.id);
    const ids = [q1.id, q2.id];
    const beforeState = await quoteState(ids);

    const response = await http.post(`/api/v1/admin/quotes/${q1.id}/price-items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ id: q2.items[0].id, quantity: 3, unitPrice: '999' }] });
    // Read durable post-state even when the HTTP expectation fails.
    const afterState = await quoteState(ids);
    assert.deepEqual(
      { status: response.status, state: afterState },
      { status: 400, state: beforeState },
      'Foreign item must yield HTTP 400; Q1, Q2, their items and quote audits must remain unchanged',
    );
  });

  it('does not persist a new customer or quote when quantity or price is invalid', async () => {
    for (const invalid of [
      { label: 'rollback-quantity', quantity: 0, unitPrice: '100' },
      { label: 'rollback-price', quantity: 2, unitPrice: '-1' },
    ]) {
      const body = quoteBody(invalid.label);
      body.items[0].quantity = invalid.quantity;
      body.items[0].unitPrice = invalid.unitPrice;
      assert.equal(await prisma.customer.findUnique({
        where: { email: body.customer.email },
      }), null);
      const beforeState = {
        customers: await prisma.customer.findMany({ orderBy: { id: 'asc' } }),
        quotes: await prisma.quote.findMany({ orderBy: { id: 'asc' } }),
        items: await prisma.quoteItem.findMany({ orderBy: { id: 'asc' } }),
        audit: await quoteAudits(),
      };
      const response = await http.post('/api/v1/admin/quotes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);
      const afterState = {
        customers: await prisma.customer.findMany({ orderBy: { id: 'asc' } }),
        quotes: await prisma.quote.findMany({ orderBy: { id: 'asc' } }),
        items: await prisma.quoteItem.findMany({ orderBy: { id: 'asc' } }),
        audit: await quoteAudits(),
      };
      assert.deepEqual(
        { status: response.status, state: afterState },
        { status: 400, state: beforeState },
        `${invalid.label}: rejected quote must leave no partial customer, quote, item or quote audit`,
      );
    }
  });

  async function businessState() {
    return {
      customers: await prisma.customer.findMany({ orderBy: { id: 'asc' } }),
      quotes: await prisma.quote.findMany({ orderBy: { id: 'asc' } }),
      items: await prisma.quoteItem.findMany({ orderBy: { id: 'asc' } }),
      audit: await quoteAudits(),
    };
  }

  it('enforces 401/403 without business writes and audits authorized pricing', async () => {
    const quote = await createQuote('rbac');
    for (const denied of [
      { token: undefined, status: 401, label: 'anonymous' },
      { token: viewerToken, status: 403, label: 'viewer' },
    ]) {
      const beforeState = await businessState();
      const create = http.post('/api/v1/admin/quotes');
      if (denied.token) create.set('Authorization', `Bearer ${denied.token}`);
      const createResponse = await create.send(quoteBody(`denied-${denied.label}`));
      assert.deepEqual(
        { status: createResponse.status, state: await businessState() },
        { status: denied.status, state: beforeState },
        `${denied.label}: denied creation must leave customers, quotes, items and quote audits unchanged`,
      );

      // Construct only after create settles: Supertest closes its ephemeral
      // server when the last dispatched request completes.
      const price = http.post(`/api/v1/admin/quotes/${quote.id}/price-items`);
      if (denied.token) price.set('Authorization', `Bearer ${denied.token}`);
      const priceResponse = await price.send({
        items: [{ id: quote.items[0].id, quantity: 2, unitPrice: '175' }],
      });
      assert.deepEqual(
        { status: priceResponse.status, state: await businessState() },
        { status: denied.status, state: beforeState },
        `${denied.label}: denied pricing must leave customers, quotes, items and quote audits unchanged`,
      );
    }

    const auditBefore = await quoteAudits();
    const response = await http.post(`/api/v1/admin/quotes/${quote.id}/price-items`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ items: [{ id: quote.items[0].id, quantity: 2, unitPrice: '175' }] });
    assert.equal(response.status, 201);
    const persisted = await prisma.quote.findUniqueOrThrow({
      where: { id: quote.id }, include: { items: true },
    });
    assert.equal(persisted.items.length, 1);
    assert.equal(persisted.items[0].id, quote.items[0].id);
    assert.equal(persisted.items[0].quoteId, quote.id);
    assert.equal(persisted.items[0].quantity, 2);
    assert.equal(persisted.status, 'quoted');
    assert.equal(persisted.subtotal.toFixed(2), '350.00');
    assert.equal(persisted.items[0].unitPrice?.toFixed(2), '175.00');
    assert.equal(persisted.items[0].totalPrice?.toFixed(2), '350.00');
    const auditAfter = await quoteAudits();
    assert.deepEqual(
      auditAfter.filter((log) => auditBefore.some((previous) => previous.id === log.id)),
      auditBefore,
      'Authorized pricing must preserve every pre-existing quote audit',
    );
    const newAudits = auditAfter.filter(
      (log) => !auditBefore.some((previous) => previous.id === log.id),
    );
    assert.equal(newAudits.length, 1);
    assert.equal(newAudits[0].action, 'quote.items_priced');
    assert.equal(newAudits[0].entityType, 'quote');
    assert.equal(newAudits[0].entityId, quote.id);
    assert.equal(newAudits[0].actorUserId, seeded.users.adminUserId);
    const beforeData = newAudits[0].beforeData as { subtotal?: string } | null;
    const afterData = newAudits[0].afterData as { subtotal?: string } | null;
    assert.equal(beforeData?.subtotal, '200.00');
    assert.equal(afterData?.subtotal, '350.00');
  });

  it('rolls back customers, quotes, items and audit after a real quote audit insert fails', async () => {
    assert.ok(app);
    const audit = app.get<AuditRepository>(AUDIT_REPOSITORY);
    const quote = await createQuote('audit-rollback');
    for (const operation of [
      { action: 'quote.created', path: '/api/v1/admin/quotes', body: quoteBody('audit-rollback-create') },
      {
        action: 'quote.items_priced',
        path: `/api/v1/admin/quotes/${quote.id}/price-items`,
        body: { items: [{ id: quote.items[0].id, quantity: 3, unitPrice: '225' }] },
      },
    ]) {
      const beforeState = await businessState();
      const originalWrite = audit.write;
      let insertedAudit: Awaited<ReturnType<typeof prisma.auditLog.findFirst>> = null;
      audit.write = async (entry, tx) => {
        await originalWrite.call(audit, entry, tx);
        if (entry.action === operation.action) {
          // Observe the real inserted row before throwing. The post-request
          // read below must prove that it and all business writes rolled back.
          insertedAudit = await (tx ?? prisma).auditLog.findFirst({
            where: {
              action: entry.action, entityType: 'quote', entityId: entry.entityId,
              actorUserId: seeded.users.adminUserId,
            },
            orderBy: { createdAt: 'desc' },
          });
          throw new Error('EX074 A8 synthetic failure after real quote audit insert');
        }
      };
      let responseStatus: number;
      try {
        const response = await http.post(operation.path)
          .set('Authorization', `Bearer ${adminToken}`)
          .send(operation.body);
        responseStatus = response.status;
      } finally {
        audit.write = originalWrite;
      }
      const afterState = await businessState();
      assert.ok(insertedAudit, `${operation.action}: injection must follow a real audit insertion`);
      assert.equal(beforeState.audit.some((log) => log.id === insertedAudit!.id), false);
      assert.deepEqual(
        { status: responseStatus, state: afterState },
        { status: 500, state: beforeState },
        `${operation.action}: failed audit must roll back customers, quotes, items and quote audits`,
      );
    }
  });
});
