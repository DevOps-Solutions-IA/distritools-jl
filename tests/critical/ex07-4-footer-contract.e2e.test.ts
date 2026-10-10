import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { v7 as uuidv7 } from 'uuid';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';
import { AUDIT_REPOSITORY } from 'src/modules/auth/domain/repositories/audit.repository';
import type { AuditRepository } from 'src/modules/auth/domain/repositories/audit.repository';

// Authored persistent acceptance tests. Run only with the unchanged isolation
// guard and owned disposable PostgreSQL/Redis. No socket/DB execution here.
const adminFooter = '/api/v1/admin/content/footer';
const publicFooter = '/api/v1/content/footer';
const groups = (...hrefs: string[]) => [{ title: 'EX074 approved route authority', links: hrefs.map((href) => ({ label: 'Synthetic public destination', href, isVisible: true })) }];

describe('EX-07.4 canonical footer routes and durable invalidation contract', { concurrency: false }, () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let token: string;
  let viewerToken: string;
  let product: Awaited<ReturnType<typeof prisma.product.create>>;
  let category: Awaited<ReturnType<typeof prisma.category.create>>;
  let brand: Awaited<ReturnType<typeof prisma.brand.create>>;

  function assertIsolatedTarget() {
    assert.equal(process.env.CI, 'true'); assert.equal(process.env.NODE_ENV, 'test'); assert.equal(process.env.APP_ENV, 'test');
    const { validateTestEnvironment } = require('../../scripts/ci/assert-test-environment') as { validateTestEnvironment: (env: NodeJS.ProcessEnv) => { ok: boolean; failures: string[] } };
    const target = validateTestEnvironment(process.env); assert.equal(target.ok, true, target.failures.join('; '));
  }
  before(async () => {
    assertIsolatedTarget(); await resetDatabase(); const seeded = await seedBaseData();
    ({ app, http } = await createTestApp());
    token = (await loginAsAdmin(http, seeded.users.adminEmail, seeded.users.adminPassword, seeded.users.twoFactorSecret)).accessToken;
    viewerToken = (await loginAsAdmin(http, seeded.users.viewerEmail, seeded.users.viewerPassword, seeded.users.twoFactorSecret)).accessToken;
    assert.equal(typeof token, 'string'); assert.equal(typeof viewerToken, 'string');
  });
  beforeEach(async () => {
    assertIsolatedTarget();
    await prisma.$transaction([prisma.footerLink.deleteMany(), prisma.footerRevision.deleteMany(), prisma.auditLog.deleteMany({ where: { entityType: 'footerRevision' } })]);
    const suffix = uuidv7();
    category = await prisma.category.create({ data: { id: uuidv7(), slug: `ex074-category-${suffix}`, name: 'Synthetic category', isActive: true } });
    brand = await prisma.brand.create({ data: { id: uuidv7(), slug: `ex074-brand-${suffix}`, name: 'Synthetic brand', isActive: true } });
    product = await prisma.product.create({ data: { id: uuidv7(), slug: `ex074-product-${suffix}`, name: 'Synthetic product', categoryId: category.id, brandId: brand.id, isActive: true } });
  });
  after(async () => { if (app) await app.close(); await disconnectDatabase(); });

  async function persistedState() {
    const [revisions, audit] = await Promise.all([
      prisma.footerRevision.findMany({ orderBy: { id: 'asc' }, include: { links: { orderBy: { id: 'asc' } } } }),
      prisma.auditLog.findMany({ where: { entityType: 'footerRevision' }, orderBy: { id: 'asc' } }),
    ]); return { revisions, audit };
  }
  async function createDraft(...hrefs: string[]) {
    const response = await http.post(adminFooter).set('Authorization', `Bearer ${token}`).send({ groups: groups(...hrefs) });
    assert.equal(response.status, 201); assert.equal(response.body.status, 'draft'); assert.equal(typeof response.body.id, 'string'); return response.body.id as string;
  }
  async function action(id: string, name: string) { return http.post(`${adminFooter}/${id}/${name}`).set('Authorization', `Bearer ${token}`); }
  async function approve(id: string) {
    assert.equal((await action(id, 'submit-review')).status, 201); assert.equal((await action(id, 'approve')).status, 201);
    assert.equal((await prisma.footerRevision.findUniqueOrThrow({ where: { id } })).status, 'approved');
  }

  it('validates real static and published dynamic product/category/brand routes at input, save, review and publish', async () => {
    const hrefs = ['/politica-de-privacidad', `/productos/${product.slug}`, `/categorias/${category.slug}`, `/marcas/${brand.slug}`];
    const before = await persistedState();
    const validated = await http.post(`${adminFooter}/validate`).set('Authorization', `Bearer ${token}`).send({ groups: groups(...hrefs) });
    assert.equal(validated.status, 201); assert.deepEqual(validated.body, { valid: true }); assert.deepEqual(await persistedState(), before);
    const id = await createDraft(...hrefs); await approve(id); assert.equal((await action(id, 'publish')).status, 201);
    const row = await prisma.footerRevision.findUniqueOrThrow({ where: { id }, include: { links: true } });
    assert.equal(row.status, 'published'); assert.equal(row.links.length, 4);
    assert.equal(await prisma.auditLog.count({ where: { action: 'footer.published', entityId: id } }), 1);
  });

  it('rejects missing, external, manipulated and inactive routes with400 and no persisted mutation or audit', async () => {
    const id = await createDraft('/politica-de-privacidad');
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
    await prisma.category.update({ where: { id: category.id }, data: { isActive: false } });
    await prisma.brand.update({ where: { id: brand.id }, data: { isActive: false } });
    const hrefs = [`/categorias/${category.slug}`, `/marcas/${brand.slug}`, '/categorias/ex074-missing', '/marcas/ex074-missing', '/ex074-missing-page', '/productos/ex074-missing-product', `/productos/${product.slug}`, '/admin', '//example.invalid', 'javascript:alert(1)', '/productos/%2e%2e', '/politica-de-privacidad?redirect=/admin'];
    for (const href of hrefs) {
      const before = await persistedState();
      for (const request of [
        () => http.post(`${adminFooter}/validate`).set('Authorization', `Bearer ${token}`).send({ groups: groups(href) }),
        () => http.post(adminFooter).set('Authorization', `Bearer ${token}`).send({ groups: groups(href) }),
        () => http.patch(`${adminFooter}/${id}`).set('Authorization', `Bearer ${token}`).send({ groups: groups(href) }),
      ]) { assert.equal((await request()).status, 400, href); assert.deepEqual(await persistedState(), before); }
    }
  });

  it('rejects a1001-link revision at input/save/update with400 and no writes', async () => {
    const id = await createDraft('/politica-de-privacidad'); const before = await persistedState();
    const tooManyGroups = await http.post(adminFooter).set('Authorization', `Bearer ${token}`).send({ groups: Array.from({ length: 1001 }, () => ({ title: 'Synthetic group', links: [] })) });
    assert.equal(tooManyGroups.status, 400); assert.deepEqual(await persistedState(), before);
    const oversized = { groups: groups(...Array.from({ length: 1001 }, () => '/politica-de-privacidad')) };
    for (const build of [
      () => http.post(`${adminFooter}/validate`).set('Authorization', `Bearer ${token}`).send(oversized),
      () => http.post(adminFooter).set('Authorization', `Bearer ${token}`).send(oversized),
      () => http.patch(`${adminFooter}/${id}`).set('Authorization', `Bearer ${token}`).send(oversized),
    ]) { assert.equal((await build()).status, 400); assert.deepEqual(await persistedState(), before); }
  });

  it('revalidates draft review and approved publication after dynamic-resource depublication without partial effects', async () => {
    const id = await createDraft(`/productos/${product.slug}`);
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
    let before = await persistedState(); assert.equal((await action(id, 'submit-review')).status, 400); assert.deepEqual(await persistedState(), before);
    await prisma.product.update({ where: { id: product.id }, data: { isActive: true } }); await approve(id);
    const publicId = await createDraft('/politica-de-privacidad'); await approve(publicId); assert.equal((await action(publicId, 'publish')).status, 201);
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
    before = await persistedState(); assert.equal((await action(id, 'publish')).status, 400); assert.deepEqual(await persistedState(), before);
    assert.equal((await prisma.footerRevision.findUniqueOrThrow({ where: { id: publicId } })).status, 'published');
  });

  it('rejects401/403 on input/save/review/approve/publish and keeps business/audit state unchanged', async () => {
    const id = await createDraft('/politica-de-privacidad'); const before = await persistedState();
    for (const bearer of [undefined, viewerToken]) {
      for (const build of [
        () => http.post(`${adminFooter}/validate`).send({ groups: groups('/politica-de-privacidad') }),
        () => http.post(adminFooter).send({ groups: groups('/politica-de-privacidad') }),
        () => http.patch(`${adminFooter}/${id}`).send({ groups: groups('/politica-de-privacidad') }),
        () => http.post(`${adminFooter}/${id}/submit-review`),
        () => http.post(`${adminFooter}/${id}/approve`),
        () => http.post(`${adminFooter}/${id}/publish`),
      ]) { const request = build(); if (bearer) request.set('Authorization', `Bearer ${bearer}`); assert.equal((await request).status, bearer ? 403 : 401); assert.deepEqual(await persistedState(), before); }
    }
  });

  it('rolls back saves and review when the actual audit insert succeeds and its writer then fails', async () => {
    const id = await createDraft('/politica-de-privacidad'); const audit = app.get<AuditRepository>(AUDIT_REPOSITORY); const originalWrite = audit.write;
    for (const operation of ['create', 'update', 'review'] as const) {
      const before = await persistedState(); let injected = 0;
      audit.write = async (...args: Parameters<AuditRepository['write']>) => { await originalWrite.apply(audit, args); injected += 1; throw new Error('EX074_FOOTER_AUDIT_AFTER_INSERT'); };
      try {
        const response = operation === 'create' ? await http.post(adminFooter).set('Authorization', `Bearer ${token}`).send({ groups: groups('/politica-de-privacidad') })
          : operation === 'update' ? await http.patch(`${adminFooter}/${id}`).set('Authorization', `Bearer ${token}`).send({ groups: groups('/politica-de-privacidad') })
            : await action(id, 'submit-review');
        assert.equal(response.status, 500); assert.equal(injected, 1); assert.deepEqual(await persistedState(), before);
      } finally { audit.write = originalWrite; }
    }
  });

  it('hides a broken published link, durably alerts once, preserves the published payload and requires a new reviewed revision', async () => {
    const id = await createDraft('/politica-de-privacidad', `/productos/${product.slug}`); await approve(id); assert.equal((await action(id, 'publish')).status, 201);
    const before = await prisma.footerRevision.findUniqueOrThrow({ where: { id }, include: { links: { orderBy: { id: 'asc' } } } });
    const goodRead = await http.get(publicFooter); assert.equal(goodRead.status, 200); assert.ok(JSON.stringify(goodRead.body).includes(`/productos/${product.slug}`));
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const read = await http.get(publicFooter); assert.equal(read.status, 200); assert.equal(JSON.stringify(read.body).includes(`/productos/${product.slug}`), false); assert.ok(JSON.stringify(read.body).includes('/politica-de-privacidad'));
      assert.equal(JSON.stringify(read.body).includes('fingerprint'), false); assert.equal(JSON.stringify(read.body).includes('route_invalidated'), false);
    }
    assert.deepEqual(await prisma.footerRevision.findUniqueOrThrow({ where: { id }, include: { links: { orderBy: { id: 'asc' } } } }), before);
    const alerts = await prisma.auditLog.findMany({ where: { action: 'footer.route_invalidated', entityId: id } }); assert.equal(alerts.length, 1);
    assert.equal(JSON.stringify(alerts[0].afterData).includes(`/productos/${product.slug}`), false, 'Alert must use link identifiers without raw URLs');
    const alertState = await persistedState();
    assert.equal((await http.get(adminFooter)).status, 401); assert.equal((await http.get(adminFooter).set('Authorization', `Bearer ${viewerToken}`)).status, 403); assert.deepEqual(await persistedState(), alertState);
    const admin = await http.get(adminFooter).set('Authorization', `Bearer ${token}`); assert.equal(admin.status, 200); assert.equal(admin.body.requiresReview, true); assert.equal(admin.body.routeAlerts.length, 1);
    await prisma.product.update({ where: { id: product.id }, data: { isActive: true } });
    assert.equal((await http.get(adminFooter).set('Authorization', `Bearer ${token}`)).body.requiresReview, true);
    assert.equal((await http.patch(`${adminFooter}/${id}`).set('Authorization', `Bearer ${token}`).send({ groups: groups('/politica-de-privacidad') })).status, 400);
    const replacement = await createDraft('/politica-de-privacidad'); assert.equal((await action(replacement, 'publish')).status, 400); await approve(replacement); assert.equal((await action(replacement, 'publish')).status, 201);
    assert.equal((await http.get(adminFooter).set('Authorization', `Bearer ${token}`)).body.requiresReview, false);
  });
  it('fails closed and rolls back a real route-invalidation alert insert if its audit writer fails', async () => {
    const id = await createDraft(`/productos/${product.slug}`); await approve(id); assert.equal((await action(id, 'publish')).status, 201);
    await prisma.product.update({ where: { id: product.id }, data: { isActive: false } });
    const before = await persistedState(); const audit = app.get<AuditRepository>(AUDIT_REPOSITORY); const originalWrite = audit.write; let injected = 0;
    audit.write = async (...args: Parameters<AuditRepository['write']>) => {
      await originalWrite.apply(audit, args);
      if (args[0].action === 'footer.route_invalidated') { injected += 1; throw new Error('EX074_ALERT_AUDIT_AFTER_INSERT'); }
    };
    try {
      const response = await http.get(publicFooter); assert.equal(response.status, 500); assert.equal(injected, 1);
      assert.equal(JSON.stringify(response.body).includes(`/productos/${product.slug}`), false); assert.deepEqual(await persistedState(), before);
    } finally { audit.write = originalWrite; }
    const retry = await http.get(publicFooter); assert.equal(retry.status, 200); assert.equal(JSON.stringify(retry.body).includes(`/productos/${product.slug}`), false);
    assert.equal(await prisma.auditLog.count({ where: { action: 'footer.route_invalidated', entityId: id } }), 1);
    assert.deepEqual((await persistedState()).revisions, before.revisions);
  });

  it('preserves real catalog query links and revalidates their category and brand through publication and invalidation', async () => {
    const href = `/productos?category=${category.slug}&brand=${brand.slug}`;
    const baseline = await persistedState();
    const input = await http.post(`${adminFooter}/validate`).set('Authorization', `Bearer ${token}`).send({ groups: groups(href) });
    assert.equal(input.status, 201); assert.deepEqual(input.body, { valid: true }); assert.deepEqual(await persistedState(), baseline);
    const id = await createDraft(href);
    await prisma.category.update({ where: { id: category.id }, data: { isActive: false } });
    let before = await persistedState();
    for (const build of [
      () => http.post(`${adminFooter}/validate`).set('Authorization', `Bearer ${token}`).send({ groups: groups(href) }),
      () => http.post(adminFooter).set('Authorization', `Bearer ${token}`).send({ groups: groups(href) }),
      () => http.patch(`${adminFooter}/${id}`).set('Authorization', `Bearer ${token}`).send({ groups: groups(href) }),
      () => http.post(`${adminFooter}/${id}/submit-review`).set('Authorization', `Bearer ${token}`),
    ]) { assert.equal((await build()).status, 400); assert.deepEqual(await persistedState(), before); }
    await prisma.category.update({ where: { id: category.id }, data: { isActive: true } }); await approve(id);
    await prisma.brand.update({ where: { id: brand.id }, data: { isActive: false } });
    before = await persistedState(); assert.equal((await action(id, 'publish')).status, 400); assert.deepEqual(await persistedState(), before);
    await prisma.brand.update({ where: { id: brand.id }, data: { isActive: true } }); assert.equal((await action(id, 'publish')).status, 201);
    const published = await prisma.footerRevision.findUniqueOrThrow({ where: { id }, include: { links: { orderBy: { id: 'asc' } } } });
    const valid = await http.get(publicFooter); assert.equal(valid.status, 200); assert.ok(JSON.stringify(valid.body).includes(href));
    await prisma.brand.update({ where: { id: brand.id }, data: { isActive: false } });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const invalid = await http.get(publicFooter); assert.equal(invalid.status, 200); assert.equal(JSON.stringify(invalid.body).includes(href), false);
    }
    assert.equal(await prisma.auditLog.count({ where: { action: 'footer.route_invalidated', entityId: id } }), 1);
    assert.deepEqual(await prisma.footerRevision.findUniqueOrThrow({ where: { id }, include: { links: { orderBy: { id: 'asc' } } } }), published);
    const admin = await http.get(adminFooter).set('Authorization', `Bearer ${token}`); assert.equal(admin.status, 200); assert.equal(admin.body.requiresReview, true); assert.equal(admin.body.routeAlerts.length, 1);
  });

  it('validates and publishes real search URLs generated with spaces and UTF8 query text', async () => {
    const hrefs = ['taladro inalambrico', 'taladro inalámbrico'].map((q) => `/buscar?${new URLSearchParams({ q })}`);
    const before = await persistedState();
    const input = await http.post(`${adminFooter}/validate`).set('Authorization', `Bearer ${token}`).send({ groups: groups(...hrefs) });
    assert.equal(input.status, 201); assert.deepEqual(input.body, { valid: true }); assert.deepEqual(await persistedState(), before);
    const id = await createDraft(...hrefs); await approve(id); assert.equal((await action(id, 'publish')).status, 201);
    const publicRead = await http.get(publicFooter); assert.equal(publicRead.status, 200);
    for (const href of hrefs) assert.ok(JSON.stringify(publicRead.body).includes(href));
    assert.equal(await prisma.auditLog.count({ where: { action: 'footer.published', entityId: id } }), 1);
  });

});
