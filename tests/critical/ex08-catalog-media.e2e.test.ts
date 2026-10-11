import "tests/helpers/test-env";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ValidationPipe } from "@nestjs/common";
import { createTestApp, loginAsAdmin } from "tests/helpers/test-app";
import {
  prisma,
  resetDatabase,
  seedBaseData,
  disconnectDatabase,
} from "tests/helpers/test-db";
import { GlobalExceptionFilter } from "src/common/filters/global-exception.filter";
import type { DomainEventOutboxRepository } from "src/common/events/domain-event-outbox.port";
import type { AuditRepository } from "src/modules/auth/domain/repositories/audit.repository";
import { Test } from "@nestjs/testing";
import request from "supertest";

if (process.env.EX08_MEDIA_COMPILED_CHILD === "1")
  describe("EX08 registered media and atomic approval", () => {
    const {
      DOMAIN_EVENT_OUTBOX_REPOSITORY,
    } = require("../../dist/src/common/events/domain-event-outbox.port");
    const {
      AUDIT_REPOSITORY,
    } = require("../../dist/src/modules/auth/domain/repositories/audit.repository");
    // Use the production compilation so decorator injection metadata is preserved.
    const { AppModule } = require("../../dist/src/app/app.module");
    const {
      MetricsInterceptor: CompiledMetricsInterceptor,
    } = require("../../dist/src/infra/telemetry/metrics/metrics.interceptor");
    let app: Awaited<ReturnType<typeof createTestApp>>["app"];
    let http: ReturnType<typeof request>;
    let token: string;
    let viewer: string;
    let resources: Array<{ assetPath: string; sha256: string }>;
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
      app.useGlobalInterceptors(app.get(CompiledMetricsInterceptor));
      await app.init();
      http = request(app.getHttpServer());
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
    });
    after(async () => {
      await app.close();
      await disconnectDatabase();
    });
    const post = (path: string, body: object) =>
      http
        .post(`/api/v1${path}`)
        .set("Authorization", `Bearer ${token}`)
        .send(body);
    const patch = (id: string, body: object) =>
      http
        .patch(`/api/v1/admin/products/${id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(body);
    async function create(image?: object) {
      const response = await post("/admin/products", {
        name: "Media resource",
        slug: `media-${crypto.randomUUID()}`,
        isActive: false,
        metadata: {
          image: image ?? {
            assetPath: resources[0].assetPath,
            status: "pending",
          },
        },
      });
      assert.equal(response.status, 201);
      return response.body;
    }
    it("lists real resources and enforces authentication/permission on approval", async () => {
      assert.equal(
        (await http.get("/api/v1/admin/media-resources")).status,
        401,
      );
      const response = await http
        .get("/api/v1/admin/media-resources")
        .set("Authorization", `Bearer ${token}`);
      assert.equal(response.status, 200);
      assert.equal(
        (
          await http
            .get("/api/v1/admin/media-resources")
            .set("Authorization", `Bearer ${viewer}`)
        ).status,
        403,
      );
      resources = response.body.data;
      assert.ok(resources.length >= 2);
      assert.match(resources[0].sha256, /^[a-f0-9]{64}$/);
      const product = await create();
      const body = {
        ...resources[0],
        expectedUpdatedAt: product.updatedAt,
        reason: "Editor inspected registered resource",
      };
      assert.equal(
        (
          await http
            .post(`/api/v1/admin/products/${product.id}/image-approval`)
            .send(body)
        ).status,
        401,
      );
      assert.equal(
        (
          await http
            .post(`/api/v1/admin/products/${product.id}/image-approval`)
            .set("Authorization", `Bearer ${viewer}`)
            .send(body)
        ).status,
        403,
      );
    });
    it("rejects unknown paths/traversal/schemes and neutralizes forged approval provenance", async () => {
      for (const assetPath of [
        "/products/unknown.jpg",
        "/products/../secret.jpg",
        "https://example.com/a.jpg",
        "data:image/png,x",
        "//example.com/a.jpg",
      ]) {
        const count = await prisma.product.count();
        assert.equal(
          (
            await post("/admin/products", {
              name: "Unknown resource",
              slug: `bad-${crypto.randomUUID()}`,
              metadata: {
                image: { assetPath, status: "approved", approvedBy: "fake" },
              },
            })
          ).status,
          422,
        );
        assert.equal(await prisma.product.count(), count);
      }
      const product = await create({
        assetPath: resources[0].assetPath,
        status: "approved",
        approval: { approvedBy: "fake" },
        source: "fake",
      });
      assert.deepEqual(product.metadata.image, {
        assetPath: resources[0].assetPath,
        status: "pending",
      });
    });
    it("binds approval to path/hash/current version, preserves it only for same image and records held event+audit", async () => {
      const product = await create();
      const path = `/admin/products/${product.id}/image-approval`;
      assert.equal(
        (
          await post(path, {
            ...resources[0],
            sha256: "0".repeat(64),
            expectedUpdatedAt: product.updatedAt,
            reason: "Valid reason",
          })
        ).status,
        409,
      );
      const approved = await post(path, {
        ...resources[0],
        expectedUpdatedAt: product.updatedAt,
        reason: "Reviewed product image",
      });
      assert.equal(approved.status, 201);
      assert.equal(approved.body.metadata.image.status, "approved");
      const approval = approved.body.metadata.image.approval;
      assert.equal(approval.sha256, resources[0].sha256);
      assert.equal(approval.assetPath, resources[0].assetPath);
      assert.equal(typeof approval.approvedBy, "string");
      assert.ok(Date.parse(approval.approvedAt));
      assert.equal(approval.reason, "Reviewed product image");
      assert.equal(
        await prisma.auditLog.count({
          where: { action: "product.image_approved", entityId: product.id },
        }),
        1,
      );
      const events = await prisma.domainEventOutbox.findMany({
        where: { eventName: "product.updated" },
      });
      assert.ok(
        events.some((event) =>
          JSON.stringify(event.payload).includes(product.id),
        ),
      );
      assert.ok(events.every((event) => event.eligibility === "held"));
      assert.equal(
        (
          await post(path, {
            ...resources[0],
            expectedUpdatedAt: product.updatedAt,
            reason: "Stale approval",
          })
        ).status,
        409,
      );
      const unchanged = await patch(product.id, {
        name: "Renamed media",
        metadata: {
          image: {
            assetPath: resources[0].assetPath,
            status: "approved",
            approval: { approvedBy: "fake" },
          },
        },
      });
      assert.equal(unchanged.status, 200);
      assert.deepEqual(
        unchanged.body.metadata.image,
        approved.body.metadata.image,
      );
      const replacement = await patch(product.id, {
        metadata: {
          image: {
            assetPath: resources[1].assetPath,
            status: "approved",
            approval,
          },
        },
      });
      assert.equal(replacement.status, 200);
      assert.deepEqual(replacement.body.metadata.image, {
        assetPath: resources[1].assetPath,
        status: "pending",
      });
      assert.equal(
        (
          await post(path, {
            ...resources[0],
            expectedUpdatedAt: replacement.body.updatedAt,
            reason: "Wrong current path",
          })
        ).status,
        409,
      );
    });
    it("audit failures roll back product create/update/approval and held outbox together", async () => {
      const product = await create();
      const audit = app.get<AuditRepository>(AUDIT_REPOSITORY);
      const original = audit.write.bind(audit);
      let failing = "";
      audit.write = async (entry, tx) => {
        if (entry.action === failing)
          throw new Error("Controlled media audit failure");
        return original(entry, tx);
      };
      try {
        for (const action of [
          "product.created",
          "product.updated",
          "product.image_approved",
        ]) {
          failing = action;
          const before = await prisma.product.findUniqueOrThrow({
            where: { id: product.id },
          });
          const counts = [
            await prisma.product.count(),
            await prisma.auditLog.count(),
            await prisma.domainEventOutbox.count(),
          ];
          const response =
            action === "product.created"
              ? await post("/admin/products", {
                  name: "Fault product",
                  slug: `fault-${crypto.randomUUID()}`,
                })
              : action === "product.updated"
                ? await patch(product.id, { name: "Must roll back" })
                : await post(`/admin/products/${product.id}/image-approval`, {
                    ...resources[0],
                    expectedUpdatedAt: before.updatedAt.toISOString(),
                    reason: "Fault injection approval",
                  });
          assert.equal(response.status, 500);
          assert.deepEqual(
            [
              await prisma.product.count(),
              await prisma.auditLog.count(),
              await prisma.domainEventOutbox.count(),
            ],
            counts,
          );
          assert.deepEqual(
            await prisma.product.findUniqueOrThrow({
              where: { id: product.id },
            }),
            before,
          );
        }
      } finally {
        audit.write = original;
      }
      // The event capture happens after the audit write. Its failure must also
      // roll back the actual already-written audit and image metadata.
      const outbox = app.get<DomainEventOutboxRepository>(
        DOMAIN_EVENT_OUTBOX_REPOSITORY,
      );
      const capture = outbox.captureHeld.bind(outbox);
      const before = await prisma.product.findUniqueOrThrow({
        where: { id: product.id },
      });
      const counts = [
        await prisma.auditLog.count(),
        await prisma.domainEventOutbox.count(),
      ];
      outbox.captureHeld = async () => {
        throw new Error("Controlled media event capture failure");
      };
      try {
        const response = await post(
          `/admin/products/${product.id}/image-approval`,
          {
            ...resources[0],
            expectedUpdatedAt: before.updatedAt.toISOString(),
            reason: "Event failure rollback verification",
          },
        );
        assert.equal(response.status, 500);
        assert.deepEqual(
          await prisma.product.findUniqueOrThrow({ where: { id: product.id } }),
          before,
        );
        assert.deepEqual(
          [
            await prisma.auditLog.count(),
            await prisma.domainEventOutbox.count(),
          ],
          counts,
        );
      } finally {
        outbox.captureHeld = capture;
      }
    });
    it("concurrent approvals of the same product version permit one atomic winner", async () => {
      const product = await create();
      const counts = await prisma.auditLog.count({
        where: { action: "product.image_approved", entityId: product.id },
      });
      const body = {
        ...resources[0],
        expectedUpdatedAt: product.updatedAt,
        reason: "Concurrent editor approval",
      };
      const responses = await Promise.all([
        post(`/admin/products/${product.id}/image-approval`, body),
        post(`/admin/products/${product.id}/image-approval`, body),
      ]);
      assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
      assert.equal(
        await prisma.auditLog.count({
          where: { action: "product.image_approved", entityId: product.id },
        }),
        counts + 1,
      );
    });
  });
else
  it("runs media integration against production compilation with globals before init", () => {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const os = require("node:os") as typeof import("node:os");
    const { spawnSync } =
      require("node:child_process") as typeof import("node:child_process");
    const root = path.resolve(__dirname, "../..");
    // The critical CI job runs without a prior build. Compile the candidate
    // here so this test is self-contained and cannot accidentally use stale dist.
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
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ex08-media-compiled-"));
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
    // A config without source aliases keeps all production imports on dist.
    const childEnv = {
      ...process.env,
      EX08_MEDIA_COMPILED_CHILD: "1",
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
      {
        cwd: root,
        encoding: "utf8",
        timeout: 90000,
        env: childEnv,
      },
    );
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /# pass 5/);
    assert.match(run.stdout, /# fail 0/);
    assert.match(run.stdout, /# skipped 0/);
  });
