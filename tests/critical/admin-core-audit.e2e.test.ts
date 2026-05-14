import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
  seedBaseData,
} from 'tests/helpers/test-db';

const originalEnv = { ...process.env };

async function boot() {
  process.env = {
    ...originalEnv,
    APP_ENV: 'production',
    ADMIN_AUTH_DISABLED: 'true',
    SHIPPING_PROVIDER: 'mock_99envios',
    AUTO_SHIPPING_ENABLED: 'false',
    AUTO_SHIPPING_MODE: 'disabled',
    NINETY_NINE_ENVIOS_AUTH_EMAIL: '',
    NINETY_NINE_ENVIOS_AUTH_PASSWORD: '',
  };
  await resetDatabase();
  const seeded = await seedBaseData();
  const testApp = await createTestApp();
  const admin = await loginAsAdmin(
    testApp.http,
    seeded.users.adminEmail,
    seeded.users.adminPassword,
    seeded.users.twoFactorSecret,
  );
  const viewer = await loginAsAdmin(
    testApp.http,
    seeded.users.viewerEmail,
    seeded.users.viewerPassword,
    seeded.users.twoFactorSecret,
  );

  return { ...testApp, seeded, adminToken: admin.accessToken, viewerToken: viewer.accessToken };
}

function checkoutPayload(seeded: Awaited<ReturnType<typeof seedBaseData>>) {
  return {
    customer: {
      fullName: 'Admin Core Audit Buyer',
      email: `admin-core-audit-${Date.now()}@example.com`,
      phone: '3005557733',
      document: '900123456',
    },
    shippingAddress: {
      city: 'Cali',
      department: 'Valle del Cauca',
      daneCode: '76001000',
      addressLine1: 'Carrera 44 # 10-15',
      notes: 'Auditoria admin core',
    },
    items: [
      {
        productId: seeded.inventory.productId,
        variantId: seeded.inventory.variantId,
        quantity: 1,
      },
    ],
    deliveryMethod: 'standard',
    paymentMethod: 'cash_on_delivery',
  };
}

const requiredAdminRoutes = [
  ['/', 'page.tsx'],
  ['/dashboard', 'dashboard/page.tsx'],
  ['/productos', 'productos/page.tsx'],
  ['/marcas', 'marcas/page.tsx'],
  ['/categorias', 'categorias/page.tsx'],
  ['/inventario', 'inventario/page.tsx'],
  ['/precios', 'precios/page.tsx'],
  ['/pedidos', 'pedidos/page.tsx'],
  ['/cotizaciones', 'cotizaciones/page.tsx'],
  ['/clientes', 'clientes/page.tsx'],
  ['/pagos', 'pagos/page.tsx'],
  ['/envios', 'envios/page.tsx'],
  ['/rastreo', 'rastreo/page.tsx'],
  ['/reportes', 'reportes/page.tsx'],
  ['/legal', 'legal/page.tsx'],
  ['/footer', 'footer/page.tsx'],
  ['/configuracion', 'configuracion/page.tsx'],
  ['/notificaciones', 'notificaciones/page.tsx'],
  ['/usuarios', 'usuarios/page.tsx'],
  ['/roles', 'roles/page.tsx'],
  ['/auditoria', 'auditoria/page.tsx'],
] as const;

describe('Enterprise admin core audit guards', () => {
  afterEach(async () => {
    process.env = { ...originalEnv };
    await disconnectDatabase();
  });

  it('keeps all declared admin module routes physically present', () => {
    const adminRoot = join(process.cwd(), 'frontend/src/app/admin');

    for (const [route, file] of requiredAdminRoutes) {
      assert.equal(
        existsSync(join(adminRoot, file)),
        true,
        `Missing admin route ${route} at ${file}`,
      );
    }
  });

  it('does not protect known mutating admin endpoints with read-only permissions', () => {
    const controller = readFileSync(
      'src/modules/admin-operations/infrastructure/http/controllers/admin-operations.controller.ts',
      'utf8',
    );

    const forbiddenPairs = [
      ["@Permissions('orders.read')", "@Patch('orders/:orderId/status')"],
      ["@Permissions('orders.read')", "@Post('orders/:orderId/internal-note')"],
      ["@Permissions('orders.read')", "@Post('quotes')"],
      ["@Permissions('orders.read')", "@Post('quotes/:quoteId/price-items')"],
      ["@Permissions('payments.read')", "@Post('payments/:paymentId/reconcile-cod')"],
      ["@Permissions('orders.read')", "@Post('shipments/:orderId/create')"],
      ["@Permissions('orders.read')", "@Post('customers/:customerId/view-sensitive')"],
      ["@Permissions('orders.read')", "@Post('customers/export')"],
      ["@Permissions('variants.manage')", "@Post('prices/update')"],
      ["@Permissions('content.manage')", "@Patch('settings')"],
    ];

    for (const [permission, route] of forbiddenPairs) {
      const permissionIndex = controller.indexOf(permission);
      const routeIndex = controller.indexOf(route);
      if (permissionIndex === -1 || routeIndex === -1) {
        continue;
      }
      assert.equal(
        Math.abs(routeIndex - permissionIndex) > 160,
        true,
        `${route} sigue protegido con permiso insuficiente ${permission}`,
      );
    }
  });

  it('requires authentication for core admin APIs and blocks limited users server-side', async () => {
    const { app, http, viewerToken } = await boot();

    const unauthenticatedOrders = await http.get('/api/v1/admin/orders');
    assert.equal(unauthenticatedOrders.status, 401);

    const inventoryAdjust = await http
      .patch('/api/v1/admin/inventory/adjust')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        variantId: uuidv7(),
        warehouseId: uuidv7(),
        adjustment: 1,
        reason: 'Debe bloquearse por RBAC',
      });
    assert.equal(inventoryAdjust.status, 403);

    const orderMutation = await http
      .patch(`/api/v1/admin/orders/${uuidv7()}/status`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ status: 'confirmed' });
    assert.equal(orderMutation.status, 403);

    const paymentMutation = await http
      .post(`/api/v1/admin/payments/${uuidv7()}/reconcile-cod`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ amount: 10000 });
    assert.equal(paymentMutation.status, 403);

    const shippingMutation = await http
      .post(`/api/v1/admin/orders/${uuidv7()}/auto-shipping/retry`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({});
    assert.equal(shippingMutation.status, 403);

    const quoteMutation = await http
      .post('/api/v1/admin/quotes')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({});
    assert.equal(quoteMutation.status, 403);

    const sensitiveCustomer = await http
      .post(`/api/v1/admin/customers/${uuidv7()}/view-sensitive`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({});
    assert.equal(sensitiveCustomer.status, 403);

    const priceMutation = await http
      .post('/api/v1/admin/prices/update')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({});
    assert.equal(priceMutation.status, 403);

    const settingsMutation = await http
      .patch('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ general: { storeName: 'No autorizado' } });
    assert.equal(settingsMutation.status, 403);

    await app.close();
  });

  it('keeps public tracking free of PII and blocks production readiness with known missing providers', async () => {
    const { app, http, seeded, adminToken } = await boot();

    const checkout = await http.post('/api/v1/checkout/guest-order').send(checkoutPayload(seeded));
    assert.equal(checkout.status, 201);
    assert.ok(checkout.body.trackingCode);

    await prisma.payment.create({
      data: {
        id: uuidv7(),
        orderId: checkout.body.orderId,
        gateway: 'cash_on_delivery',
        gatewayReference: `COD-${checkout.body.orderNumber}`,
        amount: 25000,
        currency: 'COP',
        status: 'pending',
      },
    });

    const publicTracking = await http.get('/api/v1/orders/track').query({
      query: checkout.body.trackingCode,
    });
    assert.equal(publicTracking.status, 200);
    const publicBody = JSON.stringify(publicTracking.body);
    assert.equal(publicBody.includes('admin-core-audit-'), false);
    assert.equal(publicBody.includes('3005557733'), false);
    assert.equal(publicBody.includes('Carrera 44'), false);

    const settings = await http
      .get('/api/v1/admin/settings')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(settings.status, 200);
    assert.equal(Array.isArray(settings.body.moduleReadiness), true);
    assert.equal(Boolean(settings.body.featureFlags), true);
    assert.equal(
      settings.body.moduleReadiness.some(
        (module: { module: string; status: string }) =>
          module.module === 'shipping' && module.status === 'BLOCKED_PROVIDER',
      ),
      true,
    );
    assert.equal(settings.body.productionReadiness.status, 'BLOCKED_FOR_PRODUCTION');
    assert.equal(settings.body.productionReadiness.mode, 'production_blocked');
    assert.equal(JSON.stringify(settings.body.productionReadiness).includes('Login admin desactivado'), true);
    assert.equal(JSON.stringify(settings.body.productionReadiness).includes('mock_99envios no puede operar como producción'), true);

    await app.close();
  });
});
