import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';
import { AUDIT_REPOSITORY } from 'src/modules/auth/domain/repositories/audit.repository';
import type { AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';

// Orchestrator's first run: F1 harness failure, F2 actual failure, F3-F5 hook failures.
// Harness correction below: subsequent E2E NOT_TESTED. Run only on owned,
// disposable PostgreSQL/Redis: resetDatabase() truncates the isolated database.
// F2 follows A5's approved-content immutability contract; F3 remains BLOCKED_DECISION.
// Original ce807e3 has approval/audit defects; see the report for successive run results.
// No skips/todos or mocked HTTP/DB. F5 injects only failure at the real audit boundary.
// F1 exercises the existing public /content read, NOT a FooterRevision projection:
// no public footer route exists at this base; positive storefront consumption is BLOCKED_SCOPE.
const adminFooter = '/api/v1/admin/content/footer';
const publicContent = '/api/v1/content';
const validHref = '/politica-de-privacidad';

function groups(label: string, href = validHref) {
  return [{ title: 'EX074 synthetic footer', links: [{ label, href, isVisible: true }] }];
}

describe('EX-07.4 footer version and public-read invariants', { concurrency: false }, () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let token: string;
  let viewerToken: string;
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;

  function assertIsolatedTarget() {
    assert.equal(process.env.CI, 'true');
    assert.equal(process.env.NODE_ENV, 'test');
    assert.equal(process.env.APP_ENV, 'test');
    const { validateTestEnvironment } = require('../../scripts/ci/assert-test-environment') as {
      validateTestEnvironment: (env: NodeJS.ProcessEnv) => { ok: boolean; failures: string[] };
    };
    const target = validateTestEnvironment(process.env);
    assert.equal(target.ok, true, target.failures.join('; '));
  }

  before(async () => {
    assertIsolatedTarget();
    await resetDatabase();
    seeded = await seedBaseData();
    ({ app, http } = await createTestApp());
    token = (await loginAsAdmin(http, seeded.users.adminEmail,
      seeded.users.adminPassword, seeded.users.twoFactorSecret)).accessToken;
    viewerToken = (await loginAsAdmin(http, seeded.users.viewerEmail,
      seeded.users.viewerPassword, seeded.users.twoFactorSecret)).accessToken;
    assert.equal(typeof token, 'string');
    assert.equal(typeof viewerToken, 'string');
  });

  beforeEach(async () => {
    assertIsolatedTarget();
    // Preserve authenticated users/sessions and login only once, as in admin-operations.
    // A DB reset does not clear the live app's five-per-minute auth throttler.
    await prisma.$transaction([
      prisma.footerLink.deleteMany(),
      prisma.footerRevision.deleteMany(),
      prisma.auditLog.deleteMany({ where: { entityType: 'footerRevision' } }),
    ]);
  });

  after(async () => {
    if (app) await app.close();
    await disconnectDatabase();
  });

  async function footerState() {
    return prisma.footerRevision.findMany({
      orderBy: { id: 'asc' },
      include: { links: { orderBy: { id: 'asc' } } },
    });
  }

  async function readState() {
    const [revisions, content, audit, outbox] = await Promise.all([
      footerState(),
      prisma.contentBlock.findMany({ orderBy: { id: 'asc' } }),
      prisma.auditLog.findMany({ where: { entityType: 'footerRevision' }, orderBy: { id: 'asc' } }),
      prisma.domainEventOutbox.findMany({ orderBy: { eventId: 'asc' } }),
    ]);
    return { revisions, content, audit, outbox };
  }

  async function createDraft(label: string) {
    const response = await http.post(adminFooter)
      .set('Authorization', `Bearer ${token}`).send({ groups: groups(label) });
    assert.equal(response.status, 201);
    assert.equal(response.body.status, 'draft');
    assert.equal(typeof response.body.id, 'string');
    const row = await prisma.footerRevision.findUniqueOrThrow({
      where: { id: response.body.id as string }, include: { links: true },
    });
    assert.equal(row.status, 'draft');
    assert.equal(row.links[0].label, label);
    return row;
  }

  async function approve(id: string) {
    const review = await http.post(`${adminFooter}/${id}/submit-review`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(review.status, 201);
    assert.equal(review.body.status, 'pending_legal_review');
    const pending = await footerState();
    assert.equal((await http.post(`${adminFooter}/${id}/publish`)
      .set('Authorization', `Bearer ${token}`)).status, 400);
    assert.deepEqual(await footerState(), pending);
    const approved = await http.post(`${adminFooter}/${id}/approve`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(approved.status, 201);
    const row = await prisma.footerRevision.findUniqueOrThrow({ where: { id } });
    assert.equal(row.status, 'approved');
    assert.ok(row.approvedAt);
    assert.equal(row.approvedById, seeded.users.adminUserId);
  }

  async function publish(id: string) {
    const response = await http.post(`${adminFooter}/${id}/publish`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(response.status, 201);
    assert.equal(response.body.status, 'published');
  }

  it('F1 P1: public content reads do not create footer rows or expose a draft', async () => {
    const empty = await readState();
    assert.equal(empty.revisions.length, 0);
    const firstRead = await http.get(publicContent).query({ placementKey: 'footer' });
    assert.equal(firstRead.status, 200);
    assert.ok(Array.isArray(firstRead.body.data));
    assert.deepEqual(await readState(), empty, 'First public read must not bootstrap a draft');

    const draftLabel = 'EX074_PRIVATE_DRAFT_MARKER';
    const draft = await createDraft(draftLabel);
    const baseline = await readState();
    // Check both the filtered public read and the unfiltered public content list.
    for (const query of [{ placementKey: 'footer' }, {}]) {
      const response = await http.get(publicContent).query(query);
      assert.equal(response.status, 200);
      assert.ok(Array.isArray(response.body.data));
      assert.equal(JSON.stringify(response.body).includes(draftLabel), false);
      assert.equal(JSON.stringify(response.body).includes(draft.id), false);
    }
    assert.deepEqual(await readState(), baseline, 'Public reads must leave persisted state unchanged');
    assert.equal((await http.get(adminFooter)).status, 401);
    assert.equal((await http.get(adminFooter)
      .set('Authorization', `Bearer ${viewerToken}`)).status, 403);
    assert.deepEqual(await footerState(), baseline.revisions);
  });

  it('F2 P1: keeps approved content immutable and requires independent approval for a new revision', async () => {
    const draft = await createDraft('EX074 original reviewed text');
    const beforeDenied = await footerState();
    for (const bearer of [undefined, viewerToken]) {
      const request = http.post(`${adminFooter}/${draft.id}/publish`);
      if (bearer) request.set('Authorization', `Bearer ${bearer}`);
      assert.equal((await request).status, bearer ? 403 : 401);
    }
    assert.deepEqual(await footerState(), beforeDenied);
    assert.equal((await http.post(`${adminFooter}/${draft.id}/publish`)
      .set('Authorization', `Bearer ${token}`)).status, 400);
    assert.deepEqual(await footerState(), beforeDenied);
    await approve(draft.id);
    const approvedState = await readState();
    const original = approvedState.revisions.find((revision) => revision.id === draft.id);
    assert.ok(original);
    const edited = await http.patch(`${adminFooter}/${draft.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ groups: groups('EX074 new unreviewed text') });
    assert.equal(edited.status, 400, 'Approved content is immutable; changes require a new revision');
    assert.deepEqual(await readState(), approvedState,
      'Rejected edit must preserve payload, links, status, approval metadata and audit');

    await publish(draft.id);
    const publishedOriginal = (await footerState()).find((revision) => revision.id === draft.id);
    assert.ok(publishedOriginal);
    assert.equal(publishedOriginal.status, 'published');
    assert.deepEqual(publishedOriginal.groupsJson, original.groupsJson);
    assert.deepEqual(publishedOriginal.links, original.links);
    assert.equal(publishedOriginal.version, original.version);
    assert.deepEqual(publishedOriginal.approvedAt, original.approvedAt);
    assert.equal(publishedOriginal.approvedById, original.approvedById);
    assert.equal(await prisma.auditLog.count({
      where: { action: 'footer.published', entityId: draft.id },
    }), 1);

    const replacement = await createDraft('EX074 new unreviewed text');
    assert.notEqual(replacement.id, original.id);
    assert.ok(replacement.version > original.version);
    assert.equal(replacement.approvedAt, null);
    assert.equal(replacement.approvedById, null);
    const unapprovedState = await readState();
    const denied = await http.post(`${adminFooter}/${replacement.id}/publish`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(denied.status, 400, 'Approval must cover the exact content that becomes public');
    assert.deepEqual(await readState(), unapprovedState);
    assert.equal(await prisma.auditLog.count({
      where: { action: 'footer.published', entityId: replacement.id },
    }), 0);
    // approve() also verifies that pending review cannot be published.
    await approve(replacement.id);
    await publish(replacement.id);
    const final = await footerState();
    const publishedReplacement = final.find((revision) => revision.id === replacement.id);
    assert.ok(publishedReplacement);
    assert.equal(publishedReplacement.status, 'published');
    assert.deepEqual(publishedReplacement.groupsJson, replacement.groupsJson);
    assert.equal(publishedReplacement.approvedById, seeded.users.adminUserId);
    assert.ok(publishedReplacement.approvedAt);
    assert.equal(final.find((revision) => revision.id === draft.id)?.status, 'archived');
    assert.equal(await prisma.auditLog.count({
      where: { action: 'footer.published', entityId: replacement.id },
    }), 1);
  });

  it('F3 P2: accepts a real internal page and rejects dangerous or nonexistent routes without writes', async () => {
    assert.equal(existsSync(resolve(process.cwd(), 'frontend/src/app/politica-de-privacidad/page.tsx')), true);
    const draft = await createDraft('EX074 valid internal page');
    assert.equal(draft.links[0].href, validHref);
    // Deliberately syntactically valid but absent from the current storefront routes.
    const missing = '/ex074-route-that-does-not-exist';
    assert.equal(existsSync(resolve(process.cwd(), `frontend/src/app${missing}/page.tsx`)), false);
    for (const href of ['#', 'javascript:alert(1)', 'https://example.invalid', '//example.invalid', missing]) {
      const baseline = await readState();
      const created = await http.post(adminFooter).set('Authorization', `Bearer ${token}`)
        .send({ groups: groups('EX074 invalid link', href) });
      assert.equal(created.status, 400, `Create must reject ${href}`);
      assert.deepEqual(await readState(), baseline);
      const edited = await http.patch(`${adminFooter}/${draft.id}`)
        .set('Authorization', `Bearer ${token}`).send({ groups: groups('EX074 invalid edit', href) });
      assert.equal(edited.status, 400, `Edit must reject ${href}`);
      assert.deepEqual(await readState(), baseline);
    }
  });

  it('F4 P1: publishing a replacement archives the previous revision and preserves its content', async () => {
    const first = await createDraft('EX074 published original');
    await approve(first.id);
    await publish(first.id);
    const original = await prisma.footerRevision.findUniqueOrThrow({
      where: { id: first.id }, include: { links: { orderBy: { id: 'asc' } } },
    });
    const replacement = await createDraft('EX074 published replacement');
    assert.ok(replacement.version > first.version);
    await approve(replacement.id);
    await publish(replacement.id);
    const old = await prisma.footerRevision.findUniqueOrThrow({
      where: { id: first.id }, include: { links: { orderBy: { id: 'asc' } } },
    });
    assert.equal(old.status, 'archived');
    assert.deepEqual(old.groupsJson, original.groupsJson);
    assert.deepEqual(old.links, original.links);
    assert.deepEqual(old.publishedAt, original.publishedAt);
    const published = await prisma.footerRevision.findMany({ where: { status: 'published' } });
    assert.equal(published.length, 1);
    assert.equal(published[0].id, replacement.id);
    assert.equal(published[0].publishedById, seeded.users.adminUserId);
    assert.ok(published[0].publishedAt);
    const view = await http.get(adminFooter).set('Authorization', `Bearer ${token}`);
    assert.equal(view.status, 200);
    assert.equal(view.body.published.id, replacement.id);
    const baseline = await footerState();
    for (const id of [first.id, replacement.id]) {
      assert.equal((await http.patch(`${adminFooter}/${id}`).set('Authorization', `Bearer ${token}`)
        .send({ groups: groups('EX074 forbidden edit') })).status, 400);
      assert.equal((await http.post(`${adminFooter}/${id}/publish`)
        .set('Authorization', `Bearer ${token}`)).status, 400);
    }
    assert.deepEqual(await footerState(), baseline);
    for (const id of [first.id, replacement.id]) {
      assert.equal(await prisma.auditLog.count({ where: { action: 'footer.published', entityId: id } }), 1);
    }
  });

  it('F5 P1: audit failure rolls back publication and archival, then a clean retry succeeds', async (t) => {
    const first = await createDraft('EX074 audit previous public text');
    await approve(first.id);
    await publish(first.id);
    const replacement = await createDraft('EX074 audit replacement text');
    await approve(replacement.id);
    const baseline = await readState();
    const audit = app.get<AuditRepository>(AUDIT_REPOSITORY);
    const originalWrite = audit.write.bind(audit);
    let injected = 0;
    const injection = t.mock.method(audit, 'write', async (...args: Parameters<AuditRepository['write']>) => {
      if (args[0].action === 'footer.published' && args[0].entityId === replacement.id) {
        injected += 1;
        throw new Error('EX074_SYNTHETIC_AUDIT_FAILURE');
      }
      return originalWrite(...args);
    });
    try {
      const response = await http.post(`${adminFooter}/${replacement.id}/publish`)
        .set('Authorization', `Bearer ${token}`);
      assert.equal(response.status, 500);
      assert.equal(injected, 1, 'The request must reach the intended audit failure');
      // Expected RED: base has already archived first and published replacement.
      assert.deepEqual(await readState(), baseline, 'Audit failure must roll back the entire publication');
    } finally {
      injection.mock.restore();
    }
    await publish(replacement.id);
    assert.equal((await prisma.footerRevision.findUniqueOrThrow({ where: { id: first.id } })).status, 'archived');
    assert.equal(await prisma.footerRevision.count({ where: { status: 'published' } }), 1);
    assert.equal(await prisma.auditLog.count({
      where: { action: 'footer.published', entityId: replacement.id },
    }), 1);
  });
});
