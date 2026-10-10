import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { v7 as uuidv7 } from 'uuid';
import type { Prisma } from '@prisma/client';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AUDIT_REPOSITORY, AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';
import { assertDisposableTarget } from 'tests/helpers/ex07-4-disposable-target';

// These tests must be run only after the orchestrator provisions owned services.
// No fixture/mock simulates PostgreSQL writes, locking, audit or rollback.
// Force the original unprotected reads to observe the same real DB snapshot.
// The patched routes read through transaction delegates after taking a lock,
// so they never reach this legacy, root-client rendezvous.
function legacyReadBarrier(participants = 2) {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let arrivals = 0;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    async wait() {
      arrivals += 1;
      if (arrivals === 1) timer = setTimeout(() => { timedOut = true; release(); }, 3000);
      if (arrivals === participants) release();
      await gate;
    },
    close() {
      clearTimeout(timer);
      release();
      assert.equal(timedOut, false, 'Concurrent real legacy reads must meet without a timeout');
    },
  };
}

describe('EX-07.4 quotes transactional core (owned disposable PostgreSQL/Redis only)', { concurrency: false }, () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'] | undefined;
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let db: PrismaService;
  let audit: AuditRepository;
  let adminToken: string;
  let viewerToken: string;
  let customerId: string;

  before(async () => {
    assertDisposableTarget();
    await resetDatabase();
    seeded = await seedBaseData();
    const testApp = await createTestApp();
    app = testApp.app;
    http = testApp.http;
    db = app.get(PrismaService);
    audit = app.get<AuditRepository>(AUDIT_REPOSITORY);
    adminToken = (await loginAsAdmin(http, seeded.users.adminEmail, seeded.users.adminPassword, seeded.users.twoFactorSecret)).accessToken;
    viewerToken = (await loginAsAdmin(http, seeded.users.viewerEmail, seeded.users.viewerPassword, seeded.users.twoFactorSecret)).accessToken;
    customerId = uuidv7();
    await prisma.customer.create({ data: { id: customerId, fullName: 'Synthetic Quote Fixture', email: 'ex074-a1@example.test' } });
  });

  after(async () => {
    await app?.close();
    await disconnectDatabase();
  });

  function quoteBody() {
    return {
      customerId,
      items: [{ productId: seeded.inventory.productId, variantId: seeded.inventory.variantId, nameSnapshot: 'Synthetic quote item', quantity: 2, unitPrice: '150000' }],
    };
  }

  function create() {
    return http.post('/api/v1/admin/quotes').set('Authorization', `Bearer ${adminToken}`).send(quoteBody());
  }

  it('P1: allocates distinct numbers from a sparse maximum under concurrent real HTTP creates', async () => {
    await prisma.quote.create({ data: { id: uuidv7(), customerId, quoteNumber: 'QTE-999999' } });
    const beforeCount = await prisma.quote.count();
    assert.equal((await http.post('/api/v1/admin/quotes').send(quoteBody())).status, 401);
    assert.equal((await http.post('/api/v1/admin/quotes').set('Authorization', `Bearer ${viewerToken}`).send(quoteBody())).status, 403);
    assert.equal(await prisma.quote.count(), beforeCount);

    const originalCount = db.quote.count;
    const barrier = legacyReadBarrier();
    db.quote.count = (async (args?: Prisma.QuoteCountArgs) => {
      const result = await originalCount.call(db.quote, args);
      if (!args) await barrier.wait();
      return result;
    }) as typeof db.quote.count;
    try {
      const responses = await Promise.all([create(), create()]);
      assert.deepEqual(responses.map((response) => response.status), [201, 201]);
      assert.deepEqual(responses.map((response) => response.body.quoteNumber).sort(), ['QTE-1000000', 'QTE-1000001']);
      assert.equal(await prisma.quote.count(), beforeCount + 2);
      for (const response of responses) {
        const row = await prisma.quote.findUniqueOrThrow({ where: { id: response.body.id }, include: { items: true } });
        assert.equal(row.subtotal.toFixed(2), '300000.00');
        assert.equal(row.currency, 'COP');
        assert.equal(row.items[0].totalPrice?.toFixed(2), '300000.00');
        assert.equal(response.body.customer.email.includes('***'), true);
        assert.equal(await prisma.auditLog.count({ where: { action: 'quote.created', entityId: row.id } }), 1);
      }
    } finally {
      db.quote.count = originalCount;
      barrier.close();
    }
  });

  it('P1: concurrent accept/cancel/convert form a legal serial history and conversion retries keep one manual intent', async () => {
    const created = await create();
    assert.equal(created.status, 201);
    const quoteId: string = created.body.id;
    const ordersBefore = await prisma.order.count();
    const originalRead = db.quote.findUnique;
    const barrier = legacyReadBarrier(3);
    db.quote.findUnique = <T extends Prisma.QuoteFindUniqueArgs>(args: Prisma.SelectSubset<T, Prisma.QuoteFindUniqueArgs>) => {
      const pendingRow = originalRead.bind(db.quote)(args);
      const originalThen = pendingRow.then.bind(pendingRow);
      // Keep the real generic Prisma client; delay only its awaited result.
      pendingRow.then = (onfulfilled, onrejected) => originalThen(async (row) => {
        if (args.where.id === quoteId) await barrier.wait();
        return row;
      }).then(onfulfilled, onrejected);
      return pendingRow;
    };
    try {
      const [accepted, cancelled, converted] = await Promise.all([
        http.post(`/api/v1/admin/quotes/${quoteId}/accept`).set('Authorization', `Bearer ${adminToken}`),
        http.post(`/api/v1/admin/quotes/${quoteId}/cancel`).set('Authorization', `Bearer ${adminToken}`),
        http.post(`/api/v1/admin/quotes/${quoteId}/convert-to-order`).set('Authorization', `Bearer ${adminToken}`),
      ]);
      assert.equal([201, 400].includes(accepted.status), true);
      assert.equal([201, 400].includes(cancelled.status), true);
      assert.equal(converted.status, 201);
      const row = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
      assert.equal(row.status, 'converted_to_order');
      assert.equal(row.orderId, null);
      assert.equal(row.acceptedAt !== null, accepted.status === 201);
      const logs = await prisma.auditLog.findMany({ where: {
        entityId: quoteId,
        action: { in: ['quote.accepted', 'quote.cancelled', 'quote.convert_requested'] },
      } });
      assert.equal(logs.filter((log) => log.action === 'quote.accepted').length, accepted.status === 201 ? 1 : 0);
      assert.equal(logs.filter((log) => log.action === 'quote.cancelled').length, cancelled.status === 201 ? 1 : 0);
      assert.equal(logs.filter((log) => log.action === 'quote.convert_requested').length, 1);
      // Reconstruct the state chain from persisted snapshots, without relying
      // on transaction-start timestamps or database row ordering.
      let state = 'quoted';
      const remaining = [...logs];
      while (remaining.length > 0) {
        const next = remaining.findIndex((log) => (log.beforeData as { status: string }).status === state);
        assert.notEqual(next, -1, 'Every successful mutation must observe its predecessor');
        const [log] = remaining.splice(next, 1);
        state = (log.afterData as { status: string }).status;
      }
      assert.equal(state, 'converted_to_order');
    } finally {
      db.quote.findUnique = originalRead;
      barrier.close();
    }

    // The existing convert endpoint permits conversion even if cancel wins
    // first. This test preserves that policy; changing it needs a decision.
    const beforeReplay = await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } });
    const conversions = await Promise.all([0, 1].map(() => http.post(`/api/v1/admin/quotes/${quoteId}/convert-to-order`).set('Authorization', `Bearer ${adminToken}`)));
    assert.deepEqual(conversions.map((response) => response.status), [201, 201]);
    for (const response of conversions) {
      assert.equal(response.body.status, 'converted_to_order');
      assert.equal(response.body.order, null);
      assert.equal(response.body.convertedAt, beforeReplay.convertedAt?.toISOString());
      assert.equal(response.body.operationalState.status, 'manual_order_creation_required');
    }
    assert.equal(await prisma.order.count(), ordersBefore);
    assert.equal(await prisma.auditLog.count({ where: { action: 'quote.convert_requested', entityId: quoteId } }), 1);
    assert.deepEqual(await prisma.quote.findUniqueOrThrow({ where: { id: quoteId } }), beforeReplay);
    assert.equal((await http.post(`/api/v1/admin/quotes/${quoteId}/cancel`).set('Authorization', `Bearer ${adminToken}`)).status, 400);
  });

  it('P1: a failure after real audit insertion rolls back quote, items and audit together', async () => {
    const operations = [
      { action: 'quote.created', route: '', method: 'post' as const },
      { action: 'quote.updated', route: '', method: 'patch' as const },
      { action: 'quote.items_priced', route: '/price-items', method: 'post' as const },
      { action: 'quote.accepted', route: '/accept', method: 'post' as const },
      { action: 'quote.cancelled', route: '/cancel', method: 'post' as const },
      { action: 'quote.convert_requested', route: '/convert-to-order', method: 'post' as const },
    ];
    for (const operation of operations) {
      const isCreate = operation.action === 'quote.created';
      const fixture = isCreate ? null : await create();
      if (fixture) assert.equal(fixture.status, 201);
      const quoteId: string | undefined = fixture?.body.id;
      const beforeRow = quoteId ? await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { items: true } }) : null;
      const beforeQuotes = await prisma.quote.count();
      const beforeItems = await prisma.quoteItem.count();
      const beforeAudits = await prisma.auditLog.count({ where: { action: operation.action } });
      const originalWrite = audit.write;
      audit.write = async (entry, tx) => {
        await originalWrite.call(audit, entry, tx);
        if (entry.action === operation.action) throw new Error('EX074 synthetic failure after real audit insert');
      };
      try {
        const body = isCreate ? quoteBody() : operation.action === 'quote.items_priced'
          ? { items: [{ id: beforeRow!.items[0].id, quantity: 3, unitPrice: '160000' }] }
          : { notes: 'Synthetic changed note' };
        const path = isCreate ? '/api/v1/admin/quotes' : `/api/v1/admin/quotes/${quoteId}${operation.route}`;
        const response = await http[operation.method](path).set('Authorization', `Bearer ${adminToken}`).send(body);
        assert.equal(response.status, 500, operation.action);
      } finally {
        audit.write = originalWrite;
      }
      assert.equal(await prisma.quote.count(), beforeQuotes, operation.action);
      assert.equal(await prisma.quoteItem.count(), beforeItems, operation.action);
      assert.equal(await prisma.auditLog.count({ where: { action: operation.action } }), beforeAudits, operation.action);
      if (quoteId) {
        assert.deepEqual(await prisma.quote.findUniqueOrThrow({ where: { id: quoteId }, include: { items: true } }), beforeRow, operation.action);
      }
    }
  });
});
