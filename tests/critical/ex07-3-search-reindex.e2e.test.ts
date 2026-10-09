import 'tests/helpers/test-env';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it, mock } from 'node:test';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { generate } from 'otplib';
import { AppModule } from 'src/app/app.module';
import { PrismaAuditRepository } from 'src/modules/auth/infrastructure/repositories/prisma-audit.repository';
import { PrismaSearchRepository } from 'src/modules/search/infrastructure/repositories/prisma-search.repository';
import { ReindexVariantsUseCase } from 'src/modules/search/application/use-cases/reindex-variants.use-case';
import { ReindexContentUseCase } from 'src/modules/search/application/use-cases/reindex-content.use-case';
import { PrismaDomainEventInboxRepository, ConflictingDomainEventReplayError } from 'src/infra/events/prisma-domain-event-inbox.repository';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';
import { InMemoryDomainEventPublisher } from 'src/infra/events/in-memory-domain-event.publisher';
import { SearchEventSubscriber } from 'src/modules/search/infrastructure/jobs/search-event.subscriber';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';
import type { VersionedDomainEvent } from 'src/common/events/domain-event.contracts';

async function loginAsAdmin(http: ReturnType<typeof request>, email: string, password: string, secret: string) {
  const login = await http.post('/api/v1/auth/login').send({ email, password });
  assert.equal(login.status, 201);
  const verified = await http.post('/api/v1/auth/verify-2fa').send({
    challengeToken: login.body.challengeToken, code: await generate({ secret }),
  });
  assert.equal(verified.status, 201);
  return verified.body as { accessToken: string };
}

// New persisted regression cases. No skips; require the same owned CI services as the unchanged critical suite.
describe('EX-07.3 persisted search and reindex boundaries', () => {
  let app: TestingModule;
  let nest: INestApplication;
  let http: ReturnType<typeof request>;
  let token: string;
  let fixture: Awaited<ReturnType<typeof seedBaseData>>;
  let repository: PrismaSearchRepository;

  before(async () => {
    assert.equal(process.env.CI, 'true');
    assert.equal(process.env.APP_ENV, 'test');
    assert.equal(process.env.NODE_ENV, 'test');
    const { validateTestEnvironment } = require('../../scripts/ci/assert-test-environment') as {
      validateTestEnvironment: (env: NodeJS.ProcessEnv) => { ok: boolean };
    };
    assert.equal(validateTestEnvironment(process.env).ok, true);
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    nest = app.createNestApplication({ rawBody: true });
    nest.setGlobalPrefix('api/v1');
    nest.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await nest.init();
    http = request(nest.getHttpServer());
    await resetDatabase();
    fixture = await seedBaseData();
    token = (await loginAsAdmin(http, fixture.users.adminEmail, fixture.users.adminPassword, fixture.users.twoFactorSecret)).accessToken;
    repository = new PrismaSearchRepository(prisma as never);
  });

  after(async () => { if (nest) await nest.close(); await disconnectDatabase(); });

  it('persists committed-stock arithmetic and hides stale inactive product/variant results', async () => {
    const productId = randomUUID();
    const variantId = randomUUID();
    const sku = `EX073-${variantId}`;
    await prisma.product.create({ data: { id: productId, name: 'EX073 visible', slug: `ex073-${productId}` } });
    await prisma.variant.create({ data: { id: variantId, productId, name: 'EX073 variant', sku, price: '10' } });
    const warehouseId = randomUUID();
    await prisma.warehouse.create({ data: { id: warehouseId, name: 'EX073 stock' } });
    await prisma.inventoryItem.create({ data: { id: randomUUID(), variantId, warehouseId, onHandQty: 12, reservedQty: 2, committedQty: 7 } });
    const response = await http.post('/api/v1/admin/search/reindex/variants').set('Authorization', `Bearer ${token}`).send({ ids: [variantId] });
    assert.equal(response.status, 201);
    assert.equal(response.body.reindexed, 1);
    const projection = await prisma.searchDocument.findFirstOrThrow({ where: { variantId } });
    assert.equal(projection.availability, 3);
    assert.equal(projection.isActive, true);
    const visible = await http.get('/api/v1/search').query({ q: sku });
    assert.equal(visible.status, 200);
    assert.equal(visible.body.data.length, 1);
    for (const key of ['searchText', 'variantId', 'contentBlockId', 'createdAt', 'updatedAt', 'isActive']) {
      assert.equal(Object.hasOwn(visible.body.data[0], key), false);
    }
    await prisma.inventoryItem.updateMany({ where: { variantId }, data: { reservedQty: 5 } });
    assert.equal((await prisma.searchDocument.findUniqueOrThrow({ where: { id: projection.id } })).availability, 3);
    assert.equal((await repository.search(sku))[0].availability, 0);
    await prisma.product.update({ where: { id: productId }, data: { isActive: false } });
    assert.equal((await prisma.searchDocument.findUniqueOrThrow({ where: { id: projection.id } })).isActive, true);
    assert.deepEqual(await repository.search(sku), []);
    assert.deepEqual(await repository.autocomplete(sku), []);
    await new ReindexVariantsUseCase(prisma as never, repository).execute([variantId]);
    assert.equal((await prisma.searchDocument.findUniqueOrThrow({ where: { id: projection.id } })).isActive, false);
    await prisma.product.update({ where: { id: productId }, data: { isActive: true } });
    await new ReindexVariantsUseCase(prisma as never, repository).execute([variantId]);
    await prisma.variant.update({ where: { id: variantId }, data: { isActive: false } });
    assert.deepEqual(await repository.search(sku), []);
  });

  it('content visibility uses current publish state and inclusive source date windows', async () => {
    const id = randomUUID();
    const title = `EX073-window-${id}`;
    await prisma.contentBlock.create({ data: { id, title, type: 'text_section', placementKey: 'ex073', body: { text: 'public' }, isPublished: true } });
    await new ReindexContentUseCase(prisma as never, repository).execute([id]);
    assert.equal((await repository.search(title)).length, 1);
    await prisma.contentBlock.update({ where: { id }, data: { startsAt: new Date('2999-01-01T00:00:00Z') } });
    assert.deepEqual(await repository.search(title), []);
    assert.deepEqual(await repository.autocomplete(title), []);
    await prisma.contentBlock.update({ where: { id }, data: { startsAt: null, endsAt: new Date('2000-01-01T00:00:00Z') } });
    assert.deepEqual(await repository.search(title), []);
    await prisma.contentBlock.update({ where: { id }, data: { endsAt: null, isPublished: false } });
    assert.deepEqual(await repository.search(title), []);
    await new ReindexContentUseCase(prisma as never, repository).execute([id]);
    assert.equal((await prisma.searchDocument.findFirstOrThrow({ where: { contentBlockId: id } })).isActive, false);
  });

  it('editing published content atomically captures intent and refreshes title, text and placement', async () => {
    const id = randomUUID();
    const originalTitle = `EX073-before-${id}`;
    const updatedTitle = `EX073-after-${id}`;
    await prisma.contentBlock.create({ data: { id, title: originalTitle, type: 'text_section', placementKey: 'ex073-before', body: {}, isPublished: true } });
    await new ReindexContentUseCase(prisma as never, repository).execute([id]);
    const response = await http.patch(`/api/v1/admin/content/${id}`).set('Authorization', `Bearer ${token}`).send({
      title: updatedTitle, placementKey: 'ex073-after', body: { text: 'EX073 edited body' }, priority: 33,
    });
    assert.equal(response.status, 200);
    const projection = await prisma.searchDocument.findFirstOrThrow({ where: { contentBlockId: id } });
    assert.equal(projection.title, updatedTitle);
    assert.equal(projection.placementKey, 'ex073-after');
    assert.equal(projection.priority, 33);
    assert.ok(projection.searchText.includes('EX073 edited body'));
    assert.deepEqual(await repository.search(originalTitle), []);
    assert.equal((await repository.autocomplete(updatedTitle)).includes(updatedTitle), true);
    const intent = await prisma.domainEventOutbox.findFirstOrThrow({ where: { eventName: 'content.published', payload: { path: ['contentId'], equals: id } } });
    assert.equal(intent.eligibility, 'held');
    assert.equal(await prisma.domainEventInbox.count({ where: { eventId: intent.eventId, consumerKey: 'search-projection.v1', status: 'completed' } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { entityId: id, action: 'content.updated' } }), 1);
  });

  it('rejects missing/structured queries and invalid limits through HTTP without 500s', async () => {
    for (const route of ['/api/v1/search', '/api/v1/search/autocomplete']) {
      assert.equal((await http.get(route)).status, 400);
      for (const q of ['?q[x]=sku', '?q=a&q=b', '?q=sku&limit=-1', '?q=sku&limit=1e2', '?q=sku&limit=101']) {
        assert.equal((await http.get(`${route}${q}`)).status, 400);
      }
      assert.equal((await http.get(route).query({ q: "sku' OR 1=1 --", limit: 100 })).status, 200);
      assert.equal((await http.get(route).query({ q: 'x'.repeat(257) })).status, 400);
    }
  });

  it('manual reindex returns 401/403 and allowed operations have persisted count audits', async () => {
    const viewer = await loginAsAdmin(http, fixture.users.viewerEmail, fixture.users.viewerPassword, fixture.users.twoFactorSecret);
    for (const kind of ['variants', 'content']) {
      const path = `/api/v1/admin/search/reindex/${kind}`;
      assert.equal((await http.post(path).send({ ids: [] })).status, 401);
      assert.equal((await http.post(path).set('Authorization', `Bearer ${viewer.accessToken}`).send({ ids: [] })).status, 403);
      assert.equal((await http.post(path).set('Authorization', `Bearer ${token}`).send({ ids: Array.from({ length: 1001 }, () => randomUUID()) })).status, 400);
      const response = await http.post(path).set('Authorization', `Bearer ${token}`).send({ ids: [randomUUID()] });
      assert.equal(response.status, 201);
      assert.equal(response.body.reindexed, 0);
      const completed = await prisma.auditLog.findFirstOrThrow({ where: { action: 'search.reindex_completed', entityType: 'search_projection' }, orderBy: { createdAt: 'desc' } });
      assert.equal((completed.afterData as { reindexed: number }).reindexed, 0);
      assert.equal((completed.afterData as { projectionKind: string }).projectionKind, kind === 'variants' ? 'variant' : 'content');
      assert.equal(await prisma.auditLog.count({ where: { action: 'search.reindex_requested', entityId: completed.entityId } }), 1);
    }
  });

  it('audit-start failure leaves projections unchanged and reports HTTP failure', async () => {
    const audit = nest.get(PrismaAuditRepository);
    const original = audit.write.bind(audit);
    const before = await prisma.searchDocument.findMany({ orderBy: { id: 'asc' } });
    const injection = mock.method(audit, 'write', async (...args: Parameters<typeof audit.write>) => {
      if (args[0].action === 'search.reindex_requested') throw new Error('EX073 audit-start injection');
      return original(...args);
    });
    try {
      assert.equal((await http.post('/api/v1/admin/search/reindex/variants').set('Authorization', `Bearer ${token}`).send({ ids: [] })).status, 500);
      assert.deepEqual(await prisma.searchDocument.findMany({ orderBy: { id: 'asc' } }), before);
    } finally { injection.mock.restore(); }
  });

  it('concurrent duplicate content events produce one projection/receipt and conflicting identity fails closed', async () => {
    const id = randomUUID();
    const title = `EX073-replay-${id}`;
    await prisma.contentBlock.create({ data: { id, title, type: 'text_section', placementKey: 'ex073', body: {}, isPublished: true } });
    const registry = new DomainEventHandlerRegistry();
    const publisher = new InMemoryDomainEventPublisher();
    new SearchEventSubscriber(publisher, new ReindexContentUseCase(prisma as never, repository),
      new ReindexVariantsUseCase(prisma as never, repository), registry, new PrismaDomainEventInboxRepository(prisma as never)).onModuleInit();
    const event: VersionedDomainEvent = { eventId: randomUUID(), eventName: 'content.published', eventVersion: 'v1', occurredAt: new Date().toISOString(), payload: { contentId: id, placementKey: 'ex073', title } };
    try {
      await Promise.all(Array.from({ length: 8 }, () => registry.dispatch(event)));
      assert.equal(await prisma.searchDocument.count({ where: { contentBlockId: id } }), 1);
      assert.equal(await prisma.domainEventInbox.count({ where: { eventId: event.eventId, consumerKey: 'search-projection.v1', status: 'completed' } }), 1);
      await assert.rejects(registry.dispatch({ ...event, payload: { ...event.payload, title: 'conflicting replay' } }), ConflictingDomainEventReplayError);
      assert.equal((await prisma.searchDocument.findFirstOrThrow({ where: { contentBlockId: id } })).title, title);
    } finally { publisher.onModuleDestroy(); }
  });

  it('thousand-row variant batches are bounded and retry a rolled-back second batch through the frozen cursor', async () => {
    const ids = Array.from({ length: 1000 }, () => randomUUID()).sort();
    await prisma.variant.createMany({ data: ids.map((id) => ({ id, name: 'EX073 large batch', sku: `EX073-batch-${id}`, price: '1' })) });
    const reindex = new ReindexVariantsUseCase(prisma as never, repository);
    const inbox = new PrismaDomainEventInboxRepository(prisma as never);
    const event: VersionedDomainEvent = { eventId: randomUUID(), eventName: 'variant.updated', eventVersion: 'v1', occurredAt: new Date().toISOString(), payload: { variantId: ids[0], productId: null, sku: `EX073-batch-${ids[0]}`, isActive: true } };
    let batches = 0;
    let fail = true;
    const original = repository.upsertVariantDocuments.bind(repository);
    const injection = mock.method(repository, 'upsertVariantDocuments', async (...args: Parameters<typeof original>) => {
      assert.ok(args[0].length <= 50);
      await original(...args);
      batches += 1;
      if (fail && batches === 2) { fail = false; throw new Error('EX073 second batch injection'); }
    });
    const run = () => inbox.runBatches('search-projection.v1', event,
      (tx) => reindex.upperBound(tx, ids), (tx, cursor, upper) => reindex.batch(tx, cursor, upper, ids));
    try {
      await assert.rejects(run(), /EX073 second batch injection/);
      const receipt = await prisma.domainEventInbox.findUniqueOrThrow({ where: { consumerKey_eventId: { consumerKey: 'search-projection.v1', eventId: event.eventId! } } });
      assert.equal(receipt.status, 'processing');
      assert.equal(receipt.progressCursor, ids[49]);
      assert.equal(receipt.progressUpperBound, ids[999]);
      assert.equal(await prisma.searchDocument.count({ where: { variantId: { in: ids } } }), 50);
      await run();
      assert.equal(await prisma.searchDocument.count({ where: { variantId: { in: ids } } }), 1000);
      const completed = await prisma.domainEventInbox.findUniqueOrThrow({ where: { id: receipt.id } });
      assert.equal(completed.status, 'completed');
      assert.equal(completed.progressCursor, ids[999]);
      // The exact multiple of 50 requires a final empty page rather than an endless loop.
      assert.equal(batches, 22);
      const beforeReplay = batches;
      await Promise.all([run(), run()]);
      assert.equal(batches, beforeReplay);
      assert.equal(await prisma.searchDocument.count({ where: { variantId: { in: ids } } }), 1000);
    } finally { injection.mock.restore(); }
  });
});
