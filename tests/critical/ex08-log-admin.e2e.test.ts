import "tests/helpers/test-env";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { generate } from "otplib";
import {
  prisma,
  resetDatabase,
  seedBaseData,
  disconnectDatabase,
} from "tests/helpers/test-db";

if (process.env.EX08_LOG_COMPILED_CHILD === "1") {
  describe("EX08 logistics real read contracts and current permissions", () => {
    const { AppModule } = require("../../dist/src/app/app.module");
    const {
      GlobalExceptionFilter,
    } = require("../../dist/src/common/filters/global-exception.filter");
    const {
      MetricsInterceptor,
    } = require("../../dist/src/infra/telemetry/metrics/metrics.interceptor");
    let app: import("@nestjs/common").INestApplication;
    let http: ReturnType<typeof request>;
    let token: string;
    let viewer: string;
    let tracking: string;
    let roleId: string;
    let shipmentId: string;
    let orderNumber: string;
    let initial: string;
    async function snapshot() {
      return JSON.stringify({
        orders: await prisma.order.findMany({ orderBy: { id: "asc" } }),
        customers: await prisma.customer.findMany({ orderBy: { id: "asc" } }),
        shipments: await prisma.shipment.findMany({ orderBy: { id: "asc" } }),
        events: await prisma.shipmentEvent.findMany({ orderBy: { id: "asc" } }),
        notifications: await prisma.notification.findMany({
          orderBy: { id: "asc" },
        }),
      });
    }
    const get = (path: string, access = token) =>
      http.get(`/api/v1${path}`).set("Authorization", `Bearer ${access}`);
    before(async () => {
      await resetDatabase();
      const seeded = await seedBaseData();
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = module.createNestApplication({ rawBody: true });
      app.setGlobalPrefix("api/v1");
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      app.useGlobalFilters(new GlobalExceptionFilter());
      app.useGlobalInterceptors(app.get(MetricsInterceptor));
      await app.init();
      http = request(app.getHttpServer());
      async function login(email: string, password: string) {
        const start = await http
          .post("/api/v1/auth/login")
          .send({ email, password });
        assert.equal(start.status, 201);
        const remaining = 30000 - (Date.now() % 30000);
        if (remaining < 5000)
          await new Promise((resolve) => setTimeout(resolve, remaining + 30));
        const response = await http
          .post("/api/v1/auth/verify-2fa")
          .send({
            challengeToken: start.body.challengeToken,
            code: await generate({ secret: seeded.users.twoFactorSecret }),
          });
        assert.equal(response.status, 201);
        assert.equal(typeof response.body.accessToken, "string");
        return response.body.accessToken as string;
      }
      token = await login(seeded.users.adminEmail, seeded.users.adminPassword);
      viewer = await login(
        seeded.users.viewerEmail,
        seeded.users.viewerPassword,
      );
      roleId = crypto.randomUUID();
      await prisma.role.create({
        data: {
          id: roleId,
          name: "LOG critical tracking",
          slug: "log-critical-tracking",
        },
      });
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { slug: "tracking.read" },
      });
      await prisma.rolePermission.create({
        data: { id: crypto.randomUUID(), roleId, permissionId: permission.id },
      });
      const base = await prisma.user.findUniqueOrThrow({
        where: { id: seeded.users.viewerUserId },
      });
      await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          roleId,
          fullName: "Tracking reader",
          email: "log-critical-tracking@example.test",
          passwordHash: base.passwordHash,
          twoFactorSecret: seeded.users.twoFactorSecret,
          isActive: true,
        },
      });
      tracking = await login(
        "log-critical-tracking@example.test",
        seeded.users.viewerPassword,
      );
      const customer = await prisma.customer.create({
        data: {
          id: crypto.randomUUID(),
          fullName: "LOG Private Customer",
          email: "log-private@example.test",
          phone: "3005557799",
          defaultAddress: "LOG Private Address",
        },
      });
      for (let i = 0; i < 26; i++) {
        const order = await prisma.order.create({
          data: {
            id: crypto.randomUUID(),
            orderNumber: `DTJL-20261011-${String(i + 1).padStart(6, "0")}`,
            status: "pending_payment",
            customerName: customer.fullName,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            shippingAddress: "LOG Private Address",
            shippingCity: "Cali",
            subtotal: 1000,
            discountTotal: 0,
            taxTotal: 0,
            shippingTotal: 0,
            grandTotal: 1000,
            customerId: customer.id,
          },
        });
        const shipment = await prisma.shipment.create({
          data: {
            id: crypto.randomUUID(),
            orderId: order.id,
            customerId: customer.id,
            provider: "none",
            status: "pending_provider",
            addressSnapshot: { address: "LOG Private Address" },
            packageSnapshot: { internal: "private" },
            createdAt: new Date(Date.now() + i * 1000),
          },
        });
        if (i === 0) {
          shipmentId = shipment.id;
          orderNumber = order.orderNumber;
          await prisma.shipmentEvent.createMany({
            data: Array.from({ length: 105 }, (_, n) => ({
              id: crypto.randomUUID(),
              shipmentId,
              status: "pending_provider" as const,
              description: "log-private@example.test",
              location: "LOG Private Address",
              rawPayload: { recipient: "log-private@example.test" },
              occurredAt: new Date(Date.now() + n * 1000),
            })),
          });
        }
      }
      for (const status of [
        "queued",
        "sending",
        "sent",
        "failed",
        "uncertain",
      ] as const) {
        await prisma.notification.create({
          data: {
            id: crypto.randomUUID(),
            eventId: crypto.randomUUID(),
            eventName: "order.created",
            channel: "email",
            recipient: "log-private@example.test",
            subject: "LOG Private Subject",
            content: "LOG Private Content",
            provider: "none",
            status,
            attempts: status === "uncertain" ? 3 : 1,
            payload: { private: "log-private@example.test" },
            lastError:
              status === "failed"
                ? "log-private@example.test"
                : status === "uncertain"
                  ? "PROVIDER_OUTCOME_UNCERTAIN"
                  : null,
            dispatchEligible: false,
          },
        });
      }
      initial = await snapshot();
    });
    after(async () => {
      if (app) await app.close();
      await disconnectDatabase();
    });
    it("paginates persisted shipments and filters the actual order number", async () => {
      const first = await get("/admin/shipments?limit=20");
      const second = await get("/admin/shipments?limit=20&page=2");
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(first.body.meta.total, 26);
      assert.equal(first.body.data.length, 20);
      assert.equal(second.body.data.length, 6);
      const filtered = await get(
        `/admin/shipments?search=${orderNumber}&status=pending_provider`,
      );
      assert.equal(filtered.status, 200);
      assert.equal(filtered.body.meta.total, 1);
      assert.equal(filtered.body.data[0].id, shipmentId);
      assert.ok(!JSON.stringify(first.body).includes("LOG Private Address"));
      assert.ok(
        !JSON.stringify(first.body).includes("log-private@example.test"),
      );
    });
    it("returns only the 100 newest safe events with deterministic ordering", async () => {
      const response = await get(`/admin/shipments/${shipmentId}/events`);
      assert.equal(response.status, 200);
      assert.equal(response.body.data.length, 100);
      assert.equal(
        await prisma.shipmentEvent.count({ where: { shipmentId } }),
        105,
      );
      assert.deepEqual(Object.keys(response.body.data[0]).sort(), [
        "id",
        "occurredAt",
        "status",
      ]);
      assert.ok(
        !JSON.stringify(response.body).includes("log-private@example.test"),
      );
      const latest = await prisma.shipmentEvent.findFirstOrThrow({
        where: { shipmentId },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      });
      assert.equal(response.body.data[0].id, latest.id);
      assert.equal(
        response.body.data[0].occurredAt,
        latest.occurredAt.toISOString(),
      );
    });
    it("uses current tracking permission and audit for a same-JWT revocation", async () => {
      assert.equal(
        (await get(`/admin/shipments/${shipmentId}/events`, tracking)).status,
        200,
      );
      assert.equal((await get("/admin/shipments", tracking)).status, 403);
      const grant = await prisma.rolePermission.findFirstOrThrow({
        where: { roleId, permission: { slug: "tracking.read" } },
      });
      const deniedRoute = { action: "auth.permission_denied", entityId: `GET /api/v1/admin/shipments/${shipmentId}/events` };
      const auditCount = await prisma.auditLog.count({ where: deniedRoute });
      await prisma.rolePermission.delete({ where: { id: grant.id } });
      try {
        assert.equal(
          (await get(`/admin/shipments/${shipmentId}/events`, tracking)).status,
          403,
        );
        // The existing guard intentionally writes permission-denial audit asynchronously.
        // Wait for that exact route, then retain the positive persistence assertion.
        for (let n = 0; n < 40 && await prisma.auditLog.count({ where: deniedRoute }) <= auditCount; n++) await new Promise(resolve => setTimeout(resolve, 50));
        assert.ok((await prisma.auditLog.count({ where: deniedRoute })) > auditCount);
      } finally {
        await prisma.rolePermission.create({ data: grant });
      }
    });
    it("exposes actual notification states while masking content and error details", async () => {
      const response = await get("/admin/notifications?limit=100");
      assert.equal(response.status, 200);
      assert.equal(response.body.data.length, 5);
      assert.deepEqual(
        response.body.data.map((n: { status: string }) => n.status).sort(),
        ["failed", "queued", "sending", "sent", "uncertain"],
      );
      const serialized = JSON.stringify(response.body);
      for (const secret of [
        "log-private@example.test",
        "LOG Private Subject",
        "LOG Private Content",
      ])
        assert.ok(!serialized.includes(secret));
      const failed = response.body.data.find(
        (n: { status: string }) => n.status === "failed",
      );
      assert.equal(failed.lastError, "[DETAILS_REDACTED]");
      const uncertain = response.body.data.find(
        (n: { status: string }) => n.status === "uncertain",
      );
      assert.equal(uncertain.lastError, "PROVIDER_OUTCOME_UNCERTAIN");
    });
    it("keeps NONE login and external shipping blocked without fake success", async () => {
      const response = await get("/admin/shipping/login-test");
      assert.equal(response.status, 200);
      assert.equal(response.body.ok, false);
      assert.equal(response.body.status, "internal_tracking");
      assert.equal(response.body.tokenPresent, false);
      assert.equal(
        (await prisma.shipment.findUniqueOrThrow({ where: { id: shipmentId } }))
          .trackingNumber,
        null,
      );
    });
    it("fails closed for anonymous/viewer/unknown resource and preserves all business rows", async () => {
      assert.equal((await http.get("/api/v1/admin/notifications")).status, 401);
      assert.equal((await get("/admin/notifications", viewer)).status, 403);
      assert.equal(
        (await get("/admin/shipments/019a1000-0000-7000-8000-000000000999"))
          .status,
        404,
      );
      assert.equal(await snapshot(), initial);
    });
  });
} else {
  it("runs six logistics HTTP/DB cases against a fresh production compilation", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const os = require("node:os") as typeof import("node:os");
    const { spawnSync } =
      require("node:child_process") as typeof import("node:child_process");
    const root = path.resolve(__dirname, "../..");
    const build = spawnSync(
      process.execPath,
      [
        path.join(root, "node_modules/typescript/bin/tsc"),
        "-p",
        "tsconfig.build.json",
      ],
      { cwd: root, encoding: "utf8", timeout: 90000 },
    );
    assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ex08-log-compiled-"));
    const config = path.join(dir, "tsconfig.json");
    fs.writeFileSync(
      config,
      JSON.stringify({
        compilerOptions: {
          module: "commonjs",
          target: "ES2022",
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
        },
      }),
    );
    const childEnv = {
      ...process.env,
      EX08_LOG_COMPILED_CHILD: "1",
      NODE_PATH: `${path.join(root, "dist")}:${root}:${path.join(root, "node_modules")}`,
    };
    delete childEnv.NODE_TEST_CONTEXT;
    const run = spawnSync(
      process.execPath,
      [
        path.join(root, "node_modules/tsx/dist/cli.mjs"),
        "--tsconfig",
        config,
        "--test",
        "--test-concurrency=1",
        __filename,
      ],
      { cwd: root, encoding: "utf8", timeout: 90000, env: childEnv },
    );
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /# pass 6/);
    assert.match(run.stdout, /# fail 0/);
    assert.match(run.stdout, /# skipped 0/);
  });
}
