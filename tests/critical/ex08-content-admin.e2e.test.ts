import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { AppModule } from 'src/app/app.module';
import { GlobalExceptionFilter } from 'src/common/filters/global-exception.filter';
import { MetricsInterceptor } from 'src/infra/telemetry/metrics/metrics.interceptor';
import { MetricsService } from 'src/infra/telemetry/metrics/metrics.service';
import { assertDisposableTarget } from 'tests/helpers/ex07-4-disposable-target';
import { loginAsAdmin } from 'tests/helpers/test-app';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';

describe('EX08 CONTENT actual HTTP/persistence/audit contracts', { concurrency: false }, () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let admin: string;
  let viewer: string;
  let actor: string;
  const root = '/api/v1/admin/content';
  before(async () => {
    assertDisposableTarget();
    await resetDatabase();
    const seed = await seedBaseData();
    actor = seed.users.adminUserId;
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = ref.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api/v1');
    app.enableCors({ origin: ['http://localhost:3001'], credentials: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new GlobalExceptionFilter());
    // tsx does not emit constructor metadata for the interceptor. Inject the
    // real service explicitly; the compiled browser runtime also proves DI.
    app.useGlobalInterceptors(new MetricsInterceptor(app.get(MetricsService)));
    await app.init();
    http = request(app.getHttpServer());
    admin = (await loginAsAdmin(http, seed.users.adminEmail, seed.users.adminPassword, seed.users.twoFactorSecret)).accessToken;
    viewer = (await loginAsAdmin(http, seed.users.viewerEmail, seed.users.viewerPassword, seed.users.twoFactorSecret)).accessToken;
    assert.ok(admin); assert.ok(viewer);
  });
  after(async () => { try { if (app) await app.close(); } finally { await disconnectDatabase(); } });
  const post = (path: string, body: unknown = {}) => http.post(root + path).set('Authorization', `Bearer ${admin}`).send(body);
  const get = (path: string) => http.get(root + path).set('Authorization', `Bearer ${admin}`);
  const groups = [{ title: 'CONTENT technical fixture', links: [{ label: 'Catálogo', href: '/productos' }] }];

  it('legal edits, previews persisted content, marks review, approves and publishes with audited phases', async () => {
    const pageKey = 'ex08-content-' + uuidv7();
    // Technical fixture only; no invented legal copy or completed default-page checklist.
    const created = await post('/legal', { pageKey, title: 'CONTENT technical fixture', slug: pageKey, content: { sections: [{ title: 'Fixture', body: 'Synthetic persistence marker' }] }, checklist: {} });
    assert.equal(created.status, 201);
    const id = created.body.id;
    const edit = await http.patch(`${root}/legal/${id}`).set('Authorization', `Bearer ${admin}`).send({ title: 'CONTENT edited fixture' });
    assert.equal(edit.status, 200);
    const preview = await get('/legal/' + pageKey);
    assert.equal(preview.status, 200); assert.equal(preview.body.published, null);
    assert.equal(preview.body.draft.title, 'CONTENT edited fixture');
    assert.deepEqual(preview.body.draft.content, created.body.content);
    assert.equal((await post(`/legal/${id}/submit-review`)).status, 201);
    assert.equal((await prisma.legalVersion.findUniqueOrThrow({ where: { id } })).status, 'pending_legal_review');
    assert.equal((await post(`/legal/${id}/approve`)).status, 201);
    const approved = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
    assert.equal(approved.status, 'approved'); assert.ok(approved.approvedAt);
    assert.equal((await post(`/legal/${id}/publish`)).status, 201);
    const persisted = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
    assert.equal(persisted.status, 'published'); assert.ok(persisted.publishedAt);
    assert.equal((await get('/legal/' + pageKey)).body.published.id, id);
    const audits = await prisma.auditLog.findMany({ where: { entityId: id, entityType: 'legalVersion' } });
    assert.deepEqual(audits.map(log => log.action).sort(), ['legal.approved', 'legal.created', 'legal.pending_legal_review', 'legal.published', 'legal.updated']);
    assert.ok(audits.every(log => log.actorUserId === actor));
  });

  it('legal negatives preserve approved content, reject dangerous content and enforce real phase permissions', async () => {
    const pageKey = 'ex08-content-negative-' + uuidv7();
    const created = await post('/legal', { pageKey, title: 'CONTENT negative fixture', content: { text: 'Synthetic fixture' } });
    assert.equal(created.status, 201);
    const id = created.body.id;
    assert.equal((await post(`/legal/${id}/publish`)).status, 400);
    assert.equal((await http.patch(`${root}/legal/${id}`).set('Authorization', `Bearer ${admin}`).send({ content: { text: '<script>unsafe</script>' } })).status, 400);
    assert.equal((await post(`/legal/${id}/approve`)).status, 201);
    const before = await prisma.legalVersion.findUniqueOrThrow({ where: { id } });
    const logs = await prisma.auditLog.findMany({ where: { entityId: id } });
    assert.equal((await http.patch(`${root}/legal/${id}`).set('Authorization', `Bearer ${admin}`).send({ title: 'Rejected' })).status, 400);
    for (const action of ['submit-review', 'approve', 'publish']) {
      assert.equal((await http.post(`${root}/legal/${id}/${action}`).send({})).status, 401);
      assert.equal((await http.post(`${root}/legal/${id}/${action}`).set('Authorization', `Bearer ${viewer}`).send({})).status, 403);
    }
    assert.deepEqual(await prisma.legalVersion.findUniqueOrThrow({ where: { id } }), before);
    assert.deepEqual(await prisma.auditLog.findMany({ where: { entityId: id } }), logs);
    assert.equal((await post(`/legal/${id}/publish`, { legalOverride: 'false' })).status, 400);
    assert.equal((await get('/legal/missing-' + uuidv7())).status, 404);
  });

  it('footer edits, validates authoritative routes, reviews, publishes and restores by a new approved revision', async () => {
    const beforeValidate = await prisma.auditLog.count({ where: { entityType: 'footerRevision' } });
    assert.equal((await post('/footer/validate', { groups })).body.valid, true);
    assert.equal(await prisma.auditLog.count({ where: { entityType: 'footerRevision' } }), beforeValidate, 'Validation is read-only and has no fabricated mutation audit.');
    const created = await post('/footer', { groups }); assert.equal(created.status, 201);
    const id = created.body.id;
    const changed = [{ ...groups[0], links: [{ label: 'Catálogo actualizado', href: '/productos?sort=price-asc' }] }];
    const edit = await http.patch(`${root}/footer/${id}`).set('Authorization', `Bearer ${admin}`).send({ groups: changed });
    assert.equal(edit.status, 200);
    assert.equal((await post(`/footer/${id}/submit-review`)).status, 201);
    assert.equal((await post(`/footer/${id}/approve`)).status, 201);
    assert.equal((await post(`/footer/${id}/publish`)).status, 201);
    assert.deepEqual((await get('/footer/' + id)).body.groupsJson, changed);
    assert.equal((await get('/footer')).body.published.id, id);
    const publicProjection = await http.get('/api/v1/content/footer');
    assert.equal(publicProjection.status, 200); assert.equal(publicProjection.body.version, created.body.version);
    assert.equal(publicProjection.body.groups[0].items[0].label, 'Catálogo actualizado');
    const restored = await post('/footer', { groups }); assert.equal(restored.status, 201);
    const restoredId = restored.body.id; assert.equal(restored.body.status, 'draft');
    assert.equal((await get('/footer')).body.published.id, id, 'Restored draft cannot change the public footer.');
    assert.equal((await post(`/footer/${restoredId}/submit-review`)).status, 201);
    assert.equal((await post(`/footer/${restoredId}/approve`)).status, 201);
    assert.equal((await post(`/footer/${restoredId}/publish`)).status, 201);
    assert.equal((await prisma.footerRevision.findUniqueOrThrow({ where: { id } })).status, 'archived');
    assert.equal((await get('/footer')).body.published.id, restoredId);
    assert.equal((await http.get('/api/v1/content/footer')).body.groups[0].items[0].label, 'Catálogo');
    const audits = await prisma.auditLog.findMany({ where: { entityId: id, entityType: 'footerRevision' } });
    assert.deepEqual(audits.map(log => log.action).sort(), ['footer.approved', 'footer.created', 'footer.pending_legal_review', 'footer.published', 'footer.updated']);
    assert.ok(audits.every(log => log.actorUserId === actor));
  });

  it('footer rejects unsafe/unavailable routes and denied writes without business mutation', async () => {
    const created = await post('/footer', { groups }); assert.equal(created.status, 201);
    const id = created.body.id;
    const before = await prisma.footerRevision.findUniqueOrThrow({ where: { id }, include: { links: true } });
    const businessLogs = await prisma.auditLog.count({ where: { entityType: 'footerRevision' } });
    for (const href of ['https://example.invalid', '/admin', '/productos/missing-' + uuidv7(), '/productos?unknown=yes']) {
      const rejectedGroups = [{ title: 'Fixture', links: [{ label: 'Reject', href }] }];
      assert.equal((await post('/footer/validate', { groups: rejectedGroups })).status, 400);
      assert.equal((await post('/footer', { groups: rejectedGroups })).status, 400);
    }
    assert.equal((await post('/footer', { groups: null })).status, 400);
    for (const path of ['/footer', '/footer/validate', `/footer/${id}/submit-review`, `/footer/${id}/approve`, `/footer/${id}/publish`]) {
      assert.equal((await http.post(root + path).send({ groups })).status, 401);
      assert.equal((await http.post(root + path).set('Authorization', `Bearer ${viewer}`).send({ groups })).status, 403);
    }
    assert.equal((await post(`/footer/${id}/publish`)).status, 400);
    assert.deepEqual(await prisma.footerRevision.findUniqueOrThrow({ where: { id }, include: { links: true } }), before);
    assert.equal(await prisma.auditLog.count({ where: { entityType: 'footerRevision' } }), businessLogs);
  });
});
