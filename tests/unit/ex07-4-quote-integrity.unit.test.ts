import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import type { Customer, Prisma, Quote, QuoteItem } from '@prisma/client';
import { RequestContextService } from 'src/common/request/request-context.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AdminOperationsController } from 'src/modules/admin-operations/infrastructure/http/controllers/admin-operations.controller';
import { PrismaAuditRepository } from 'src/modules/auth/infrastructure/repositories/prisma-audit.repository';

type StoredQuote = Omit<Quote, 'subtotal'> & { subtotal: number };
type StoredItem = Omit<QuoteItem, 'unitPrice' | 'totalPrice'> & {
  unitPrice: number | null;
  totalPrice: number | null;
};
type CustomerData = Omit<Customer, 'createdAt' | 'updatedAt' | 'lastOrderAt' | 'documentType' | 'documentNumber'>;
type ItemData = Omit<StoredItem, 'createdAt' | 'updatedAt'>;
const now = new Date('2026-10-10T00:00:00Z');
const actor = {
  sub: 'operator', email: 'operator@example.invalid', role: 'admin',
  permissions: ['quotes.write'], sessionId: 'session',
};

function customer(id = 'customer') : Customer {
  return {
    id, fullName: 'Original Customer', email: `${id}@example.invalid`, phone: null,
    documentType: null, documentNumber: null, defaultAddress: null, city: null,
    department: null, country: 'CO', marketingConsent: false,
    dataTreatmentConsent: false, lastOrderAt: null, createdAt: now, updatedAt: now,
  };
}

function quote(id: string): StoredQuote {
  return {
    id, quoteNumber: `QTE-00000${id === 'q1' ? 1 : 2}`, customerId: 'customer',
    orderId: null, status: 'requested', subtotal: 20, currency: 'COP', notes: null,
    internalNotes: null, expiresAt: null, sentAt: null, acceptedAt: null,
    rejectedAt: null, convertedAt: null, createdById: actor.sub,
    updatedById: actor.sub, createdAt: now, updatedAt: now,
  };
}

function item(id: string, quoteId: string): StoredItem {
  return {
    id, quoteId, productId: 'product', variantId: null, nameSnapshot: 'Item',
    skuSnapshot: null, quantity: 2, unitPrice: 10, totalPrice: 20, notes: null,
    createdAt: now, updatedAt: now,
  };
}

// Only the database boundary is replaced: controller, money parsing, serialization,
// allocation/lock helpers and audit repository all execute their production code.
// This adapter stages changes and commits only a successful transaction. It does
// not establish PostgreSQL locking/FK/rollback evidence (owned E2E does that).
function harness(seedQuotes = false) {
  let committed = {
    customers: [customer()],
    quotes: seedQuotes ? [quote('q1'), quote('q2')] : [] as StoredQuote[],
    items: seedQuotes ? [item('i1', 'q1'), item('i2', 'q2')] : [] as StoredItem[],
    audits: [] as Array<Prisma.AuditLogUncheckedCreateInput>,
  };
  const writes: string[] = [];
  let failAudit = false;
  type State = typeof committed;
  function client(state: State, scope: 'root' | 'tx') {
    function hydrate(id: string) {
      const row = state.quotes.find((candidate) => candidate.id === id);
      if (!row) return null;
      return structuredClone({
        ...row, customer: state.customers.find((candidate) => candidate.id === row.customerId),
        items: state.items.filter((candidate) => candidate.quoteId === id), order: null,
      });
    }
    return {
      $queryRaw: async (strings: TemplateStringsArray) => (
        strings.join('').includes('maximum') ? [{ maximum: '2' }] : [{ locked: 1 }]
      ),
      customer: {
        findUnique: async ({ where }: { where: { id: string } }) => (
          structuredClone(state.customers.find((row) => row.id === where.id) ?? null)
        ),
        upsert: async ({ where, create, update }: {
          where: { email: string }; create: CustomerData; update: Partial<CustomerData>;
        }) => {
          writes.push(`${scope}:customer.upsert`);
          let row = state.customers.find((candidate) => candidate.email === where.email);
          if (row) Object.assign(row, update);
          else {
            row = { ...customer(create.id), ...create };
            state.customers.push(row);
          }
          return structuredClone(row);
        },
      },
      quote: {
        findUnique: async ({ where }: { where: { id: string } }) => hydrate(where.id),
        findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
          const row = hydrate(where.id);
          if (!row) throw new Error('missing quote');
          return row;
        },
        create: async ({ data }: {
          data: Partial<StoredQuote> & { id: string; items: { create: Omit<ItemData, 'quoteId'>[] } };
        }) => {
          writes.push(`${scope}:quote.create`);
          if (data.items.create.some((row) => row.productId !== 'product')) {
            throw new Error('invalid product relation');
          }
          const { items, ...fields } = data;
          state.quotes.push({ ...quote(data.id), ...fields });
          state.items.push(...items.create.map((row) => ({
            ...row, quoteId: data.id, createdAt: now, updatedAt: now,
          })));
          return hydrate(data.id);
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<StoredQuote> }) => {
          writes.push(`${scope}:quote.update`);
          Object.assign(state.quotes.find((row) => row.id === where.id)!, data);
          return hydrate(where.id);
        },
      },
      quoteItem: {
        update: async ({ where, data }: { where: { id: string }; data: Partial<ItemData> }) => {
          writes.push(`${scope}:quoteItem.update`);
          const row = state.items.find((candidate) => candidate.id === where.id);
          if (!row) throw new Error('missing item');
          Object.assign(row, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)));
          return structuredClone(row);
        },
        create: async ({ data }: { data: ItemData }) => {
          writes.push(`${scope}:quoteItem.create`);
          state.items.push({ ...data, createdAt: now, updatedAt: now });
          return data;
        },
        aggregate: async ({ where }: { where: { quoteId: string } }) => ({
          _sum: { totalPrice: state.items.filter((row) => row.quoteId === where.quoteId)
            .reduce((sum, row) => sum + (row.totalPrice ?? 0), 0) },
        }),
      },
      auditLog: {
        create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => {
          writes.push(`${scope}:auditLog.create`);
          if (failAudit) throw new Error('audit unavailable');
          state.audits.push(structuredClone(data));
          return data;
        },
      },
    };
  }
  // Root writes are durable immediately; transaction writes are staged. This
  // distinction exposes the original customer upsert outside $transaction.
  const prisma = {
    customer: {
      findUnique: async (args: { where: { id: string } }) => client(committed, 'root').customer.findUnique(args),
      upsert: async (args: Parameters<ReturnType<typeof client>['customer']['upsert']>[0]) => (
        client(committed, 'root').customer.upsert(args)
      ),
    },
    $transaction: async (operation: (tx: ReturnType<typeof client>) => Promise<unknown>) => {
      const pending = structuredClone(committed);
      const result = await operation(client(pending, 'tx'));
      committed = pending;
      return result;
    },
  } as unknown as PrismaService;
  const audit = new PrismaAuditRepository(prisma, new RequestContextService());
  return {
    controller: new AdminOperationsController(prisma, audit), writes,
    snapshot: () => structuredClone(committed),
    failAudit: () => { failAudit = true; },
  };
}

function createBody() {
  return {
    customer: {
      fullName: ' Updated Customer ', email: ' CUSTOMER@EXAMPLE.INVALID ',
      marketingConsent: true, dataTreatmentConsent: true,
    },
    items: [{ productId: 'product', quantity: 2, unitPrice: '12.50' }],
  };
}

describe('EX-07.4 quote integrity', () => {
  for (const invalidId of ['i2', 'unknown']) {
    it(`rejects ${invalidId} on Q1 before item, quote or audit writes`, async () => {
      const h = harness(true);
      const before = h.snapshot();
      // A valid write placed first must not execute before ownership preflight.
      await assert.rejects(h.controller.priceQuoteItems('q1', { items: [
        { id: 'i1', unitPrice: '15', quantity: 3 },
        { id: invalidId, unitPrice: '99', quantity: 4 },
      ] }, actor, '127.0.0.1'), BadRequestException);
      assert.deepEqual(h.snapshot(), before);
      assert.deepEqual(h.writes, []);
    });
  }

  it('does not create a new item before a later cross-quote ID is rejected', async () => {
    const h = harness(true);
    const before = h.snapshot();
    await assert.rejects(h.controller.priceQuoteItems('q1', { items: [
      { productId: 'product', nameSnapshot: 'New item', unitPrice: 2, quantity: 2 },
      { id: 'i2', unitPrice: 3 },
    ] }, actor, '127.0.0.1'), BadRequestException);
    assert.deepEqual(h.snapshot(), before);
    assert.deepEqual(h.writes, []);
  });

  it('preserves own-item pricing, addition, totals and audit', async () => {
    const h = harness(true);
    const q2 = h.snapshot().quotes[1];
    const result = await h.controller.priceQuoteItems('q1', { items: [
      { id: 'i1', unitPrice: '12.50', quantity: 3, notes: 'Priced' },
      { productId: 'product', nameSnapshot: 'New item', unitPrice: '5', quantity: 2 },
    ] }, actor, '127.0.0.1');
    assert.equal(result.subtotal, '47.50');
    assert.equal(result.status, 'quoted');
    assert.equal(result.items.find((row) => row.id === 'i1')?.totalPrice, '37.50');
    const state = h.snapshot();
    assert.deepEqual(state.quotes[1], q2);
    assert.equal(state.items.find((row) => row.id === 'i2')?.totalPrice, 20);
    assert.equal(state.audits.length, 1);
    assert.equal(state.audits[0].action, 'quote.items_priced');
    assert.equal(state.audits[0].entityId, 'q1');
  });

  it('does not upsert a customer when quantity validation rejects creation', async () => {
    const h = harness();
    const before = h.snapshot();
    const body = createBody();
    body.items[0].quantity = 0;
    await assert.rejects(h.controller.createQuote(body, actor, '127.0.0.1'), BadRequestException);
    assert.deepEqual(h.snapshot(), before);
    assert.deepEqual(h.writes, []);
  });

  for (const existing of [true, false]) {
    for (const failure of ['relation', 'audit']) {
      it(`rolls back ${existing ? 'existing' : 'new'} customer upsert on ${failure} failure`, async () => {
        const h = harness();
        const before = h.snapshot();
        const body = createBody();
        if (!existing) body.customer.email = 'new@example.invalid';
        if (failure === 'relation') body.items[0].productId = 'missing-product';
        else h.failAudit();
        await assert.rejects(h.controller.createQuote(body, actor, '127.0.0.1'),
          new RegExp(failure === 'relation' ? 'invalid product relation' : 'audit unavailable'));
        assert.deepEqual(h.snapshot(), before);
        assert.equal(h.writes[0], 'tx:customer.upsert');
        assert.equal(h.writes.includes('root:customer.upsert'), false);
        assert.equal(h.writes.includes('tx:quote.create'), true);
        assert.equal(h.writes.includes('tx:auditLog.create'), failure === 'audit');
      });
    }
  }

  it('commits normalized customer consent, quote and audit together', async () => {
    const h = harness();
    const result = await h.controller.createQuote(createBody(), actor, '127.0.0.1');
    assert.equal(result.subtotal, '25.00');
    assert.equal(result.status, 'quoted');
    const state = h.snapshot();
    assert.equal(state.customers.length, 1);
    assert.equal(state.customers[0].fullName, 'Updated Customer');
    assert.equal(state.customers[0].email, 'customer@example.invalid');
    assert.equal(state.customers[0].marketingConsent, true);
    assert.equal(state.customers[0].dataTreatmentConsent, true);
    assert.equal(state.quotes[0].customerId, 'customer');
    assert.equal(state.items[0].totalPrice, 25);
    assert.equal(state.audits[0].action, 'quote.created');
    assert.equal(state.audits[0].entityId, result.id);
    assert.deepEqual(h.writes, ['tx:customer.upsert', 'tx:quote.create', 'tx:auditLog.create']);
  });

  it('uses a customerId without altering its stored consent or profile', async () => {
    const h = harness();
    const before = h.snapshot().customers;
    await h.controller.createQuote({ customerId: 'customer', items: createBody().items }, actor, '127.0.0.1');
    assert.deepEqual(h.snapshot().customers, before);
    assert.deepEqual(h.writes, ['tx:quote.create', 'tx:auditLog.create']);
  });
});
