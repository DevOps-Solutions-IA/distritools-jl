import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';

// Technical contract fixtures only; this test does not approve business legal copy.
// ROOT runs this against its explicitly owned disposable test database.
describe('EX-08 recognized empty public legal producer contract', { concurrency: false }, () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let token: string;
  const pageKey = 'politica-de-privacidad';
  const adminPath = '/api/v1/admin/content/legal';
  const publicPath = `/api/v1/content/legal/${pageKey}`;

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
    const session = await loginAsAdmin(http, seeded.users.adminEmail, seeded.users.adminPassword, seeded.users.twoFactorSecret);
    assert.ok(session.accessToken);
    token = session.accessToken;
  });

  after(async () => {
    try { if (app) await app.close(); } finally { await disconnectDatabase(); }
  });

  it('saves, reviews and publishes each recognized empty body without override, preserving actual version and audits', async () => {
    for (const content of [{ text: '' }, { notice: '' }, { sections: [] }]) {
      const detail = await http.get(`${adminPath}/${pageKey}`).set('Authorization', `Bearer ${token}`);
      assert.equal(detail.status, 200);
      const requirements = detail.body.requirements as string[];
      assert.ok(Array.isArray(requirements) && requirements.length > 0);
      const checklist = Object.fromEntries(requirements.map((requirement) => [requirement, true]));
      const latestVersion = Math.max(...detail.body.history.map((row: { version: number }) => row.version));
      const created = await http.post(adminPath).set('Authorization', `Bearer ${token}`).send({
        pageKey, slug: pageKey, title: 'Technical empty publication contract',
        content: { text: 'Technical initial draft' }, checklist: {},
      });
      assert.equal(created.status, 201);
      assert.equal(created.body.status, 'draft');
      assert.equal(created.body.version, latestVersion + 1);
      const id = created.body.id as string;
      assert.ok(id);
      assert.ok(created.body.submittedById);
      const saved = await http.patch(`${adminPath}/${id}`).set('Authorization', `Bearer ${token}`).send({ content, checklist });
      assert.equal(saved.status, 200);
      assert.equal(saved.body.id, id);
      assert.deepEqual(saved.body.content, content);
      assert.deepEqual(saved.body.checklist, checklist);
      assert.equal(saved.body.status, 'draft');
      for (const [step, status] of [['submit-review', 'pending_legal_review'], ['approve', 'approved']] as const) {
        const response = await http.post(`${adminPath}/${id}/${step}`).set('Authorization', `Bearer ${token}`).send({});
        assert.equal(response.status, 201);
        assert.equal(response.body.id, id);
        assert.equal(response.body.status, status);
      }
      const published = await http.post(`${adminPath}/${id}/publish`).set('Authorization', `Bearer ${token}`).send({});
      assert.equal(published.status, 201);
      assert.equal(published.body.id, id);
      assert.equal(published.body.status, 'published');
      const stored = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
      assert.equal(stored.status, 'published');
      assert.equal(stored.version, created.body.version);
      assert.ok(stored.publishedAt);
      assert.deepEqual(stored.content, content);
      assert.deepEqual(stored.checklist, checklist);
      const audits = await prisma.auditLog.findMany({ where: { entityType: 'legalVersion', entityId: id } });
      assert.deepEqual(audits.map((row) => row.action).sort(), [
        'legal.approved', 'legal.created', 'legal.pending_legal_review', 'legal.published', 'legal.updated',
      ]);
      assert.ok(audits.every((row) => row.actorUserId === created.body.submittedById));
      const rowCount = await prisma.legalVersion.count();
      const auditCount = await prisma.auditLog.count();
      const projection = await http.get(publicPath);
      assert.equal(projection.status, 200);
      assert.match(projection.headers['cache-control'], /no-store/);
      assert.deepEqual(projection.body, {
        pageKey, slug: pageKey, title: 'Technical empty publication contract',
        version: stored.version, content, publishedAt: stored.publishedAt!.toISOString(),
      });
      assert.equal(await prisma.legalVersion.count(), rowCount);
      assert.equal(await prisma.auditLog.count(), auditCount);
    }
  });
});
