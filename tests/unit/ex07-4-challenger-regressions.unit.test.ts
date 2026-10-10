import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import type { Customer, Prisma, Quote } from '@prisma/client';
import { RequestContextService } from 'src/common/request/request-context.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AdminOperationsController } from 'src/modules/admin-operations/infrastructure/http/controllers/admin-operations.controller';
import { PrismaAuditRepository } from 'src/modules/auth/infrastructure/repositories/prisma-audit.repository';

type StoredQuote = Omit<Quote, 'subtotal'> & { subtotal: number };
const now = new Date('2026-10-10T00:00:00Z');
const actor = { sub: 'operator', email: 'operator@example.invalid', role: 'admin',
  permissions: ['quotes.write', 'customers.notes.write'], sessionId: 'session' };
const originalCustomer: Customer = {
  id: 'customer', fullName: 'Original Customer', email: 'customer@example.invalid', phone: '00000007411',
  documentType: null, documentNumber: null, defaultAddress: 'Synthetic address', city: null,
  department: null, country: 'CO', marketingConsent: false, dataTreatmentConsent: false,
  lastOrderAt: null, createdAt: now, updatedAt: now,
};
const originalQuote: StoredQuote = {
  id: 'quote', quoteNumber: 'QTE-000001', customerId: 'customer', orderId: null,
  status: 'requested', subtotal: 10, currency: 'COP', notes: null, internalNotes: null,
  expiresAt: null, sentAt: null, acceptedAt: null, rejectedAt: null, convertedAt: null,
  createdById: actor.sub, updatedById: actor.sub, createdAt: now, updatedAt: now,
};

// Controller, serializers, transaction helper and audit sanitization are real.
// Only persistence is replaced. Root writes commit immediately; tx writes are
// staged until the callback succeeds. This is not PostgreSQL rollback evidence.
function harness(failure?: 'audit-before' | 'audit-after' | 'event-before' | 'event-after', status: Quote['status'] = 'requested') {
  let committed = { customer: structuredClone(originalCustomer), quote: { ...structuredClone(originalQuote), status },
    audits: [] as Prisma.AuditLogUncheckedCreateInput[], events: [] as Prisma.NotificationEventUncheckedCreateInput[] };
  type State = typeof committed;
  const revisions = Array.from({ length: 22 }, (_, index) => ({
    id: `footer-${index + 1}`, version: index + 1,
    status: index === 0 ? 'published' : 'draft', links: [],
  }));
  function client(state: State) {
    const hydrate = () => structuredClone({ ...state.quote, customer: state.customer, items: [], order: null });
    return {
      $queryRaw: async () => [{ id: 'locked' }],
      customer: {
        findUnique: async () => structuredClone(state.customer),
        update: async ({ data }: { data: Partial<Customer> }) => {
          Object.assign(state.customer, data); return structuredClone(state.customer);
        },
      },
      quote: {
        findUnique: async () => hydrate(),
        update: async ({ data }: { data: Partial<StoredQuote> }) => {
          Object.assign(state.quote, data); return hydrate();
        },
      },
      auditLog: { create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => {
        if (failure === 'audit-before') throw new Error('audit failure before insert');
        state.audits.push(structuredClone(data));
        if (failure === 'audit-after') throw new Error('audit failure after insert');
        return data;
      } },
      notificationEvent: { create: async ({ data }: { data: Prisma.NotificationEventUncheckedCreateInput }) => {
        if (failure === 'event-before') throw new Error('event failure before insert');
        state.events.push(structuredClone(data));
        if (failure === 'event-after') throw new Error('event failure after insert');
        return data;
      } },
    };
  }
  const prisma = {
    customer: {
      findUnique: async () => client(committed).customer.findUnique(),
      update: async (args: Parameters<ReturnType<typeof client>['customer']['update']>[0]) => client(committed).customer.update(args),
    },
    auditLog: {
      create: async (args: { data: Prisma.AuditLogUncheckedCreateInput }) => client(committed).auditLog.create(args),
      findMany: async () => [],
    },
    notificationEvent: { create: async (args: { data: Prisma.NotificationEventUncheckedCreateInput }) => client(committed).notificationEvent.create(args) },
    footerRevision: {
      findFirst: async (args?: { where?: { status?: string } }) => {
        const rows = revisions.filter((row) => !args?.where?.status || row.status === args.where.status);
        return structuredClone([...rows].sort((a, b) => b.version - a.version)[0] ?? null);
      },
      findMany: async ({ take }: { take: number }) => structuredClone([...revisions].reverse().slice(0, take)),
    },
    $transaction: async (operation: (tx: ReturnType<typeof client>) => Promise<unknown>) => {
      const staged = structuredClone(committed);
      const result = await operation(client(staged));
      committed = staged; return result;
    },
  } as unknown as PrismaService;
  return { controller: new AdminOperationsController(prisma, new PrismaAuditRepository(prisma, new RequestContextService())),
    snapshot: () => structuredClone(committed) };
}

async function withProvider(provider: string | undefined, emailProvider: string | undefined, operation: () => Promise<void>) {
  const before = { notification: process.env.NOTIFICATION_PROVIDER, email: process.env.EMAIL_PROVIDER };
  try {
    if (provider === undefined) delete process.env.NOTIFICATION_PROVIDER;
    else process.env.NOTIFICATION_PROVIDER = provider;
    if (emailProvider === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = emailProvider;
    await operation();
  } finally {
    if (before.notification === undefined) delete process.env.NOTIFICATION_PROVIDER;
    else process.env.NOTIFICATION_PROVIDER = before.notification;
    if (before.email === undefined) delete process.env.EMAIL_PROVIDER;
    else process.env.EMAIL_PROVIDER = before.email;
  }
}

describe('EX-07.4 challenger regressions', { concurrency: false }, () => {
  for (const [provider, email] of [['ex074-unconfigured-provider', undefined], [undefined, 'smtp']] as const) {
    it(`fails closed before quote, audit or event write with unsupported ${provider ?? email}`, async () => {
      await withProvider(provider, email, async () => {
        const h = harness(undefined, 'quoted'); const before = h.snapshot();
        await assert.rejects(h.controller.sendQuote('quote', actor, '127.0.0.1'), ServiceUnavailableException);
        assert.deepEqual(h.snapshot(), before);
      });
    });
  }
  for (const failure of ['event-before', 'event-after', 'audit-after'] as const) {
    it(`rolls back the manual-send transition, audit and event on ${failure}`, async () => {
      await withProvider('none', undefined, async () => {
        const h = harness(failure); const before = h.snapshot();
        await assert.rejects(h.controller.sendQuote('quote', actor, '127.0.0.1'), /failure/);
        assert.deepEqual(h.snapshot(), before);
      });
    });
  }
  it('commits only a manual-send intent with masked recipient and no sent claim', async () => {
    await withProvider('none', undefined, async () => {
      const h = harness();
      const result = await h.controller.sendQuote('quote', actor, '127.0.0.1');
      assert.equal(result.status, 'quoted'); assert.equal(result.sentAt, null);
      assert.equal(result.operationalState.status, 'pending_manual_send');
      const state = h.snapshot();
      assert.equal(state.quote.status, 'quoted'); assert.equal(state.quote.sentAt, null);
      assert.equal(state.audits.length, 1); assert.equal(state.audits[0].action, 'quote.manual_send_required');
      assert.equal(state.events.length, 1); assert.equal(state.events[0].status, 'skipped_provider_not_configured');
      assert.equal(state.events[0].provider, 'none');
      assert.equal(state.events[0].recipientMasked, result.customer.email);
      assert.equal(JSON.stringify(state.audits).includes(originalCustomer.email), false);
    });
  });
  for (const failure of ['audit-before', 'audit-after'] as const) {
    it(`rolls back customer profile, consent and audit on ${failure}`, async () => {
      const h = harness(failure); const before = h.snapshot();
      await assert.rejects(h.controller.updateCustomer('customer', {
        fullName: 'Changed Customer', marketingConsent: true, dataTreatmentConsent: true,
      }, actor, '127.0.0.1'), /audit failure/);
      assert.deepEqual(h.snapshot(), before);
    });
  }
  it('commits a normalized customer update with consent and redacted audit', async () => {
    const h = harness();
    const result = await h.controller.updateCustomer('customer', {
      fullName: ' Changed Customer ', email: ' CHANGED@EXAMPLE.INVALID ', marketingConsent: true, dataTreatmentConsent: true,
    }, actor, '127.0.0.1');
    const state = h.snapshot();
    assert.equal(state.customer.fullName, 'Changed Customer'); assert.equal(state.customer.email, 'changed@example.invalid');
    assert.equal(state.customer.marketingConsent, true); assert.equal(state.customer.dataTreatmentConsent, true);
    assert.notEqual(result.email, state.customer.email); assert.notEqual(result.fullName, state.customer.fullName);
    assert.equal(state.audits.length, 1); assert.equal(state.audits[0].action, 'customer.updated');
    for (const data of [state.audits[0].beforeData, state.audits[0].afterData]) {
      const fields = data as { fullName: string; email: string; phone: string };
      assert.equal(fields.fullName, '[REDACTED]'); assert.equal(fields.email, '[REDACTED]'); assert.equal(fields.phone, '[REDACTED]');
    }
  });
  it('retains the current publication with more than twenty newer drafts while bounding history', async () => {
    const result = await harness().controller.getFooterContent();
    assert.equal(result.history.length, 20); assert.equal(result.data?.version, 22);
    assert.equal(result.history.some((revision) => revision.status === 'published'), false);
    assert.equal(result.published?.id, 'footer-1'); assert.equal(result.published?.status, 'published');
  });
});
