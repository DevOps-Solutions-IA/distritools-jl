import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import type { FooterRevisionStatus, Prisma } from '@prisma/client';
import { PERMISSIONS_KEY } from 'src/common/constants/auth.constants';
import { RequestContextService } from 'src/common/request/request-context.service';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { AdminOperationsController } from 'src/modules/admin-operations/infrastructure/http/controllers/admin-operations.controller';
import { PrismaAuditRepository } from 'src/modules/auth/infrastructure/repositories/prisma-audit.repository';

const actor = { sub: 'operator', email: 'operator@example.invalid', role: 'admin', permissions: ['footer.write', 'footer.publish'], sessionId: 'session' };
const groups = (href = '/politica-de-privacidad') => [{ title: 'Synthetic footer', links: [{ label: 'Destination', href }] }];
const now = new Date('2026-10-10T00:00:00Z');
type Revision = { id: string; version: number; status: string; groupsJson: ReturnType<typeof groups>; links: unknown[]; submittedAt: Date | null; approvedAt: Date | null; submittedById: string | null; approvedById: string | null };

// Actual controller/resolver/audit; only the persistence boundary is replaced.
// Tx staging proves callback boundaries, not PostgreSQL lock or rollback behavior.
function harness(status = 'draft', href = '/politica-de-privacidad', failure = false) {
  let committed = { revisions: [{ id: 'revision', version: 1, status, groupsJson: groups(href), links: [], submittedAt: null, approvedAt: null, submittedById: null, approvedById: null }] as Revision[], audits: [] as Prisma.AuditLogUncheckedCreateInput[] };
  let active = true;
  const reads: string[] = [];
  const queryOptions: unknown[] = [];
  const alerts = [{ id: 'alert', createdAt: now, afterData: { version: 1, fingerprint: 'private-fingerprint', invalidLinks: [{ linkId: 'link', reason: 'inactive' }], secret: 'must-not-leak' } }];
  function client(state: typeof committed) {
    const resource = { findUnique: async ({ where }: { where: { slug: string } }) => {
      reads.push(where.slug); return where.slug === 'synthetic' ? { id: 'resource', slug: 'synthetic', isActive: active } : null;
    } };
    return {
      $executeRaw: async () => { reads.push('footer-lock'); return 1; },
      product: resource, category: resource, brand: resource,
      footerLink: { deleteMany: async () => { reads.push('delete-links'); return { count: 0 }; } },
      footerRevision: {
        count: async () => state.revisions.length,
        findUnique: async ({ where }: { where: { id: string } }) => structuredClone(state.revisions.find((r) => r.id === where.id) ?? null),
        findFirst: async (args?: { where?: { status: string } }) => structuredClone(state.revisions.find((r) => !args?.where || r.status === args.where.status) ?? null),
        findMany: async () => structuredClone(state.revisions),
        create: async ({ data }: { data: Revision }) => { const r = { ...structuredClone(data), links: [] }; state.revisions.push(r); return r; },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Revision> }) => { const r = state.revisions.find((r) => r.id === where.id)!; Object.assign(r, data); return structuredClone(r); },
        updateMany: async ({ where, data }: { where: { status: string }; data: Partial<Revision> }) => { state.revisions.filter((r) => r.status === where.status).forEach((r) => Object.assign(r, data)); return { count: 1 }; },
      },
      auditLog: {
        create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => { state.audits.push(structuredClone(data)); if (failure) throw new Error('synthetic audit failure after insert'); return data; },
        findMany: async (args: unknown) => { queryOptions.push(args); return structuredClone(alerts); },
      },
    };
  }
  const root = client(committed);
  const prisma = { ...root, $transaction: async (operation: (tx: ReturnType<typeof client>) => Promise<unknown>) => {
    const staged = structuredClone(committed); const result = await operation(client(staged)); committed = staged; return result;
  } } as unknown as PrismaService;
  return { controller: new AdminOperationsController(prisma, new PrismaAuditRepository(prisma, new RequestContextService())),
    snapshot: () => structuredClone(committed), deactivate: () => { active = false; }, reads, queryOptions };
}

describe('EX-07.4 approved footer route lifecycle', () => {
  for (const href of ['/route-that-is-not-real', '/productos/missing', '//example.invalid', '/productos/synthetic?x=1', '/productos/%2e%2e']) {
    it(`rejects nonexistent or manipulated ${href} at create/update atomically`, async () => {
      const h = harness(); const before = h.snapshot();
      await assert.rejects(h.controller.createFooterContent({ groups: groups(href) }, actor, '127.0.0.1'), BadRequestException);
      await assert.rejects(h.controller.updateFooterContent('revision', { groups: groups(href) }, actor, '127.0.0.1'), BadRequestException);
      assert.deepEqual(h.snapshot(), before);
    });
  }
  it('rejects malformed groups and excessive link counts with400 before writes', async () => {
    const h = harness(); const before = h.snapshot();
    await assert.rejects(h.controller.createFooterContent({ groups: Array.from({ length: 1001 }, () => ({ title: 'Synthetic group', links: [] })) }, actor, '127.0.0.1'), BadRequestException);
    assert.deepEqual(h.snapshot(), before);
    await assert.rejects(h.controller.createFooterContent(undefined as never, actor, '127.0.0.1'), BadRequestException);
    await assert.rejects(h.controller.updateFooterContent('revision', undefined as never, actor, '127.0.0.1'), BadRequestException);
    await assert.rejects(h.controller.validateFooterContent(undefined as never), BadRequestException);
    assert.deepEqual(h.snapshot(), before);
    for (const invalid of [{ title: 'Malformed', links: null }, { title: 'Too many', links: Array.from({ length: 1001 }, () => ({ label: 'Destination', href: '/politica-de-privacidad' })) }]) {
      await assert.rejects(h.controller.createFooterContent({ groups: [invalid] as unknown as ReturnType<typeof groups> }, actor, '127.0.0.1'), BadRequestException);
      assert.deepEqual(h.snapshot(), before);
    }
  });
  it('validates real static and active dynamic destinations under the footer lock before writes', async () => {
    const h = harness();
    await h.controller.createFooterContent({ groups: groups('/productos/synthetic') }, actor, '127.0.0.1');
    assert.equal(h.reads[0], 'footer-lock'); assert.ok(h.reads.includes('synthetic'));
    assert.equal(h.snapshot().revisions.length, 2); assert.equal(h.snapshot().audits[0].action, 'footer.created');
  });
  for (const operation of ['review', 'publish'] as const) {
    it(`revalidates deactivated dynamic resources before ${operation} with no mutation or audit`, async () => {
      const h = harness(operation === 'publish' ? 'approved' : 'draft', '/productos/synthetic'); h.deactivate(); const before = h.snapshot();
      await assert.rejects(operation === 'publish'
        ? h.controller.footerPublish('revision', actor, '127.0.0.1')
        : h.controller.footerSubmitReview('revision', actor, '127.0.0.1'), BadRequestException);
      assert.deepEqual(h.snapshot(), before); assert.equal(h.reads[0], 'footer-lock');
    });
  }
  for (const operation of ['create', 'update', 'review', 'publish'] as const) {
    it(`rolls back ${operation} and an inserted audit on audit failure`, async () => {
      const h = harness(operation === 'publish' ? 'approved' : 'draft', '/politica-de-privacidad', true); const before = h.snapshot();
      const action = operation === 'create' ? h.controller.createFooterContent({ groups: groups() }, actor, '127.0.0.1')
        : operation === 'update' ? h.controller.updateFooterContent('revision', { groups: groups() }, actor, '127.0.0.1')
          : operation === 'review' ? h.controller.footerSubmitReview('revision', actor, '127.0.0.1')
            : h.controller.footerPublish('revision', actor, '127.0.0.1');
      await assert.rejects(action, /audit failure/); assert.deepEqual(h.snapshot(), before);
    });
  }
  it('preserves the existing audited archival of a published revision with an invalid route', async () => {
    const h = harness('published', '/no-longer-existing-route');
    const archive = Reflect.get(h.controller, 'setFooterWorkflow') as (id: string, user: typeof actor, status: FooterRevisionStatus) => Promise<unknown>;
    await archive.call(h.controller, 'revision', actor, 'archived');
    assert.equal(h.snapshot().revisions[0].status, 'archived');
    assert.equal(h.snapshot().audits[0].action, 'footer.archived');
  });
  it('input validation accepts a real destination without business or audit writes', async () => {
    const h = harness(); const before = h.snapshot();
    const method = (h.controller as AdminOperationsController & { validateFooterContent: (body: { groups: ReturnType<typeof groups> }) => Promise<unknown> }).validateFooterContent;
    assert.equal(typeof method, 'function');
    assert.deepEqual(await method.call(h.controller, { groups: groups() }), { valid: true });
    assert.deepEqual(h.snapshot(), before);
    await assert.rejects(method.call(h.controller, { groups: groups('/not-a-route') }), BadRequestException);
    assert.deepEqual(h.snapshot(), before);
    assert.deepEqual(Reflect.getMetadata(PERMISSIONS_KEY, method), ['footer.write']);
  });
  it('returns bounded safe durable alerts and requires a new review for the current publication', async () => {
    const h = harness('published'); const before = h.snapshot();
    const result = await h.controller.getFooterContent() as Awaited<ReturnType<AdminOperationsController['getFooterContent']>> & { routeAlerts: unknown[]; requiresReview: boolean };
    assert.equal(result.requiresReview, true); assert.equal(result.routeAlerts.length, 1);
    assert.deepEqual(result.routeAlerts[0], { id: 'alert', createdAt: now, version: 1, invalidLinks: [{ linkId: 'link', reason: 'inactive' }] });
    assert.deepEqual(h.queryOptions[0], { where: { action: 'footer.route_invalidated', entityType: 'footerRevision', entityId: 'revision' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 20, select: { id: true, createdAt: true, afterData: true } });
    assert.deepEqual(h.snapshot(), before);
  });
  it('accepts the real catalog category and brand query filters after resolving both resources', async () => {
    const h = harness(); const href = '/productos?category=synthetic&brand=synthetic'; const before = h.snapshot();
    assert.deepEqual(await h.controller.validateFooterContent({ groups: groups(href) }), { valid: true });
    assert.deepEqual(h.snapshot(), before);
    await h.controller.createFooterContent({ groups: groups(href) }, actor, '127.0.0.1');
    assert.equal(h.snapshot().revisions.at(-1)?.groupsJson[0].links[0].href, href);
    assert.equal(h.snapshot().audits[0].action, 'footer.created');
    assert.equal(h.reads.filter((read) => read === 'synthetic').length, 4, 'Both query references must resolve at input and save');
  });
  for (const operation of ['create', 'update', 'review', 'publish'] as const) {
    it(`rejects a deactivated category or brand query reference before ${operation} without partial writes`, async () => {
      const href = '/productos?category=synthetic&brand=synthetic';
      const h = harness(operation === 'publish' ? 'approved' : 'draft', href); h.deactivate(); const before = h.snapshot();
      const action = operation === 'create' ? h.controller.createFooterContent({ groups: groups(href) }, actor, '127.0.0.1')
        : operation === 'update' ? h.controller.updateFooterContent('revision', { groups: groups(href) }, actor, '127.0.0.1')
          : operation === 'review' ? h.controller.footerSubmitReview('revision', actor, '127.0.0.1')
            : h.controller.footerPublish('revision', actor, '127.0.0.1');
      await assert.rejects(action, BadRequestException); assert.deepEqual(h.snapshot(), before);
    });
  }

  for (const query of ['taladro inalambrico', 'taladro inalámbrico']) {
    it(`accepts the real URLSearchParams encoding for the search query ${query}`, async () => {
      const h = harness(); const href = `/buscar?${new URLSearchParams({ q: query })}`; const before = h.snapshot();
      assert.deepEqual(await h.controller.validateFooterContent({ groups: groups(href) }), { valid: true });
      assert.deepEqual(h.snapshot(), before);
      await h.controller.createFooterContent({ groups: groups(href) }, actor, '127.0.0.1');
      assert.equal(h.snapshot().revisions.at(-1)?.groupsJson[0].links[0].href, href);
      assert.equal(h.snapshot().audits[0].action, 'footer.created');
    });
  }

});
