import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import request from "supertest";
import { generate } from "otplib";
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
  seedBaseData,
} from "tests/helpers/test-db";
import "tests/helpers/test-env";
describe("EX08 IAM genuine contracts, authorization and durable audit", () => {
  let child: ChildProcess;
  let http: ReturnType<typeof request>;
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let token: string;
  let viewer: string;
  let createdUser: string;
  let createdRole: string;
  const backend = String.raw`
require('reflect-metadata');const {NestFactory}=require('@nestjs/core');const {ValidationPipe}=require('@nestjs/common');const {AppModule}=require('./dist/src/app/app.module');const {GlobalExceptionFilter}=require('./dist/src/common/filters/global-exception.filter');const {MetricsInterceptor}=require('./dist/src/infra/telemetry/metrics/metrics.interceptor');
(async()=>{const app=await NestFactory.create(AppModule,{rawBody:true,logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalFilters(new GlobalExceptionFilter());app.useGlobalInterceptors(app.get(MetricsInterceptor));await app.listen(0,'127.0.0.1');process.send({ready:app.getHttpServer().address().port});process.on('message',async m=>{if(m.close){await app.close();process.exit(0);}});})().catch(()=>process.exit(1));`;
  async function login(email: string, password: string) {
    const remaining = 30000 - (Date.now() % 30000);
    if (remaining < 5000)
      await new Promise((r) => setTimeout(r, remaining + 50));
    const first = await http
      .post("/api/v1/auth/login")
      .send({ email, password });
    assert.equal(first.status, 201);
    assert.ok(first.body.challengeToken);
    const second = await http.post("/api/v1/auth/verify-2fa").send({
      challengeToken: first.body.challengeToken,
      code: await generate({ secret: seeded.users.twoFactorSecret }),
    });
    assert.equal(second.status, 201);
    assert.ok(second.body.accessToken);
    return second.body.accessToken as string;
  }
  before(async () => {
    execFileSync(process.execPath, ["scripts/ci/assert-test-environment.js"], {
      stdio: "pipe",
    });
    execFileSync("npm", ["run", "build"], { stdio: "pipe" });
    await resetDatabase();
    seeded = await seedBaseData();
    child = spawn(process.execPath, ["-e", backend], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_PATH: path.resolve("dist") },
      stdio: ["ignore", "ignore", "inherit", "ipc"],
    });
    const port = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Compiled IAM startup timeout")),
        30000,
      );
      child.once("message", (m: { ready: number }) => {
        clearTimeout(timer);
        resolve(m.ready);
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(new Error("Compiled IAM exited before ready"));
      });
    });
    http = request(`http://127.0.0.1:${port}`);
    token = await login(seeded.users.adminEmail, seeded.users.adminPassword);
    viewer = await login(seeded.users.viewerEmail, seeded.users.viewerPassword);
  });
  after(async () => {
    if (child?.connected && child.exitCode === null) {
      child.send({ close: true });
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
    }
    await disconnectDatabase();
  });
  it("requires valid MFA session and denies every IAM read/mutation to an unrelated viewer", async () => {
    for (const path of [
      "/users",
      "/roles",
      "/permissions/matrix",
      "/settings",
      "/settings/providers",
      "/audit",
    ]) {
      assert.equal((await http.get("/api/v1/admin" + path)).status, 401);
      assert.equal(
        (
          await http
            .get("/api/v1/admin" + path)
            .set("Authorization", "Bearer " + viewer)
        ).status,
        403,
      );
    }
    const beforeUsers = await prisma.user.count();
    const writes: [string, string, object][] = [
      ["post", "/users", {}],
      ["patch", "/users/" + seeded.users.adminUserId, {}],
      ["patch", "/users/" + seeded.users.adminUserId + "/deactivate", {}],
      ["post", "/roles", {}],
      [
        "post",
        "/roles/" + seeded.roles.limitedRoleId + "/assign-user",
        { userId: seeded.users.adminUserId },
      ],
      [
        "put",
        "/roles/" + seeded.roles.limitedRoleId + "/permissions",
        { permissionSlugs: ["users.read"] },
      ],
      ["patch", "/settings", { general: { storeName: "denied" } }],
      ["post", "/settings/providers/validate", {}],
    ];
    for (const [method, path, body] of writes) {
      const builder =
        method === "post"
          ? http.post("/api/v1/admin" + path)
          : method === "put"
            ? http.put("/api/v1/admin" + path)
            : http.patch("/api/v1/admin" + path);
      assert.equal(
        (await builder.set("Authorization", "Bearer " + viewer).send(body))
          .status,
        403,
      );
    }
    assert.equal(await prisma.user.count(), beforeUsers);
    assert.equal(await prisma.adminSetting.count(), 0);
  });
  it("creates a user with hashed password and genuine pending 2FA, validates input and preserves duplicate409", async () => {
    const body = {
      fullName: "IAM Test Operator",
      email: "iam-operator@example.test",
      password: seeded.users.viewerPassword,
      roleId: seeded.roles.limitedRoleId,
    };
    const invalid = await http
      .post("/api/v1/admin/users")
      .set("Authorization", "Bearer " + token)
      .send({ ...body, email: "not-an-email" });
    assert.equal(invalid.status, 400);
    const response = await http
      .post("/api/v1/admin/users")
      .set("Authorization", "Bearer " + token)
      .send(body);
    assert.equal(response.status, 201);
    createdUser = response.body.id;
    assert.ok(createdUser);
    assert.equal(response.body.passwordHash, undefined);
    const stored = await prisma.user.findUniqueOrThrow({
      where: { id: createdUser },
    });
    assert.notEqual(stored.passwordHash, body.password);
    assert.equal(stored.twoFactorSecret, null);
    const withoutMfa = await http
      .post("/api/v1/auth/login")
      .send({ email: body.email, password: body.password });
    assert.equal(withoutMfa.status, 401);
    assert.equal(withoutMfa.body.accessToken, undefined);
    const audit = await prisma.auditLog.findFirstOrThrow({
      where: { entityId: createdUser, action: "users.admin.created" },
    });
    assert.equal(audit.actorUserId, seeded.users.adminUserId);
    assert.equal(
      (audit.afterData as Record<string, unknown>).email,
      "[REDACTED]",
    );
    assert.equal(
      (
        await http
          .post("/api/v1/admin/users")
          .set("Authorization", "Bearer " + token)
          .send(body)
      ).status,
      409,
    );
    assert.equal(await prisma.user.count({ where: { email: body.email } }), 1);
  });
  it("edits only supplied user fields and deactivates with self/already-inactive409 plus audit", async () => {
    const email = (
      await prisma.user.findUniqueOrThrow({ where: { id: createdUser } })
    ).email;
    assert.equal(
      (
        await http
          .patch("/api/v1/admin/users/" + createdUser)
          .set("Authorization", "Bearer " + token)
          .send({ fullName: "IAM Updated Operator" })
      ).status,
      200,
    );
    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: createdUser },
    });
    assert.equal(updated.fullName, "IAM Updated Operator");
    assert.equal(updated.email, email);
    assert.equal(
      (
        await http
          .patch(
            "/api/v1/admin/users/" + seeded.users.adminUserId + "/deactivate",
          )
          .set("Authorization", "Bearer " + token)
          .send({})
      ).status,
      409,
    );
    assert.equal(
      (
        await http
          .patch("/api/v1/admin/users/" + createdUser + "/deactivate")
          .set("Authorization", "Bearer " + token)
          .send({})
      ).status,
      200,
    );
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: createdUser } }))
        .isActive,
      false,
    );
    assert.equal(
      (
        await http
          .patch("/api/v1/admin/users/" + createdUser + "/deactivate")
          .set("Authorization", "Bearer " + token)
          .send({})
      ).status,
      409,
    );
    assert.equal(
      await prisma.auditLog.count({
        where: { entityId: createdUser, action: "users.admin.deactivated" },
      }),
      1,
    );
  });
  it("creates a role and assigns catalogue permissions and a real user durably", async () => {
    const create = await http
      .post("/api/v1/admin/roles")
      .set("Authorization", "Bearer " + token)
      .send({ name: "IAM Operational Read", slug: "iam-operational-read" });
    assert.equal(create.status, 201);
    createdRole = create.body.id;
    assert.equal(
      (
        await http
          .post("/api/v1/admin/roles")
          .set("Authorization", "Bearer " + token)
          .send({ name: "Duplicate", slug: "iam-operational-read" })
      ).status,
      409,
    );
    assert.equal(
      (
        await http
          .put("/api/v1/admin/roles/" + createdRole + "/permissions")
          .set("Authorization", "Bearer " + token)
          .send({ permissionSlugs: ["unknown.permission"] })
      ).status,
      400,
    );
    assert.equal(
      (
        await http
          .put("/api/v1/admin/roles/" + createdRole + "/permissions")
          .set("Authorization", "Bearer " + token)
          .send({ permissionSlugs: [] })
      ).status,
      400,
    );
    const assigned = await http
      .put("/api/v1/admin/roles/" + createdRole + "/permissions")
      .set("Authorization", "Bearer " + token)
      .send({ permissionSlugs: ["users.read", "audit.read"] });
    assert.equal(assigned.status, 200);
    assert.deepEqual(assigned.body.permissions, ["audit.read", "users.read"]);
    const missing = "019a1000-0000-7000-8000-000000000001";
    assert.equal(
      (
        await http
          .post("/api/v1/admin/roles/" + createdRole + "/assign-user")
          .set("Authorization", "Bearer " + token)
          .send({ userId: missing })
      ).status,
      404,
    );
    assert.equal(
      (
        await http
          .post("/api/v1/admin/roles/" + createdRole + "/assign-user")
          .set("Authorization", "Bearer " + token)
          .send({ userId: createdUser })
      ).status,
      201,
    );
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: createdUser } }))
        .roleId,
      createdRole,
    );
    assert.equal(
      await prisma.auditLog.count({
        where: {
          entityId: createdRole,
          action: "permissions.assigned_to_role",
        },
      }),
      1,
    );
    assert.equal(
      await prisma.auditLog.count({
        where: { entityId: createdUser, action: "roles.assigned_to_user" },
      }),
      1,
    );
  });
  it("persists public settings with actor and distinguishes local validation from provider availability", async () => {
    const response = await http
      .patch("/api/v1/admin/settings")
      .set("Authorization", "Bearer " + token)
      .send({ general: { storeName: "IAM Registered Name" } });
    assert.equal(response.status, 200);
    assert.equal(response.body.acceptedForReview, true);
    const stored = await prisma.adminSetting.findUniqueOrThrow({
      where: { key: "general.storeName" },
    });
    assert.equal(stored.valueJson, "IAM Registered Name");
    assert.equal(stored.updatedById, seeded.users.adminUserId);
    assert.equal(
      await prisma.auditLog.count({ where: { action: "settings.updated" } }),
      1,
    );
    const validation = await http
      .post("/api/v1/admin/settings/providers/validate")
      .set("Authorization", "Bearer " + token)
      .send({});
    assert.equal(validation.status, 201);
    assert.equal(typeof validation.body.valid, "boolean");
    assert.equal(
      typeof validation.body.providers.payments.configured.wompi,
      "boolean",
    );
    assert.equal(
      JSON.stringify(validation.body).includes(seeded.users.viewerPassword),
      false,
    );
  });
  it("reads actual audit action/entity filters, bounded limit and sanitized changes with actor", async () => {
    const list = await http
      .get("/api/v1/admin/audit")
      .query({
        action: "users.admin.updated",
        entityType: "user",
        entityId: createdUser,
        limit: "20",
      })
      .set("Authorization", "Bearer " + token);
    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);
    const detail = await http
      .get("/api/v1/admin/audit/" + list.body.data[0].id)
      .set("Authorization", "Bearer " + token);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.actorUserId, seeded.users.adminUserId);
    assert.equal(detail.body.afterData.email, "[REDACTED]");
    assert.equal(detail.body.afterData.fullName, "[REDACTED]");
    assert.equal(detail.body.entityId, createdUser);
    assert.equal(
      (
        await http
          .get("/api/v1/admin/audit/019a1000-0000-7000-8000-000000000001")
          .set("Authorization", "Bearer " + token)
      ).status,
      404,
    );
  });
});
