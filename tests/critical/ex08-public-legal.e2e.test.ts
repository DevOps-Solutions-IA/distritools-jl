import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { v7 as uuidv7 } from 'uuid';
import { AUDIT_REPOSITORY, type AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';

// Technical fixtures in an owned disposable database; never approved legal copy.
describe('EX-08 public persisted legal projection', { concurrency: false }, () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let adminToken: string;
  let viewerToken: string;
  let audit: AuditRepository;
  const adminPath = '/api/v1/admin/content/legal';
  const publicPath = '/api/v1/content/legal';

  before(async () => {
    assert.equal(process.env.APP_ENV, 'test');
    const { validateTestEnvironment } = require('../../scripts/ci/assert-test-environment') as {
      validateTestEnvironment: (env: NodeJS.ProcessEnv) => { ok: boolean; failures: string[] };
    };
    const isolation = validateTestEnvironment(process.env);
    assert.equal(isolation.ok, true, isolation.failures.join('; '));
    await resetDatabase();
    const seeded = await seedBaseData();
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
    try { if (app) await app.close(); } finally { await disconnectDatabase(); }
  });

  function transition(id: string, step: string, token = adminToken) {
    return http.post(`${adminPath}/${id}/${step}`).set('Authorization', `Bearer ${token}`).send({});
  }

  async function draft(pageKey: string, marker: string) {
    const response = await http.post(adminPath).set('Authorization', `Bearer ${adminToken}`).send({
      pageKey, slug: pageKey, title: `Technical ${marker}`, content: { sections: [{ title: marker, body: '<img src=x onerror="globalThis.legalExecuted=true">' }] },
      checklist: {},
    });
    assert.equal(response.status, 201);
    return response.body.id as string;
  }

  async function approve(id: string) {
    assert.equal((await transition(id, 'submit-review')).status, 201);
    assert.equal((await transition(id, 'approve')).status, 201);
  }

  it('reads exactly the actual published public fields anonymously and without seeding or audits', async () => {
    const pageKey = `ex08-public-${uuidv7()}`;
    const id = await draft(pageKey, 'persisted first');
    await approve(id);
    assert.equal((await transition(id, 'publish')).status, 201);
    const stored = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
    const rowCount = await prisma.legalVersion.count();
    const auditCount = await prisma.auditLog.count();
    const response = await http.get(`${publicPath}/${pageKey}`);
    assert.equal(response.status, 200);
    assert.match(response.headers['cache-control'], /no-store/);
    assert.deepEqual(response.body, {
      pageKey, slug: pageKey, title: 'Technical persisted first', version: stored.version,
      content: { sections: [{ title: 'persisted first', body: '<img src=x onerror="globalThis.legalExecuted=true">' }] },
      publishedAt: stored.publishedAt!.toISOString(),
    });
    assert.equal(await prisma.legalVersion.count(), rowCount);
    assert.equal(await prisma.auditLog.count(), auditCount);
  });

  it('never exposes draft, review, approved, archived or published-without-timestamp rows; missing reads do not seed', async () => {
    const pageKey = `ex08-private-${uuidv7()}`;
    const id = await draft(pageKey, 'private marker');
    for (const step of [null, 'submit-review', 'approve', 'archive']) {
      if (step) assert.equal((await transition(id, step)).status, 201);
      assert.equal((await http.get(`${publicPath}/${pageKey}`)).status, 404);
    }
    await prisma.legalVersion.update({ where: { id }, data: { status: 'published', publishedAt: null } });
    assert.equal((await http.get(`${publicPath}/${pageKey}`)).status, 404);
    const before = await prisma.legalVersion.count();
    assert.equal((await http.get(`${publicPath}/no-such-document`)).status, 404);
    assert.equal(await prisma.legalVersion.count(), before);
  });

  it('keeps the incumbent public version on forbidden writes and publication audit rollback; replaces and archives through real admin routes', async (t) => {
    const pageKey = `ex08-replace-${uuidv7()}`;
    const incumbent = await draft(pageKey, 'incumbent');
    await approve(incumbent);
    assert.equal((await transition(incumbent, 'publish')).status, 201);
    const beforePublic = (await http.get(`${publicPath}/${pageKey}`)).body;
    const candidate = await draft(pageKey, 'replacement');
    assert.equal((await transition(candidate, 'publish')).status, 400);
    await approve(candidate);
    assert.equal((await http.post(`${adminPath}/${candidate}/publish`).send({})).status, 401);
    assert.equal((await transition(candidate, 'publish', viewerToken)).status, 403);
    assert.deepEqual((await http.get(`${publicPath}/${pageKey}`)).body, beforePublic);
    const beforeRows = await prisma.legalVersion.findMany({ where: { pageKey }, orderBy: { version: 'asc' } });
    const beforeLogs = await prisma.auditLog.findMany({ where: { entityId: candidate }, orderBy: { id: 'asc' } });
    const write = audit.write.bind(audit);
    let reached = false;
    const injection = t.mock.method(audit, 'write', async (...args: Parameters<AuditRepository['write']>) => {
      await write(...args);
      if (args[0].entityId === candidate && args[0].action === 'legal.published') {
        reached = true;
        throw new Error('EX08 injected failure after real audit insert');
      }
    });
    try {
      assert.equal((await transition(candidate, 'publish')).status, 500);
      assert.equal(reached, true);
      assert.deepEqual(await prisma.legalVersion.findMany({ where: { pageKey }, orderBy: { version: 'asc' } }), beforeRows);
      assert.deepEqual(await prisma.auditLog.findMany({ where: { entityId: candidate }, orderBy: { id: 'asc' } }), beforeLogs);
      assert.deepEqual((await http.get(`${publicPath}/${pageKey}`)).body, beforePublic);
    } finally { injection.mock.restore(); }
    assert.equal((await transition(candidate, 'publish')).status, 201);
    const replacement = await http.get(`${publicPath}/${pageKey}`);
    assert.equal(replacement.status, 200);
    assert.equal(replacement.body.version, beforePublic.version + 1);
    assert.equal(replacement.body.title, 'Technical replacement');
    assert.equal((await prisma.legalVersion.findUniqueOrThrow({ where: { id: incumbent } })).status, 'archived');
    assert.equal((await transition(candidate, 'archive')).status, 201);
    assert.equal((await http.get(`${publicPath}/${pageKey}`)).status, 404);
  });

  it('selects the latest eligible version even if a newer non-public revision exists', async () => {
    const pageKey = `ex08-newest-${uuidv7()}`;
    for (const [version, status, publishedAt] of [
      [1, 'published', new Date('2026-01-01T00:00:00Z')],
      [2, 'published', new Date('2026-02-01T00:00:00Z')],
      [3, 'approved', null], [4, 'published', null],
    ] as const) {
      await prisma.legalVersion.create({ data: { id: uuidv7(), pageKey, slug: pageKey, title: `version ${version}`, version, status, publishedAt, content: { text: `marker ${version}` }, checklist: { private: true } } });
    }
    const response = await http.get(`${publicPath}/${pageKey}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { pageKey, slug: pageKey, title: 'version 2', version: 2, publishedAt: '2026-02-01T00:00:00.000Z', content: { text: 'marker 2' } });
  });

  it('has no anonymous mutation route and does not leak on public read failure', async (t) => {
    const pageKey = `ex08-failure-${uuidv7()}`;
    const before = await prisma.legalVersion.count();
    for (const method of ['post', 'patch', 'delete'] as const) {
      assert.ok((await http[method](`${publicPath}/${pageKey}`).send({ status: 'published' })).status >= 400);
    }
    assert.equal(await prisma.legalVersion.count(), before);
    const { PrismaService } = await import('src/infra/db/prisma/prisma.service');
    const db = app.get(PrismaService);
    const read = db.legalVersion.findFirst;
    db.legalVersion.findFirst = async () => { throw new Error('EX08 controlled read outage'); };
    try {
      const response = await http.get(`${publicPath}/${pageKey}`);
      assert.equal(response.status, 500);
      assert.equal('content' in response.body, false);
      assert.equal('checklist' in response.body, false);
    } finally { db.legalVersion.findFirst = read; }
  });
});
