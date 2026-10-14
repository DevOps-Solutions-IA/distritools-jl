import 'reflect-metadata';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ConflictException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { IamPrismaUnitOfWork } from 'src/modules/users/infrastructure/transactions/iam-prisma-unit-of-work';

const required = ['users.create', 'users.read', 'users.update', 'users.write', 'users.deactivate', 'users.disable', 'users.reset_2fa', 'roles.create', 'roles.read', 'roles.update', 'roles.write', 'roles.assign', 'permissions.assign', 'permissions.read'];
describe('EX08 last superadmin canonical authority and locking', () => {
  it('shares the complete existing114 tuple catalog with CLI without importing CLI into backend', () => {
    const canonical = require('src/common/security/admin-permission-catalog');
    const cli = require('../../scripts/admin/credential-utils');
    assert.strictEqual(cli.ADMIN_PERMISSION_CATALOG, canonical.ADMIN_PERMISSION_CATALOG);
    assert.equal(canonical.ADMIN_PERMISSION_CATALOG.length, 114);
    assert.deepEqual(canonical.ADMIN_PERMISSION_CATALOG.filter(([, module]: string[]) => ['users', 'roles', 'permissions'].includes(module)).map(([slug]: string[]) => slug), required);
    const pure = readFileSync('src/common/security/admin-permission-catalog.ts', 'utf8');
    const ts = require('typescript');
    const parsed = ts.createSourceFile('catalog.ts', pure, ts.ScriptTarget.Latest, true);
    assert.equal(parsed.statements.every((statement: unknown) => ts.isVariableStatement(statement) || ts.isTypeAliasDeclaration(statement)), true);
  });
  it('derives all14 IAM grants rather than114 or manual divergent authority', () => {
    const authority = require('src/common/security/super-admin-role.constants');
    assert.deepEqual(authority.SUPER_ADMIN_IAM_PERMISSION_SLUGS, required);
    assert.equal(authority.SUPER_ADMIN_ROLE_SLUG, 'super-admin');
    assert.strictEqual(require('../../scripts/admin/credential-utils').SUPER_ADMIN_ROLE_SLUG, authority.SUPER_ADMIN_ROLE_SLUG);
    assert.doesNotMatch(readFileSync('src/common/security/super-admin-role.constants.ts', 'utf8'), /scripts\/admin|node:fs|credential-utils/);
  });
  it('takes a database-global transaction lock before unique/user/role locks and callback', async () => {
    const calls: string[] = [];
    const tx = {
      $executeRaw: async (text: TemplateStringsArray, ...values: unknown[]) => { calls.push(text.join('?') + JSON.stringify(values)); },
      $queryRaw: async (text: TemplateStringsArray) => { calls.push(text.join('?')); return []; },
    };
    const prisma = { $transaction: async (operation: (value: unknown) => Promise<unknown>) => operation(tx) };
    const uow = Reflect.construct(IamPrismaUnitOfWork, [prisma, {}]);
    await uow.run(async () => { calls.push('callback'); return 'ok'; }, { uniqueKey: 'unique', userId: 'user', roleId: 'role' });
    assert.match(calls[0], /iam:last-active-super-admin/);
    assert.match(calls[1], /unique/);
    assert.match(calls[2], /users/);
    assert.match(calls[3], /roles/);
    assert.equal(calls[4], 'callback');
  });
  it('the same global lock protects even neutral/create UOWs with no target lock', async () => {
    const calls: string[] = [];
    const tx = { $executeRaw: async (_text: TemplateStringsArray, ...values: unknown[]) => { calls.push(String(values[0])); } };
    const uow = Reflect.construct(IamPrismaUnitOfWork, [{ $transaction: async (f: (t: unknown) => unknown) => f(tx) }, {}]);
    assert.equal(await uow.run(async () => { calls.push('operation'); return 42; }), 42);
    assert.deepEqual(calls, ['iam:last-active-super-admin', 'operation']);
  });
  for (const rawSlug of ['', '   ']) {
    it(`blank canonical slug ${JSON.stringify(rawSlug)} cannot eliminate protected access`, async () => {
      const audits: unknown[] = [];
      const canonical = { id: 'canonical', users: [{ id: 'last' }], rolePermissions: required.map((slug) => ({ permission: { slug } })) };
      const tx = { $executeRaw: async () => 0, role: { findUnique: async ({ where }: { where: { slug: string } }) => where.slug === 'super-admin' ? canonical : null } };
      const uow = Reflect.construct(IamPrismaUnitOfWork, [{ $transaction: async (f: (t: unknown) => unknown) => f(tx) }, { write: async (audit: unknown) => { audits.push(audit); } }]);
      let invoked = false;
      await assert.rejects(uow.run(async () => { invoked = true; }, { protection: { operation: 'roles.updated', entityType: 'role', entityId: 'canonical', roleId: 'canonical', nextSlug: rawSlug.trim() } }), ConflictException);
      assert.equal(invoked, false);
      assert.equal(audits.length, 1);
    });
  }
});
