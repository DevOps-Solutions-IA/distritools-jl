import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
  seedBaseData,
} from 'tests/helpers/test-db';

async function boot() {
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

describe('Enterprise inventory closure', () => {
  afterEach(async () => {
    await disconnectDatabase();
  });

  it('exposes enterprise overview, settings, valuation and low-stock alerts from real inventory data', async () => {
    const { app, http, seeded, adminToken } = await boot();

    const settings = await http
      .patch(`/api/v1/admin/inventory/settings/${seeded.inventory.variantId}/${seeded.inventory.warehouseId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        minStock: 10,
        reorderPoint: 10,
        reorderQty: 4,
        costPrice: 120000,
      });
    assert.equal(settings.status, 200);
    assert.equal(settings.body.costConfigured, true);

    const overview = await http
      .get('/api/v1/admin/inventory/overview')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(overview.status, 200);
    assert.equal(overview.body.summary.skuCount > 0, true);
    assert.equal(overview.body.data.some((row: { committedStock: number }) => row.committedStock === 0), true);

    const valuation = await http
      .get('/api/v1/admin/inventory/valuation')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(valuation.status, 200);
    assert.equal(valuation.body.totalValue > 0, true);

    const alerts = await http
      .get('/api/v1/admin/inventory/alerts')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(alerts.status, 200);
    assert.equal(
      alerts.body.data.some((alert: { code: string; sku: string }) => alert.code === 'inventory.low_stock' && alert.sku),
      true,
    );

    await app.close();
  });

  it('records manual adjustments in kardex with before/after quantities and audit log', async () => {
    const { app, http, seeded, adminToken, viewerToken } = await boot();

    const forbidden = await http
      .patch('/api/v1/admin/inventory/adjust')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
        quantityDelta: 1,
        reason: 'viewer-blocked',
        referenceId: 'viewer-adjust',
      });
    assert.equal(forbidden.status, 403);

    const before = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });
    const adjustment = await http
      .patch('/api/v1/admin/inventory/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        variantId: seeded.inventory.variantId,
        warehouseId: seeded.inventory.warehouseId,
        quantityDelta: 2,
        reason: 'conteo-caja-entrada',
        referenceId: 'enterprise-adjust-1',
      });
    assert.equal(adjustment.status, 200);

    const history = await http
      .get('/api/v1/admin/inventory/history')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ referenceId: 'enterprise-adjust-1' });
    assert.equal(history.status, 200);
    assert.equal(history.body.data[0].type, 'manual_adjustment_in');
    assert.equal(history.body.data[0].quantityBefore, before.onHandQty);
    assert.equal(history.body.data[0].quantityAfter, before.onHandQty + 2);

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'inventory.adjusted', entityId: `${seeded.inventory.variantId}:${seeded.inventory.warehouseId}` },
    });
    assert.ok(audit);

    await app.close();
  });

  it('handles sellable and damaged returns without exceeding sold quantity', async () => {
    const { app, http, seeded, adminToken } = await boot();

    const checkout = await http.post('/api/v1/checkout/guest-order').send({
      customer: {
        fullName: 'Inventory Return Buyer',
        email: 'inventory-return@example.com',
        phone: '3005551010',
      },
      shippingAddress: {
        city: 'Cali',
        addressLine1: 'Calle Inventario 1',
      },
      items: [
        {
          productId: seeded.inventory.productId,
          variantId: seeded.inventory.variantId,
          quantity: 2,
        },
      ],
      paymentMethod: 'cash_on_delivery',
    });
    assert.equal(checkout.status, 201);

    const orderItem = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: checkout.body.orderId },
    });
    const before = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: orderItem.variantId, warehouseId: orderItem.warehouseId } },
    });

    const sellable = await http
      .post('/api/v1/admin/inventory/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderItemId: orderItem.id,
        warehouseId: orderItem.warehouseId,
        quantity: 1,
        condition: 'sellable',
        reason: 'cliente devolvio sellable',
      });
    assert.equal(sellable.status, 201);

    const afterSellable = await prisma.inventoryItem.findUniqueOrThrow({
      where: { variantId_warehouseId: { variantId: orderItem.variantId, warehouseId: orderItem.warehouseId } },
    });
    assert.equal(afterSellable.onHandQty, before.onHandQty + 1);

    const damaged = await http
      .post('/api/v1/admin/inventory/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderItemId: orderItem.id,
        warehouseId: orderItem.warehouseId,
        quantity: 1,
        condition: 'damaged',
        reason: 'herramienta golpeada',
      });
    assert.equal(damaged.status, 201);

    const excessive = await http
      .post('/api/v1/admin/inventory/returns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        orderItemId: orderItem.id,
        warehouseId: orderItem.warehouseId,
        quantity: 1,
        condition: 'sellable',
        reason: 'duplicada',
      });
    assert.equal(excessive.status, 409);

    await app.close();
  });

  it('closes physical counts and applies corrections through kardex movements', async () => {
    const { app, http, seeded, adminToken, viewerToken } = await boot();
    const inventory = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });

    const session = await http
      .post('/api/v1/admin/inventory/count-sessions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        warehouseId: seeded.inventory.warehouseId,
        notes: 'conteo fisico mayo',
        lines: [{ variantId: seeded.inventory.variantId, countedQuantity: inventory.onHandQty + 3 }],
      });
    assert.equal(session.status, 201);

    const closeForbidden = await http
      .post(`/api/v1/admin/inventory/count-sessions/${session.body.id}/close`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({});
    assert.equal(closeForbidden.status, 403);

    const close = await http
      .post(`/api/v1/admin/inventory/count-sessions/${session.body.id}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    assert.equal(close.status, 201);
    assert.equal(close.body.movements.length >= 1, true);

    const movement = await prisma.stockMovement.findFirst({
      where: { referenceType: 'inventory_count', referenceId: session.body.id },
    });
    assert.equal(movement?.movementType, 'physical_count_correction');

    await app.close();
  });

  it('runs import dry-run before apply and protects export with inventory.export', async () => {
    const { app, http, seeded, adminToken, viewerToken } = await boot();

    const variant = await prisma.variant.findUniqueOrThrow({ where: { id: seeded.inventory.secondVariantId } });
    const warehouse = await prisma.warehouse.findUniqueOrThrow({ where: { id: seeded.inventory.warehouseId } });
    const dryRun = await http
      .post('/api/v1/admin/inventory/imports/dry-run')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        filename: 'inventory.csv',
        csv: `sku,warehouseCode,quantity,mode,reason\n${variant.sku},${warehouse.code},3,increment,compra proveedor`,
      });
    assert.equal(dryRun.status, 201);
    assert.equal(dryRun.body.validRows, 1);
    assert.equal(dryRun.body.errorRows, 0);

    const applied = await http
      .post(`/api/v1/admin/inventory/imports/${dryRun.body.id}/apply`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    assert.equal(applied.status, 201);
    assert.equal(applied.body.movements.length, 1);

    const exportForbidden = await http
      .get('/api/v1/admin/inventory/export')
      .set('Authorization', `Bearer ${viewerToken}`);
    assert.equal(exportForbidden.status, 403);

    const exported = await http
      .get('/api/v1/admin/inventory/export')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.equal(exported.status, 200);
    assert.match(exported.text, /sku,product,variant,warehouseCode/);
    assert.match(exported.text, new RegExp(variant.sku));

    await app.close();
  });
});
