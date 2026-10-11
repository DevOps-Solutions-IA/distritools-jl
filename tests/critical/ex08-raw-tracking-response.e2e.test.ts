import 'tests/helpers/test-env';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { generate } from 'otplib';
import type { ShippingProviderPort, ShipmentResult } from 'src/modules/shipping/application/ports/shipping-provider.port';
import { prisma, resetDatabase, seedBaseData, disconnectDatabase } from 'tests/helpers/test-db';

if (process.env.EX08_RAW_TRACKING_CHILD === '1') {
  describe('raw tracking privacy boundary against real PostgreSQL and compiled HTTP', () => {
    const { AppModule } = require('../../dist/src/app/app.module');
    const { GlobalExceptionFilter } = require('../../dist/src/common/filters/global-exception.filter');
    const { MetricsInterceptor } = require('../../dist/src/infra/telemetry/metrics/metrics.interceptor');
    const { SHIPPING_PROVIDER_PORT } = require('../../dist/src/modules/shipping/application/ports/shipping-provider.port');
    const { PrismaService } = require('../../dist/src/infra/db/prisma/prisma.service');
    let app: import('@nestjs/common').INestApplication;
    let http: ReturnType<typeof request>;
    let tracking: string;
    let shipping: string;
    let roleId: string;
    let noGuide: string;
    let withGuide: string;
    let initial: string;
    let provider: ShippingProviderPort;
    let originalProvider: ShippingProviderPort['getShipmentStatus'];
    let providerFailure = false;
    let lastProviderResult: ShipmentResult;
    const providerCalls: string[] = [];
    const occurredAt = new Date('2026-10-11T12:00:00.000Z');
    const eventId = (branch: number, n: number) => `019a1000-000${branch}-7000-8000-${String(n).padStart(12, '0')}`;
    const get = (id: string, access = tracking) => http.get(`/api/v1/admin/shipments/${id}/tracking`).set('Authorization', `Bearer ${access}`);
    async function snapshot() {
      return JSON.stringify({ orders: await prisma.order.findMany({ orderBy: { id: 'asc' } }), customers: await prisma.customer.findMany({ orderBy: { id: 'asc' } }), shipments: await prisma.shipment.findMany({ orderBy: { id: 'asc' } }), events: await prisma.shipmentEvent.findMany({ orderBy: { id: 'asc' } }), notifications: await prisma.notification.findMany({ orderBy: { id: 'asc' } }) });
    }
    before(async () => {
      // The existing adapter is local/test only; no guide creation or real provider.
      process.env.SHIPPING_PROVIDER = 'mock_99envios';
      await resetDatabase(); const seeded = await seedBaseData();
      const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
      app = module.createNestApplication({ rawBody: true }); app.setGlobalPrefix('api/v1');
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
      app.useGlobalFilters(new GlobalExceptionFilter()); app.useGlobalInterceptors(app.get(MetricsInterceptor)); await app.init(); http = request(app.getHttpServer());
      async function login(email: string) {
        const response = await http.post('/api/v1/auth/login').send({ email, password: seeded.users.viewerPassword }); assert.equal(response.status, 201);
        const remaining = 30000 - Date.now() % 30000; if (remaining < 5000) await new Promise(resolve => setTimeout(resolve, remaining + 30));
        const verify = await http.post('/api/v1/auth/verify-2fa').send({ challengeToken: response.body.challengeToken, code: await generate({ secret: seeded.users.twoFactorSecret }) }); assert.equal(verify.status, 201); assert.equal(typeof verify.body.accessToken, 'string'); return verify.body.accessToken as string;
      }
      const baseUser = await prisma.user.findUniqueOrThrow({ where: { id: seeded.users.viewerUserId } });
      for (const slug of ['tracking.read', 'shipping.read']) {
        const role = await prisma.role.create({ data: { id: crypto.randomUUID(), name: 'Raw boundary '+slug, slug: 'raw-'+slug.replace('.', '-') } });
        const permission = await prisma.permission.findUniqueOrThrow({ where: { slug } }); await prisma.rolePermission.create({ data: { id: crypto.randomUUID(), roleId: role.id, permissionId: permission.id } });
        const email = 'raw-'+slug.replace('.', '-')+'@example.test'; await prisma.user.create({ data: { id: crypto.randomUUID(), roleId: role.id, fullName: 'Boundary read-only', email, passwordHash: baseUser.passwordHash, twoFactorSecret: seeded.users.twoFactorSecret, isActive: true } });
        const access = await login(email); if (slug === 'tracking.read') { tracking = access; roleId = role.id; } else shipping = access;
      }
      const customer = await prisma.customer.create({ data: { id: crypto.randomUUID(), fullName: 'Synthetic private customer', email: 'private@example.test', phone: '3005557799', defaultAddress: 'Synthetic private address' } });
      for (const branch of [1, 2]) {
        const order = await prisma.order.create({ data: { id: crypto.randomUUID(), orderNumber: 'DTJL-20261011-00000'+branch, status: 'pending_payment', customerName: customer.fullName, customerEmail: customer.email, customerPhone: customer.phone!, shippingAddress: 'Synthetic private address', shippingCity: 'Cali', subtotal: 1000, discountTotal: 0, taxTotal: 0, shippingTotal: 0, grandTotal: 1000, customerId: customer.id } });
        const shipment = await prisma.shipment.create({ data: { id: crypto.randomUUID(), orderId: order.id, customerId: customer.id, provider: branch === 2 ? 'mock_99envios' : 'none', trackingNumber: branch === 2 ? 'MOCK99-PRIVACY-LOCAL' : null, status: 'pending_provider', addressSnapshot: { address: 'Synthetic private address' }, packageSnapshot: { private: 'synthetic-only' } } });
        if (branch === 1) noGuide = shipment.id; else withGuide = shipment.id;
        await prisma.shipmentEvent.createMany({ data: Array.from({ length: 105 }, (_, n) => ({ id: eventId(branch, n), shipmentId: shipment.id, status: 'pending_provider' as const, occurredAt, description: 'private@example.test', location: 'Synthetic private address', rawPayload: { customerEmail: 'private@example.test', credential: 'synthetic-only' }, providerStatus: 'synthetic-provider-detail' })) });
      }
      provider = app.get(SHIPPING_PROVIDER_PORT); originalProvider = provider.getShipmentStatus.bind(provider);
      provider.getShipmentStatus = async (guide: string) => { providerCalls.push(guide); if (providerFailure) throw new Error('Controlled local provider read failure'); lastProviderResult = await originalProvider(guide); return lastProviderResult; };
      initial = await snapshot();
    });
    after(async () => { if (provider) provider.getShipmentStatus = originalProvider; if (app) await app.close(); await disconnectDatabase(); });
    it('no-guide response returns100 safe events without PII and keeps operational envelope', async () => {
      providerCalls.length = 0; const response = await get(noGuide); assert.equal(response.status, 200);
      assert.equal(response.body.events.length, 100); assert.deepEqual(Object.keys(response.body.events[0]).sort(), ['id', 'occurredAt', 'status']);
      for (const value of ['private@example.test', 'Synthetic private address', 'synthetic-only', 'rawPayload', 'description', 'location']) assert.equal(JSON.stringify(response.body).includes(value), false);
      assert.equal(response.body.shipmentId, noGuide); assert.equal(response.body.trackingNumber, null);
      assert.deepEqual(response.body.operationalState, { status: 'pending_guide', message: 'No hay guía externa. Se conserva tracking interno.' }); assert.deepEqual(providerCalls, []);
    });
    it('guide response also returns100 safe events and preserves the existing mock provider envelope', async () => {
      providerCalls.length = 0; const response = await get(withGuide); assert.equal(response.status, 200); assert.equal(response.body.events.length, 100);
      assert.deepEqual(Object.keys(response.body.events[0]).sort(), ['id', 'occurredAt', 'status']); assert.equal(JSON.stringify(response.body).includes('private@example.test'), false);
      assert.deepEqual(response.body.providerStatus, JSON.parse(JSON.stringify(lastProviderResult))); assert.deepEqual(providerCalls, ['MOCK99-PRIVACY-LOCAL']);
      assert.deepEqual(Object.keys(response.body).sort(), ['events', 'providerStatus', 'shipmentId']);
    });
    it('timestamp ties are deterministically descending by id and repeat reads remain stable', async () => {
      const first = await get(noGuide); const second = await get(noGuide); assert.equal(first.status, 200); assert.equal(second.status, 200);
      const expected = Array.from({ length: 100 }, (_, i) => eventId(1, 104-i)); assert.deepEqual(first.body.events.map((e: { id: string }) => e.id), expected);
      assert.deepEqual(second.body.events, first.body.events); assert.equal(await prisma.shipmentEvent.count({ where: { shipmentId: noGuide } }), 105);
    });
    it('requires tracking.read: anonymous401, shipping-only403, unknown shipment404, zero provider calls', async () => {
      providerCalls.length = 0; assert.equal((await http.get(`/api/v1/admin/shipments/${noGuide}/tracking`)).status, 401);
      assert.equal((await get(noGuide, shipping)).status, 403); assert.equal((await get('019a1000-0000-7000-8000-000000000999')).status, 404); assert.deepEqual(providerCalls, []);
    });
    it('revocation and restoration use current grants for the same JWT and persist denied-route audit', async () => {
      assert.equal((await get(noGuide)).status, 200); const grant = await prisma.rolePermission.findFirstOrThrow({ where: { roleId, permission: { slug: 'tracking.read' } } });
      const denied = { action: 'auth.permission_denied', entityId: `GET /api/v1/admin/shipments/${noGuide}/tracking` }; const count = await prisma.auditLog.count({ where: denied }); await prisma.rolePermission.delete({ where: { id: grant.id } });
      try { assert.equal((await get(noGuide)).status, 403); for (let n=0;n<40 && await prisma.auditLog.count({ where: denied })<=count;n++) await new Promise(resolve => setTimeout(resolve,50)); assert.ok(await prisma.auditLog.count({ where: denied })>count); }
      finally { await prisma.rolePermission.create({ data: grant }); }
      assert.equal((await get(noGuide)).status, 200);
    });
    it('preserves provider failures as500 and supports normal recovery without writing shipment data', async () => {
      providerFailure = true; const before = await snapshot(); try { assert.equal((await get(withGuide)).status, 500); assert.equal(await snapshot(), before); }
      finally { providerFailure = false; }
      assert.equal((await get(withGuide)).status, 200);
    });
    it('database read failures are500 rather than empty success and do not invoke provider', async () => {
      const client = app.get<{ shipment: { findUnique: (query: { where: { id: string } }) => Promise<unknown> } }>(PrismaService); const original = client.shipment.findUnique.bind(client.shipment); providerCalls.length = 0;
      client.shipment.findUnique = async (query: Parameters<typeof original>[0]) => { if (query.where.id === noGuide) throw new Error('Controlled synthetic-only database read failure'); return original(query); };
      try { const response = await get(noGuide); assert.equal(response.status, 500); assert.equal(response.body.error, 'Controlled synthetic-only database read failure'); assert.equal(response.body.statusCode, 500); assert.equal(typeof response.body.correlationId, 'string'); assert.deepEqual(providerCalls, []); }
      finally { client.shipment.findUnique = original; }
      assert.equal((await get(noGuide)).status, 200);
    });
    it('all read/error/permission operations preserve complete persisted business rows', async () => { assert.equal(await snapshot(), initial); });
  });
} else {
  it('runs eight raw-tracking real HTTP/PostgreSQL cases against fresh compiled metadata', () => {
    const fs = require('node:fs') as typeof import('node:fs'); const path = require('node:path') as typeof import('node:path'); const os = require('node:os') as typeof import('node:os'); const { spawnSync } = require('node:child_process') as typeof import('node:child_process'); const root = path.resolve(__dirname, '../..');
    const build = spawnSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'], { cwd: root, encoding: 'utf8', timeout: 90000 }); assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ex08-raw-tracking-compiled-')); const config = path.join(dir, 'tsconfig.json'); fs.writeFileSync(config, JSON.stringify({ compilerOptions: { module: 'commonjs', target: 'ES2022', experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true } }));
    const env: NodeJS.ProcessEnv = { ...process.env, EX08_RAW_TRACKING_CHILD: '1', NODE_PATH: `${path.join(root, 'dist')}:${root}:${path.join(root, 'node_modules')}` }; delete env.NODE_TEST_CONTEXT;
    const run = spawnSync(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), '--tsconfig', config, '--test', '--test-concurrency=1', __filename], { cwd: root, encoding: 'utf8', timeout: 90000, env });
    fs.writeFileSync(path.join(dir, 'child-result.log'), `${run.stdout}\n${run.stderr}`);
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`); assert.match(run.stdout, /# pass 8/); assert.match(run.stdout, /# fail 0/); assert.match(run.stdout, /# skipped 0/);
  });
}
