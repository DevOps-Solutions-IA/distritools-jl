import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationPipe } from "@nestjs/common";
import { loginAsAdmin } from "tests/helpers/test-app";
import { Test } from "@nestjs/testing";
import { AppModule } from "src/app/app.module";
import request from "supertest";
async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ rawBody: true });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new MetricsInterceptor(app.get(MetricsService)));
  await app.init();
  return { app, http: request(app.getHttpServer()) };
}
import { assertDisposableTarget } from "tests/helpers/ex07-4-disposable-target";
import {
  prisma,
  resetDatabase,
  seedBaseData,
  disconnectDatabase,
} from "tests/helpers/test-db";
import { GlobalExceptionFilter } from "src/common/filters/global-exception.filter";
import { MetricsInterceptor } from "src/infra/telemetry/metrics/metrics.interceptor";
import { MetricsService } from "src/infra/telemetry/metrics/metrics.service";
import { randomUUID } from "node:crypto";
describe("EX08 SALE existing administrative contracts", () => {
  let app: Awaited<ReturnType<typeof createTestApp>>["app"];
  let http: Awaited<ReturnType<typeof createTestApp>>["http"];
  let token: string;
  let viewer: string;
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  before(async () => {
    assertDisposableTarget();
    await resetDatabase();
    seeded = await seedBaseData();
    const context = await createTestApp();
    app = context.app;
    http = context.http;
    token = (
      await loginAsAdmin(
        http,
        seeded.users.adminEmail,
        seeded.users.adminPassword,
        seeded.users.twoFactorSecret,
      )
    ).accessToken;
    viewer = (
      await loginAsAdmin(
        http,
        seeded.users.viewerEmail,
        seeded.users.viewerPassword,
        seeded.users.twoFactorSecret,
      )
    ).accessToken;
    assert.ok(token);
    assert.ok(viewer);
  });
  after(async () => {
    await app?.close();
    await disconnectDatabase();
  });
  const createOrder = async () => {
    const response = await http
      .post("/api/v1/orders")
      .send({
        customer: {
          fullName: "SALE Synthetic",
          email: "sale@example.test",
          phone: "3000000000",
        },
        shipping: { address: "Synthetic 1", city: "Cali" },
        items: [
          {
            variantId: seeded.inventory.variantId,
            warehouseId: seeded.inventory.warehouseId,
            quantity: 1,
          },
        ],
      });
    assert.equal(response.status, 201);
    return response.body.order as { id: string; orderNumber: string };
  };
  it("renders complete real details and authenticates payment/event reads", async () => {
    const order = await createOrder();
    const read = await http
      .get(`/api/v1/admin/orders/${order.id}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(read.status, 200);
    assert.equal(read.body.items.length, 1);
    assert.equal(read.body.id, order.id);
    const payment = await prisma.payment.create({
      data: {
        id: randomUUID(),
        orderId: order.id,
        gateway: "cash_on_delivery",
        gatewayReference: "sale-read",
        amount: "100.00",
        currency: "COP",
        status: "pending",
      },
    });
    for (const suffix of ["", "/events"]) {
      assert.equal(
        (await http.get(`/api/v1/admin/payments/${payment.id}${suffix}`))
          .status,
        401,
      );
      assert.equal(
        (
          await http
            .get(`/api/v1/admin/payments/${payment.id}${suffix}`)
            .set("Authorization", `Bearer ${viewer}`)
        ).status,
        403,
      );
      assert.equal(
        (
          await http
            .get(`/api/v1/admin/payments/${payment.id}${suffix}`)
            .set("Authorization", `Bearer ${token}`)
        ).status,
        200,
      );
    }
  });
  it("cancels through proven orderNumber contract, releases reservation and persists audit", async () => {
    const order = await createOrder();
    const before = await prisma.inventoryItem.findUniqueOrThrow({
      where: {
        variantId_warehouseId: {
          variantId: seeded.inventory.variantId,
          warehouseId: seeded.inventory.warehouseId,
        },
      },
    });
    assert.equal(
      (
        await http
          .post(`/api/v1/admin/orders/${order.orderNumber}/cancel`)
          .send({ reason: "cancel" })
      ).status,
      401,
    );
    assert.equal(
      (
        await http
          .post(`/api/v1/admin/orders/${order.orderNumber}/cancel`)
          .set("Authorization", `Bearer ${viewer}`)
          .send({ reason: "cancel" })
      ).status,
      403,
    );
    const response = await http
      .post(`/api/v1/admin/orders/${order.orderNumber}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "SALE cancelled" });
    assert.equal(response.status, 201);
    assert.equal(response.body.status, "cancelled");
    const after = await prisma.inventoryItem.findUniqueOrThrow({
      where: { id: before.id },
    });
    assert.equal(after.reservedQty, before.reservedQty - 1);
    assert.equal(after.onHandQty, before.onHandQty);
    assert.equal(
      (await prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
        .status,
      "cancelled",
    );
    assert.equal(
      await prisma.auditLog.count({
        where: { entityId: order.id, action: "order.cancelled" },
      }),
      1,
    );
    assert.equal(
      await prisma.stockMovement.count({
        where: { referenceId: order.id, movementType: "release" },
      }),
      1,
    );
    const repeated = await http
      .post(`/api/v1/admin/orders/${order.orderNumber}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ reason: "repeat" });
    assert.equal(repeated.status, 409);
    assert.equal(
      (
        await prisma.inventoryItem.findUniqueOrThrow({
          where: { id: before.id },
        })
      ).reservedQty,
      after.reservedQty,
    );
  });
  it("reconciles only COD through existing gateway permission and audits durable payment", async () => {
    const order = await createOrder();
    const payment = await prisma.payment.create({
      data: {
        id: randomUUID(),
        orderId: order.id,
        gateway: "cash_on_delivery",
        gatewayReference: "sale-cod",
        amount: "100.00",
        currency: "COP",
        status: "pending",
      },
    });
    const route = `/api/v1/admin/payments/${payment.id}/reconcile-cod`;
    assert.equal(
      (await http.post(route).send({ reference: "ref", note: "received" }))
        .status,
      401,
    );
    assert.equal(
      (
        await http
          .post(route)
          .set("Authorization", `Bearer ${viewer}`)
          .send({ reference: "ref", note: "received" })
      ).status,
      403,
    );
    assert.equal(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .status,
      "pending",
    );
    const response = await http
      .post(route)
      .set("Authorization", `Bearer ${token}`)
      .send({ reference: "ref", note: "received" });
    assert.equal(response.status, 201);
    assert.equal(response.body.status, "approved");
    assert.equal(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }))
        .gatewayReference,
      "ref",
    );
    assert.equal(
      await prisma.auditLog.count({
        where: { entityId: payment.id, action: "payment.cod_reconciled" },
      }),
      1,
    );
    const repeat = await http
      .post(route)
      .set("Authorization", `Bearer ${token}`)
      .send({ reference: "other", note: "retry" });
    assert.equal(repeat.status, 201);
    assert.equal(repeat.body.alreadyReconciled, true);
    assert.equal(
      await prisma.auditLog.count({
        where: { entityId: payment.id, action: "payment.cod_reconciled" },
      }),
      1,
    );
    const pse = await prisma.payment.create({
      data: {
        id: randomUUID(),
        orderId: order.id,
        gateway: "pse",
        gatewayReference: "pse-synthetic",
        amount: "100.00",
        currency: "COP",
        status: "pending",
      },
    });
    assert.equal(
      (
        await http
          .post(`/api/v1/admin/payments/${pse.id}/reconcile-cod`)
          .set("Authorization", `Bearer ${token}`)
          .send({ reference: "bad" })
      ).status,
      400,
    );
    assert.equal(
      (await prisma.payment.findUniqueOrThrow({ where: { id: pse.id } }))
        .status,
      "pending",
    );
  });
});
