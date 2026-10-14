import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fork, ChildProcess, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { loginAsAdmin } from 'tests/helpers/test-app';
import { disconnectDatabase, permissionCatalog, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';

const actions = ['users.admin.updated', 'users.admin.deactivated', 'roles.updated', 'roles.assigned_to_user', 'permissions.assigned_to_role', 'iam.mutation.denied'];
const iamSlugs = permissionCatalog.filter(([, module]) => ['users', 'roles', 'permissions'].includes(module)).map(([slug]) => slug);
const globalLockKey = 'iam:last-active-super-admin';

describe('EX08 approved last effective superadmin guard', () => {
  before(() => {
    execFileSync(process.execPath, [resolve('node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'], { cwd: process.cwd(), env: process.env, stdio: 'pipe' });
  });
  let app: { close(): Promise<void> };
  let http: ReturnType<typeof request>;
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let token: string;
  let roleId: string;
  let child: ChildProcess;
  let fault: { action: string; mode: 'before' | 'after' } | null = null;
  let commandSequence = 0;
  let entered = 0;
  const pending = new Map<number, () => void>();
  async function command(type: string, value?: unknown) {
    const id = ++commandSequence;
    const reply = new Promise<void>((resolveReply) => pending.set(id, resolveReply));
    child.send?.({ id, type, value });
    await reply;
  }
  async function bootCompiled() {
    // A pure Node process preserves emitted Nest/DTO metadata. tsx's path resolver
    // can otherwise load the TypeScript sources from a compiled module.
    const script = `
      require('reflect-metadata');
      const { NestFactory } = require('@nestjs/core');
      const { ValidationPipe } = require('@nestjs/common');
      const { AppModule } = require('./dist/src/app/app.module');
      const { GlobalExceptionFilter } = require('./dist/src/common/filters/global-exception.filter');
      const { MetricsInterceptor } = require('./dist/src/infra/telemetry/metrics/metrics.interceptor');
      const { ModulesContainer } = require('@nestjs/core');
      const { AUDIT_REPOSITORY } = require('./dist/src/modules/auth/domain/repositories/audit.repository');
      (async () => {
        const app = await NestFactory.create(AppModule, { rawBody: true, logger: false });
        app.setGlobalPrefix('api/v1');
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
        app.useGlobalFilters(new GlobalExceptionFilter());
        app.useGlobalInterceptors(app.get(MetricsInterceptor));
        const audit = app.get(AUDIT_REPOSITORY);
        const write = audit.write.bind(audit);
        let fault = null;
        audit.write = async (entry, tx) => {
          if (fault?.action === entry.action && fault.mode === 'before') throw Error('OWN_FAULT_BEFORE_AUDIT');
          await write(entry, tx);
          if (fault?.action === entry.action && fault.mode === 'after') throw Error('OWN_FAULT_AFTER_REAL_AUDIT_INSERT');
        };
        for (const m of app.get(ModulesContainer).values()) {
          for (const provider of m.providers.values()) {
            const instance = provider.instance;
            if (instance?.constructor?.name === 'IamPrismaUnitOfWork') {
              const run = instance.run.bind(instance);
              instance.run = (...args) => { process.send({ entered: true }); return run(...args); };
            }
          }
        }
        await app.listen(34613, '127.0.0.1');
        process.on('message', async (message) => {
          if (message.type === 'fault') fault = message.value;
          if (message.type === 'close') {
            await app.close();
            process.send({ id: message.id });
            process.exit(0);
          }
          process.send({ id: message.id });
        });
        process.send({ ready: true });
      })().catch(error => { process.stderr.write(error.stack); process.exit(1); });
    `;
    child = fork('-e', [script], {
      cwd: process.cwd(), execArgv: [],
      env: { ...process.env, NODE_PATH: resolve('dist') + ':' + resolve('node_modules') },
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    });
    await new Promise<void>((ready, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => { if (code !== 0) reject(new Error(`Own compiled backend exited ${code}`)); });
      child.on('message', (message: { ready?: boolean; id?: number; entered?: boolean }) => {
        if (message.ready) ready();
        if (message.entered) entered += 1;
        if (message.id !== undefined) {
          pending.get(message.id)?.();
          pending.delete(message.id);
        }
      });
    });
    app = { close: async () => {
      const exit = new Promise<void>((done) => child.once('exit', () => done()));
      await command('close');
      await exit;
    } };
    http = request('http://127.0.0.1:34613');
  }
  beforeEach(async () => {
    if (app) await app.close();
    await bootCompiled();
    await command('fault', null);
    await resetDatabase();
    seeded = await seedBaseData();
    assert.equal(iamSlugs.length, 14);
    const iam = await prisma.permission.findMany({ where: { slug: { in: iamSlugs } } });
    await prisma.rolePermission.createMany({ data: iam.map((p) => ({ id: uuidv7(), roleId: seeded.roles.limitedRoleId, permissionId: p.id })), skipDuplicates: true });
    const remaining = 30000 - Date.now() % 30000;
    if (remaining < 3000) await new Promise((r) => setTimeout(r, remaining + 30));
    const login = await loginAsAdmin(http, seeded.users.viewerEmail, seeded.users.viewerPassword, seeded.users.twoFactorSecret);
    token = login.accessToken;
    assert.ok(token, 'Real current IAM actor login must succeed');
  });
  after(async () => { if (app) await app.close(); await disconnectDatabase(); });
  const auth = () => ({ Authorization: `Bearer ${token}` });
  async function snapshot() {
    return JSON.stringify(await Promise.all([
      prisma.user.findMany({ orderBy: { id: 'asc' } }),
      prisma.role.findMany({ orderBy: { id: 'asc' } }),
      prisma.rolePermission.findMany({ orderBy: { id: 'asc' } }),
      prisma.auditLog.findMany({ where: { action: { in: actions } }, orderBy: { id: 'asc' } }),
    ]));
  }
  async function accessCount() {
    const role = await prisma.role.findUnique({ where: { slug: 'super-admin' }, include: { users: true, rolePermissions: { include: { permission: true } } } });
    if (!role || !iamSlugs.every((slug) => role.rolePermissions.some((r) => r.permission.slug === slug))) return 0;
    return role.users.filter((u) => u.isActive).length;
  }
  async function addCanonical(isActive = true) {
    const original = await prisma.user.findUniqueOrThrow({ where: { id: seeded.users.adminUserId } });
    return prisma.user.create({ data: { id: uuidv7(), email: `${uuidv7()}@example.test`, fullName: 'Own synthetic second admin', passwordHash: original.passwordHash, roleId: original.roleId, twoFactorSecret: original.twoFactorSecret, isActive } });
  }
  async function denial(call: () => PromiseLike<request.Response>, target: string, operation: string) {
    const beforeData = JSON.parse(await snapshot());
    const response = await call();
    assert.equal(response.status, 409, JSON.stringify(response.body));
    const afterData = JSON.parse(await snapshot());
    assert.deepEqual(afterData.slice(0, 3), beforeData.slice(0, 3), 'Denied IAM data unchanged');
    const logs = await prisma.auditLog.findMany({ where: { action: 'iam.mutation.denied' } });
    assert.equal(logs.length, 1, 'Denial audit committed even though HTTP409');
    assert.equal(logs[0].actorUserId, seeded.users.viewerUserId);
    assert.equal(logs[0].entityId, target);
    assert.equal((logs[0].afterData as Record<string, unknown>).operation, operation);
    assert.equal((logs[0].afterData as Record<string, unknown>).reason, 'LAST_ACTIVE_SUPER_ADMIN');
    assert.equal(await accessCount(), 1);
  }
  it('denies last active status loss and persists one denial audit', async () => {
    await denial(() => http.patch(`/api/v1/admin/users/${seeded.users.adminUserId}/deactivate`).set(auth()).send({}), seeded.users.adminUserId, 'users.admin.deactivated');
  });
  it('denies last role loss through user update', async () => {
    await denial(() => http.patch(`/api/v1/admin/users/${seeded.users.adminUserId}`).set(auth()).send({ roleId: seeded.roles.limitedRoleId }), seeded.users.adminUserId, 'users.admin.updated');
  });
  it('denies last role loss through role assignment', async () => {
    await denial(() => http.post(`/api/v1/admin/roles/${seeded.roles.limitedRoleId}/assign-user`).set(auth()).send({ userId: seeded.users.adminUserId }), seeded.users.adminUserId, 'roles.assigned_to_user');
  });
  it('denies canonical slug loss even with two active users sharing that role', async () => {
    await addCanonical();
    const response = await http.patch(`/api/v1/admin/roles/${seeded.roles.superAdminRoleId}`).set(auth()).send({ slug: 'renamed-root' });
    assert.equal(response.status, 409);
    assert.equal(await accessCount(), 2);
    assert.equal(await prisma.auditLog.count({ where: { action: 'iam.mutation.denied' } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { action: 'roles.updated' } }), 0);
  });
  for (const removed of iamSlugs) {
    it(`rejects removing canonical IAM grant ${removed} while retaining commercials`, async () => {
      await denial(() => http.put(`/api/v1/admin/roles/${seeded.roles.superAdminRoleId}/permissions`).set(auth()).send({ permissionSlugs: permissionCatalog.map(([slug]) => slug).filter((slug) => slug !== removed) }), seeded.roles.superAdminRoleId, 'permissions.assigned_to_role');
    });
  }
  it('allows removing all commercial grants with all14 IAM preserved', async () => {
    assert.equal((await http.put(`/api/v1/admin/roles/${seeded.roles.superAdminRoleId}/permissions`).set(auth()).send({ permissionSlugs: iamSlugs })).status, 200);
    assert.equal(await accessCount(), 1);
    assert.equal(await prisma.auditLog.count({ where: { action: 'permissions.assigned_to_role' } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { action: 'iam.mutation.denied' } }), 0);
  });
  it('allows deactivating one of two canonical active users', async () => {
    await addCanonical();
    assert.equal((await http.patch(`/api/v1/admin/users/${seeded.users.adminUserId}/deactivate`).set(auth()).send({})).status, 200);
    assert.equal(await accessCount(), 1);
    assert.equal(await prisma.auditLog.count({ where: { action: 'users.admin.deactivated' } }), 1);
  });
  it('allows role reassignment when a second effective active user remains', async () => {
    await addCanonical();
    assert.equal((await http.post(`/api/v1/admin/roles/${seeded.roles.limitedRoleId}/assign-user`).set(auth()).send({ userId: seeded.users.adminUserId })).status, 201);
    assert.equal(await accessCount(), 1);
  });
  it('an inactive canonical user does not permit removing last active user', async () => {
    await addCanonical(false);
    await denial(() => http.patch(`/api/v1/admin/users/${seeded.users.adminUserId}/deactivate`).set(auth()).send({}), seeded.users.adminUserId, 'users.admin.deactivated');
  });
  it('two concurrent deactivations of distinct users leave one active and one denial', async () => {
    const other = await addCanonical();
    const responses = await Promise.all([seeded.users.adminUserId, other.id].map((id) => http.patch(`/api/v1/admin/users/${id}/deactivate`).set(auth()).send({})));
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await accessCount(), 1);
    assert.equal(await prisma.auditLog.count({ where: { action: 'users.admin.deactivated' } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { action: 'iam.mutation.denied' } }), 1);
  });
  it('concurrent cross-route role/status loss leaves one effective access', async () => {
    const other = await addCanonical();
    const responses = await Promise.all([
      http.patch(`/api/v1/admin/users/${seeded.users.adminUserId}/deactivate`).set(auth()).send({}),
      http.patch(`/api/v1/admin/users/${other.id}`).set(auth()).send({ roleId: seeded.roles.limitedRoleId }),
    ]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await accessCount(), 1);
  });
  it('neutral profile, same role and role presentation updates preserve access', async () => {
    assert.equal((await http.patch(`/api/v1/admin/users/${seeded.users.adminUserId}`).set(auth()).send({ fullName: 'Actual neutral', roleId: seeded.roles.superAdminRoleId })).status, 200);
    assert.equal((await http.patch(`/api/v1/admin/roles/${seeded.roles.superAdminRoleId}`).set(auth()).send({ name: 'Actual displayed name', description: 'Neutral' })).status, 200);
    assert.equal(await accessCount(), 1);
    assert.equal(await prisma.auditLog.count({ where: { action: 'iam.mutation.denied' } }), 0);
  });
  it('baseline0 permits permission repair and neutral updates instead of fabricating access', async () => {
    const permission = await prisma.permission.findUniqueOrThrow({ where: { slug: 'roles.read' } });
    await prisma.rolePermission.deleteMany({ where: { roleId: seeded.roles.superAdminRoleId, permissionId: permission.id } });
    assert.equal(await accessCount(), 0);
    assert.equal((await http.patch(`/api/v1/admin/users/${seeded.users.adminUserId}`).set(auth()).send({ fullName: 'Repair pending' })).status, 200);
    assert.equal((await http.put(`/api/v1/admin/roles/${seeded.roles.superAdminRoleId}/permissions`).set(auth()).send({ permissionSlugs: iamSlugs })).status, 200);
    assert.equal(await accessCount(), 1);
  });
  it('baseline0 permits repair of missing canonical slug', async () => {
    await prisma.role.update({ where: { id: seeded.roles.superAdminRoleId }, data: { slug: 'needs-repair' } });
    assert.equal(await accessCount(), 0);
    assert.equal((await http.patch(`/api/v1/admin/roles/${seeded.roles.superAdminRoleId}`).set(auth()).send({ slug: 'super-admin' })).status, 200);
    assert.equal(await accessCount(), 1);
  });
  for (const mode of ['before', 'after'] as const) {
    it(`denial audit ${mode} INSERT failure rolls back and stays failclosed500`, async () => {
      const pre = await snapshot();
      await command('fault', { action: 'iam.mutation.denied', mode });
      const response = await http.patch(`/api/v1/admin/users/${seeded.users.adminUserId}/deactivate`).set(auth()).send({});
      await command('fault', null);
      assert.equal(response.status, 500);
      assert.equal(await snapshot(), pre);
      assert.equal(await accessCount(), 1);
    });
    it(`role update ${mode} real success-audit INSERT failure rolls back role and audit`, async () => {
      const pre = await snapshot();
      await command('fault', { action: 'roles.updated', mode });
      assert.equal((await http.patch(`/api/v1/admin/roles/${seeded.roles.limitedRoleId}`).set(auth()).send({ name: 'Must rollback' })).status, 500);
      await command('fault', null);
      assert.equal(await snapshot(), pre);
      assert.equal((await http.patch(`/api/v1/admin/roles/${seeded.roles.limitedRoleId}`).set(auth()).send({ name: 'Committed' })).status, 200);
      assert.equal(await prisma.auditLog.count({ where: { action: 'roles.updated' } }), 1);
    });
  }
  for (const other of [false, true]) {
    it(`preserves selfdeactivate409 and committed audit with another active=${other}`, async () => {
      if (other) await addCanonical();
      const login = await loginAsAdmin(http, seeded.users.adminEmail, seeded.users.adminPassword, seeded.users.twoFactorSecret);
      assert.ok(login.accessToken);
      const response = await http.patch(`/api/v1/admin/users/${seeded.users.adminUserId}/deactivate`).set('Authorization', `Bearer ${login.accessToken}`).send({});
      assert.equal(response.status, 409);
      assert.equal(await accessCount(), other ? 2 : 1);
      const logs = await prisma.auditLog.findMany({ where: { action: 'iam.mutation.denied' } });
      assert.equal(logs.length, 1);
      assert.equal((logs[0].afterData as Record<string, unknown>).reason, other ? 'SELF_DEACTIVATION' : 'LAST_ACTIVE_SUPER_ADMIN');
    });
  }
  it('401/403 invalid DTO404 and currentJWT revoke preserve mutation boundary', async () => {
    assert.equal((await http.patch(`/api/v1/admin/users/${seeded.users.adminUserId}/deactivate`).send({})).status, 401);
    assert.equal((await http.patch(`/api/v1/admin/users/${seeded.users.adminUserId}`).set(auth()).send({ email: 'invalid' })).status, 400);
    assert.equal((await http.patch(`/api/v1/admin/users/${uuidv7()}`).set(auth()).send({ fullName: 'Missing' })).status, 404);
    const permission = await prisma.permission.findUniqueOrThrow({ where: { slug: 'users.update' } });
    await prisma.rolePermission.deleteMany({ where: { roleId: seeded.roles.limitedRoleId, permissionId: permission.id } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: seeded.users.adminUserId } });
    assert.equal((await http.patch(`/api/v1/admin/users/${user.id}`).set(auth()).send({ fullName: 'Forbidden' })).status, 403);
    assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: user.id } }), user);
  });
  it('actor waiting global lock is revalidated after real current permission revocation', async () => {
    let requestPromise: Promise<request.Response> | undefined;
    const beforeUser = await prisma.user.findUniqueOrThrow({ where: { id: seeded.users.adminUserId } });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${globalLockKey}, 0))`;
      const prior = entered;
      requestPromise = http.patch(`/api/v1/admin/users/${seeded.users.adminUserId}`).set(auth()).send({ fullName: 'Stale forbidden' }).then((r) => r);
      for (let i = 0; i < 100 && entered === prior; i++) await new Promise((r) => setTimeout(r, 10));
      assert.ok(entered > prior, 'Actual JWT-authorized usecase entered');
      const permission = await tx.permission.findUniqueOrThrow({ where: { slug: 'users.update' } });
      await tx.rolePermission.deleteMany({ where: { roleId: seeded.roles.limitedRoleId, permissionId: permission.id } });
    });
    assert.ok(requestPromise);
    assert.equal((await requestPromise).status, 403);
    assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { id: beforeUser.id } }), beforeUser);
  });
  for (const kind of ['users', 'roles'] as const) {
    it(`creation actor ${kind} revoked while waiting must not create with stale grant`, async () => {
      let responsePromise: Promise<request.Response> | undefined;
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${globalLockKey}, 0))`;
        const prior = entered;
        const call = kind === 'users'
          ? http.post('/api/v1/admin/users').set(auth()).send({ fullName: 'Revoked creation', email: 'stale-create@example.test', password: seeded.users.viewerPassword, roleId: seeded.roles.limitedRoleId })
          : http.post('/api/v1/admin/roles').set(auth()).send({ name: 'Revoked creation', slug: 'stale-created' });
        responsePromise = call.then((r) => r);
        for (let i = 0; i < 100 && entered === prior; i++) await new Promise((r) => setTimeout(r, 10));
        assert.ok(entered > prior, 'Real authorized creation entered UOW');
        const permission = await tx.permission.findUniqueOrThrow({ where: { slug: `${kind}.create` } });
        await tx.rolePermission.deleteMany({ where: { roleId: seeded.roles.limitedRoleId, permissionId: permission.id } });
      });
      assert.ok(responsePromise);
      assert.equal((await responsePromise).status, 403);
      assert.equal(await prisma.user.count({ where: { email: 'stale-create@example.test' } }), 0);
      assert.equal(await prisma.role.count({ where: { slug: 'stale-created' } }), 0);
    });
  }
  for (const slug of ['', '   ']) {
    it(`blank canonical slug ${JSON.stringify(slug)} is audited409 without losing actual access`, async () => {
      await denial(() => http.patch(`/api/v1/admin/roles/${seeded.roles.superAdminRoleId}`).set(auth()).send({ slug }), seeded.roles.superAdminRoleId, 'roles.updated');
    });
  }
});
