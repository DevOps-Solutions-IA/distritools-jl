import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
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
    assert.equal(settings.body.productionReadiness.status, 'BLOCKED_FOR_PRODUCTION');
    assert.equal(settings.body.productionReadiness.mode, 'production_blocked');
    assert.equal(JSON.stringify(settings.body.productionReadiness).includes('Login admin desactivado'), true);
    assert.equal(JSON.stringify(settings.body.productionReadiness).includes('mock_99envios no puede operar como producción'), true);

    await app.close();
  });
});
