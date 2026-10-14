import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fork, ChildProcess, execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { loginAsAdmin } from 'tests/helpers/test-app';
import { disconnectDatabase, prisma, resetDatabase, seedBaseData } from 'tests/helpers/test-db';

const actions = ['users.admin.created', 'users.admin.updated', 'users.admin.deactivated', 'roles.created', 'roles.assigned_to_user', 'permissions.assigned_to_role', 'settings.updated'];

describe('EX08 IAM mutation and audit atomicity', () => {
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
        await app.listen(33893, '127.0.0.1');
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
      child.on('message', (message: { ready?: boolean; id?: number }) => {
        if (message.ready) ready();
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
    http = request('http://127.0.0.1:33893');
  }
  beforeEach(async () => {
    if (app) await app.close();
    await bootCompiled();
    fault = null;
    await resetDatabase();
    seeded = await seedBaseData();
    const remaining = 30000 - Date.now() % 30000;
    if (remaining < 3000) await new Promise((resolve) => setTimeout(resolve, remaining + 30));
    const login = await loginAsAdmin(http, seeded.users.adminEmail, seeded.users.adminPassword, seeded.users.twoFactorSecret);
    token = login.accessToken;
    assert.ok(token);
    roleId = uuidv7();
    await prisma.role.create({ data: { id: roleId, name: 'Atomicity target', slug: 'atomicity-target' } });
  });
  after(async () => {
    fault = null;
    await app.close();
    await disconnectDatabase();
  });

  async function snapshot() {
    return JSON.stringify(await Promise.all([
      prisma.user.findMany({ orderBy: { id: 'asc' } }),
      prisma.role.findMany({ orderBy: { id: 'asc' } }),
      prisma.rolePermission.findMany({ orderBy: { id: 'asc' } }),
      prisma.adminSetting.findMany({ orderBy: { id: 'asc' } }),
      prisma.auditLog.findMany({ where: { action: { in: actions } }, orderBy: { id: 'asc' } }),
    ]));
  }
  function mutation(index: number) {
    const auth = { Authorization: `Bearer ${token}` };
    switch (index) {
      case 0: return http.post('/api/v1/admin/users').set(auth).send({ fullName: 'Atomicity User', email: 'atomicity@example.test', password: seeded.users.viewerPassword, roleId });
      case 1: return http.patch(`/api/v1/admin/users/${seeded.users.viewerUserId}`).set(auth).send({ fullName: 'Atomicity update' });
      case 2: return http.patch(`/api/v1/admin/users/${seeded.users.viewerUserId}/deactivate`).set(auth).send({});
      case 3: return http.post('/api/v1/admin/roles').set(auth).send({ name: 'Atomicity created', slug: 'atomicity-created' });
      case 4: return http.post(`/api/v1/admin/roles/${roleId}/assign-user`).set(auth).send({ userId: seeded.users.viewerUserId });
      case 5: return http.put(`/api/v1/admin/roles/${roleId}/permissions`).set(auth).send({ permissionSlugs: ['users.read', 'roles.read'] });
      default: return http.patch('/api/v1/admin/settings').set(auth).send({ general: { storeName: 'Atomicity name', supportEmail: 'support@example.test' } });
    }
  }
  for (const [index, action] of actions.entries()) {
    for (const mode of ['before', 'after'] as const) {
      it(`${action} rolls back mutation and audit on ${mode} real audit INSERT failure`, async () => {
        const pre = await snapshot();
        fault = { action, mode };
        await command('fault', fault);
        const response = await mutation(index);
        fault = null;
        await command('fault', null);
        assert.equal(response.status, 500);
        assert.equal(await snapshot(), pre);
        const success = await mutation(index);
        assert.ok([200, 201].includes(success.status));
        assert.equal(await prisma.auditLog.count({ where: { action } }), 1);
      });
    }
  }
  it('concurrent user updates audit the immediately previous committed state', async () => {
    const beforeUser = await prisma.user.findUniqueOrThrow({ where: { id: seeded.users.viewerUserId } });
    const responses = await Promise.all(['First update', 'Second update'].map((fullName) => http.patch(`/api/v1/admin/users/${seeded.users.viewerUserId}`).set('Authorization', `Bearer ${token}`).send({ fullName })));
    assert.deepEqual(responses.map((r) => r.status), [200, 200]);
    const rows = await prisma.auditLog.findMany({ where: { action: 'users.admin.updated' }, orderBy: { id: 'asc' } });
    assert.equal(rows.length, 2);
    // PII is redacted; changing a non-sensitive role verifies the same lock below.
    assert.equal((rows[0].beforeData as Record<string, unknown>).updatedAt, beforeUser.updatedAt.toISOString());
    assert.equal((rows[1].beforeData as Record<string, unknown>).updatedAt, (rows[0].afterData as Record<string, unknown>).updatedAt);
  });
  it('concurrent role assignments preserve an unbroken before/after chain', async () => {
    const previous = seeded.roles.limitedRoleId;
    const other = await prisma.role.create({ data: { id: uuidv7(), name: 'Other target', slug: 'other-target' } });
    const responses = await Promise.all([roleId, other.id].map((id) => http.post(`/api/v1/admin/roles/${id}/assign-user`).set('Authorization', `Bearer ${token}`).send({ userId: seeded.users.viewerUserId })));
    assert.deepEqual(responses.map((r) => r.status), [201, 201]);
    const rows = await prisma.auditLog.findMany({ where: { action: 'roles.assigned_to_user' }, orderBy: { id: 'asc' } });
    assert.equal(rows.length, 2);
    assert.equal((rows[0].beforeData as Record<string, unknown>).roleId, previous);
    assert.equal((rows[1].beforeData as Record<string, unknown>).roleId, (rows[0].afterData as Record<string, unknown>).roleId);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: seeded.users.viewerUserId } })).roleId, (rows[1].afterData as Record<string, unknown>).roleId);
  });
  it('concurrent permission replacement audits the previous complete matrix', async () => {
    const responses = await Promise.all([['users.read'], ['roles.read']].map((permissionSlugs) => http.put(`/api/v1/admin/roles/${roleId}/permissions`).set('Authorization', `Bearer ${token}`).send({ permissionSlugs })));
    assert.deepEqual(responses.map((r) => r.status), [200, 200]);
    const rows = await prisma.auditLog.findMany({ where: { action: 'permissions.assigned_to_role' }, orderBy: { id: 'asc' } });
    assert.equal(rows.length, 2);
    assert.deepEqual((rows[0].beforeData as Record<string, unknown>).permissions, []);
    assert.deepEqual((rows[1].beforeData as Record<string, unknown>).permissions, (rows[0].afterData as Record<string, unknown>).permissions);
    const final = await prisma.rolePermission.findMany({ where: { roleId }, include: { permission: true } });
    assert.deepEqual(final.map((r) => r.permission.slug), (rows[1].afterData as Record<string, unknown>).permissions);
  });
  it('concurrent duplicate user creation leaves one user and one audit', async () => {
    const responses = await Promise.all([mutation(0), mutation(0)]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await prisma.user.count({ where: { email: 'atomicity@example.test' } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { action: 'users.admin.created' } }), 1);
  });
  it('concurrent duplicate role creation leaves one role and one audit', async () => {
    const responses = await Promise.all([mutation(3), mutation(3)]);
    assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await prisma.role.count({ where: { slug: 'atomicity-created' } }), 1);
    assert.equal(await prisma.auditLog.count({ where: { action: 'roles.created' } }), 1);
  });
  it('rolls back the first settings key when the second database write fails', async () => {
    const pre = await snapshot();
    await prisma.$executeRawUnsafe("CREATE FUNCTION iam_atomicity_settings_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.key = 'general.supportEmail' THEN RAISE EXCEPTION 'OWN_SECOND_KEY_FAULT'; END IF; RETURN NEW; END $$");
    await prisma.$executeRawUnsafe('CREATE TRIGGER iam_atomicity_settings_fault BEFORE INSERT OR UPDATE ON admin_settings FOR EACH ROW EXECUTE FUNCTION iam_atomicity_settings_fault()');
    try {
      assert.equal((await mutation(6)).status, 500);
      assert.equal(await snapshot(), pre);
    } finally {
      await prisma.$executeRawUnsafe('DROP TRIGGER iam_atomicity_settings_fault ON admin_settings');
      await prisma.$executeRawUnsafe('DROP FUNCTION iam_atomicity_settings_fault()');
    }
    assert.equal((await mutation(6)).status, 200);
    assert.equal(await prisma.adminSetting.count(), 2);
    assert.equal(await prisma.auditLog.count({ where: { action: 'settings.updated' } }), 1);
  });
  it('fails closed for unauthenticated, revoked current permissions, invalid DTO and self deactivation', async () => {
    const pre = await snapshot();
    assert.equal((await http.patch('/api/v1/admin/settings').send({ general: { storeName: 'Forbidden' } })).status, 401);
    assert.equal((await http.post('/api/v1/admin/users').set('Authorization', `Bearer ${token}`).send({ fullName: 'Invalid', email: 'invalid', password: 'x', roleId })).status, 400);
    assert.equal((await http.patch(`/api/v1/admin/users/${seeded.users.adminUserId}/deactivate`).set('Authorization', `Bearer ${token}`).send({})).status, 409);
    const permission = await prisma.permission.findUniqueOrThrow({ where: { slug: 'settings.write' } });
    await prisma.rolePermission.deleteMany({ where: { roleId: seeded.roles.superAdminRoleId, permissionId: permission.id } });
    const afterRevoke = await snapshot();
    assert.notEqual(pre, afterRevoke);
    assert.equal((await http.patch('/api/v1/admin/settings').set('Authorization', `Bearer ${token}`).send({ general: { storeName: 'Forbidden' } })).status, 403);
    assert.equal(await snapshot(), afterRevoke);
  });
});
