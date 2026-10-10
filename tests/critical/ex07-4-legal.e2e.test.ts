import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { v7 as uuidv7 } from 'uuid';
import { AUDIT_REPOSITORY, type AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';

// OLA 1: authored only, NOT_TESTED. Run only after the orchestrator provisions
// owned disposable PostgreSQL/Redis and authorizes the existing reset helper.
// These JSON markers are technical fixtures, never approved legal copy.
describe('EX-07.4 legal publication contracts', { concurrency: false }, () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let adminToken: string;
  let viewerToken: string;
  let audit: AuditRepository;
  const basePath = '/api/v1/admin/content/legal';

  before(async () => {
    // Fail before reset/boot on targets that do not satisfy existing isolation guards.
    assert.equal(process.env.APP_ENV, 'test');
    const { validateTestEnvironment } = require('../../scripts/ci/assert-test-environment') as {
      validateTestEnvironment: (env: NodeJS.ProcessEnv) => { ok: boolean; failures: string[] };
    };
    const isolation = validateTestEnvironment(process.env);
    assert.equal(isolation.ok, true, isolation.failures.join('; '));
    await resetDatabase();
    seeded = await seedBaseData();
    ({ app, http } = await createTestApp());
    audit = app.get<AuditRepository>(AUDIT_REPOSITORY);
    const admin = await loginAsAdmin(http, seeded.users.adminEmail, seeded.users.adminPassword, seeded.users.twoFactorSecret);
    const viewer = await loginAsAdmin(http, seeded.users.viewerEmail, seeded.users.viewerPassword, seeded.users.twoFactorSecret);
    assert.ok(admin.accessToken);
    assert.ok(viewer.accessToken);
    adminToken = admin.accessToken;
    viewerToken = viewer.accessToken;
  });

  after(async () => {
    try {
      if (app) await app.close();
    } finally {
      await disconnectDatabase();
    }
  });

  async function createDraft(
    pageKey = `ex074-a2-${uuidv7()}`,
    content: Record<string, unknown> = { testFixture: 'EX074 A2 publication marker' },
  ): Promise<string> {
    const response = await http.post(basePath).set('Authorization', `Bearer ${adminToken}`).send({
      pageKey, title: 'EX074 A2 technical fixture', slug: pageKey, content, checklist: {},
    });
    assert.equal(response.status, 201);
    assert.equal(response.body.status, 'draft');
    assert.equal(typeof response.body.id, 'string');
    return response.body.id;
  }

  function transition(id: string, step: 'submit-review' | 'approve' | 'publish', body: Record<string, unknown> = {}) {
    return http.post(`${basePath}/${id}/${step}`).set('Authorization', `Bearer ${adminToken}`).send(body);
  }

  async function approveDraft(id: string) {
    assert.equal((await transition(id, 'submit-review')).status, 201);
    assert.equal((await transition(id, 'approve')).status, 201);
    assert.equal((await prisma.legalVersion.findUniqueOrThrow({ where: { id } })).status, 'approved');
  }

  function legalAudits(id: string) {
    return prisma.auditLog.findMany({ where: { entityType: 'legalVersion', entityId: id }, orderBy: { id: 'asc' } });
  }

  it('persists draft -> review -> approved -> published with actor metadata and audits', async () => {
    const id = await createDraft();
    const draft = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
    assert.equal(draft.status, 'draft');
    assert.equal(draft.approvedAt, null);
    assert.equal(draft.publishedAt, null);

    const review = await transition(id, 'submit-review');
    assert.equal(review.status, 201);
    assert.equal(review.body.status, 'pending_legal_review');
    const pending = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
    assert.equal(pending.status, 'pending_legal_review');
    assert.ok(pending.submittedAt);
    assert.equal(pending.submittedById, seeded.users.adminUserId);
    assert.equal(pending.approvedAt, null);

    const approval = await transition(id, 'approve');
    assert.equal(approval.status, 201);
    assert.equal(approval.body.status, 'approved');
    const approved = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
    assert.equal(approved.status, 'approved');
    assert.ok(approved.approvedAt);
    assert.equal(approved.approvedById, seeded.users.adminUserId);
    assert.equal(approved.publishedAt, null);

    const publication = await transition(id, 'publish');
    assert.equal(publication.status, 201);
    assert.equal(publication.body.status, 'published');
    const published = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
    assert.equal(published.status, 'published');
    assert.ok(published.publishedAt);
    assert.equal(published.publishedById, seeded.users.adminUserId);
    assert.deepEqual(published.content, draft.content);
    assert.deepEqual(published.approvedAt, approved.approvedAt);
    const logs = await legalAudits(id);
    assert.deepEqual(logs.map((entry) => entry.action).sort(), [
      'legal.approved', 'legal.created', 'legal.pending_legal_review', 'legal.published',
    ]);
    assert.equal(logs.every((entry) => entry.actorUserId === seeded.users.adminUserId), true);
    assert.equal(await prisma.legalVersion.count({ where: { pageKey: draft.pageKey, status: 'published' } }), 1);
  });

  it('rejects unapproved publication even with override and denies unauthenticated/unauthorized publication without writes', async () => {
    const id = await createDraft();
    for (const state of ['draft', 'pending_legal_review'] as const) {
      if (state === 'pending_legal_review') assert.equal((await transition(id, 'submit-review')).status, 201);
      const beforeRow = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
      assert.equal(beforeRow.status, state);
      const beforeLogs = await legalAudits(id);
      for (const body of [{}, { legalOverride: true }]) {
        assert.equal((await transition(id, 'publish', body)).status, 400);
      }
      assert.deepEqual(await prisma.legalVersion.findUniqueOrThrow({ where: { id } }), beforeRow);
      assert.deepEqual(await legalAudits(id), beforeLogs);
    }

    assert.equal((await transition(id, 'approve')).status, 201);
    assert.equal((await prisma.legalVersion.findUniqueOrThrow({ where: { id } })).status, 'approved');
    const beforeRow = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
    const beforeLogs = await legalAudits(id);
    assert.equal((await http.post(`${basePath}/${id}/publish`).send({ legalOverride: true })).status, 401);
    assert.equal((await http.post(`${basePath}/${id}/publish`)
      .set('Authorization', `Bearer ${viewerToken}`).send({ legalOverride: true })).status, 403);
    assert.deepEqual(await prisma.legalVersion.findUniqueOrThrow({ where: { id } }), beforeRow);
    assert.deepEqual(await legalAudits(id), beforeLogs);
  });

  it('blocks placeholders/incomplete checklist, audits explicit override and rejects non-boolean overrides', async () => {
    const id = await createDraft(undefined, { testFixture: '[RAZÓN SOCIAL PENDIENTE]' });
    await approveDraft(id);
    const beforeRow = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
    const beforeLogs = await legalAudits(id);
    for (const body of [{}, { legalOverride: false }]) {
      assert.equal((await transition(id, 'publish', body)).status, 400);
    }
    assert.deepEqual(await prisma.legalVersion.findUniqueOrThrow({ where: { id } }), beforeRow);
    assert.deepEqual(await legalAudits(id), beforeLogs);
    assert.equal((await transition(id, 'publish', { legalOverride: true })).status, 201);
    const published = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
    assert.equal(published.status, 'published');
    assert.deepEqual(published.content, beforeRow.content);
    const overrideLog = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: id, entityType: 'legalVersion', action: 'legal.published_with_override' },
    });
    assert.equal(overrideLog.actorUserId, seeded.users.adminUserId);
    assert.equal(await prisma.auditLog.count({ where: { entityId: id, action: 'legal.published' } }), 0);

    // Existing page key exercises the existing checklist, without inventing completed legal review data.
    const incompleteId = await createDraft('politica-de-privacidad');
    await approveDraft(incompleteId);
    const incomplete = await prisma.legalVersion.findUniqueOrThrow({ where: { id: incompleteId } });
    const incompleteLogs = await legalAudits(incompleteId);
    assert.equal((await transition(incompleteId, 'publish')).status, 400);
    for (const legalOverride of ['false', 'true', 1, {}]) {
      const rejected = await transition(incompleteId, 'publish', { legalOverride });
      const persisted = await prisma.legalVersion.findUniqueOrThrow({ where: { id: incompleteId } });
      const logs = await legalAudits(incompleteId);
      assert.deepEqual({ status: rejected.status, persisted, logs }, {
        status: 400, persisted: incomplete, logs: incompleteLogs,
      });
    }
  });

  it('rolls back approval metadata when the audit writer fails', async (t) => {
    const id = await createDraft();
    assert.equal((await transition(id, 'submit-review')).status, 201);
    const beforeRow = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
    const beforeLogs = await legalAudits(id);
    const write = audit.write.bind(audit);
    let reached = false;
    const injection = t.mock.method(audit, 'write', async (...args: Parameters<AuditRepository['write']>) => {
      if (args[0].entityId === id && args[0].action === 'legal.approved') {
        reached = true;
        throw new Error('EX074 A2 injected approval audit failure');
      }
      return write(...args);
    });
    try {
      const response = await transition(id, 'approve');
      const persisted = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
      const logs = await legalAudits(id);
      assert.equal(reached, true, 'Audit injection must reach the real approval route');
      assert.deepEqual({ status: response.status, persisted, logs }, {
        status: 500, persisted: beforeRow, logs: beforeLogs,
      });
    } finally {
      injection.mock.restore();
    }
  });

  it('atomically preserves the incumbent on replacement publication failure, then archives and publishes on retry', async (t) => {
    const pageKey = `ex074-a2-replacement-${uuidv7()}`;
    const incumbentId = await createDraft(pageKey);
    await approveDraft(incumbentId);
    assert.equal((await transition(incumbentId, 'publish')).status, 201);
    const candidateId = await createDraft(pageKey, { testFixture: 'EX074 A2 replacement marker' });
    await approveDraft(candidateId);
    const beforeRows = await prisma.legalVersion.findMany({ where: { pageKey }, orderBy: { version: 'asc' } });
    const beforeLogs = await legalAudits(candidateId);
    const write = audit.write.bind(audit);
    let reached = false;
    const injection = t.mock.method(audit, 'write', async (...args: Parameters<AuditRepository['write']>) => {
      // Preserve the real audit insert (including its transaction argument),
      // then fail: source changes AND that insert must roll back together.
      await write(...args);
      if (args[0].entityId === candidateId && args[0].action === 'legal.published') {
        reached = true;
        throw new Error('EX074 A2 injected failure after publication audit insert');
      }
    });
    try {
      const response = await transition(candidateId, 'publish');
      const rows = await prisma.legalVersion.findMany({ where: { pageKey }, orderBy: { version: 'asc' } });
      const logs = await legalAudits(candidateId);
      assert.equal(reached, true, 'Failure must happen after a real publication audit insert');
      assert.deepEqual({ status: response.status, rows, logs }, {
        status: 500, rows: beforeRows, logs: beforeLogs,
      });
    } finally {
      injection.mock.restore();
    }

    assert.equal((await transition(candidateId, 'publish')).status, 201);
    const rows = await prisma.legalVersion.findMany({ where: { pageKey }, orderBy: { version: 'asc' } });
    assert.deepEqual(rows.map((row) => ({ id: row.id, status: row.status })), [
      { id: incumbentId, status: 'archived' }, { id: candidateId, status: 'published' },
    ]);
    assert.equal(rows[1].version, rows[0].version + 1);
    assert.ok(rows[1].publishedAt);
    assert.equal(rows[1].publishedById, seeded.users.adminUserId);
    assert.equal(await prisma.legalVersion.count({ where: { pageKey, status: 'published' } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { entityId: candidateId, action: 'legal.published' } }), 1);
  });
});
