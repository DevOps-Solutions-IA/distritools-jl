import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertEnvironmentFiles } from './environment.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateTargets, verifyContainer, verifyProcess, validateDockerEndpoint, verifyGroupMember } from './safety.mjs';
const owner = 'ex08-qa-browser-0123456789';
const target = { owner, databaseUrl: 'postgresql://qa:private@127.0.0.1:33171/ex08_qa_browser_test', redisUrl: 'redis://127.0.0.1:33172', nodeEnv: 'test', appEnv: 'test', authDisabled: 'false', ports: { postgres: '33171', redis: '33172' } };
const container = { Id: 'a'.repeat(64), Config: { Labels: { 'qa.owner': owner, 'qa.phase': 'EX08_QA_BROWSER_INFRA' } }, HostConfig: { NetworkMode: 'bridge', Binds: null }, NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '33171' }] } } };
test('accepts own loopback test-named targets', () => assert.doesNotThrow(() => validateTargets(target)));
for (const [name, change] of Object.entries({ remote: { databaseUrl: 'postgresql://qa:private@db.example.test:33171/ex08_qa_browser_test' }, production: { appEnv: 'production' }, sharedPostgres: { databaseUrl: 'postgresql://qa:private@127.0.0.1:55440/ex08_qa_browser_test' }, sharedRedis: { redisUrl: 'redis://127.0.0.1:56379' }, unnamedDatabase: { databaseUrl: 'postgresql://qa:private@127.0.0.1:33171/distritools' }, authBypass: { authDisabled: 'true' }, missingOwner: { owner: '' }, wrongScheme: { redisUrl: 'https://127.0.0.1:33172' }, otherAgent: { redisUrl: 'redis://127.0.0.1:33160' }, ambiguousDefault: { redisUrl: 'redis://127.0.0.1' } })) {
  test(`refuses ${name} before mutation`, () => assert.throws(() => validateTargets({ ...target, ...change })));
}
test('accepts exact own container ID labels and loopback binding', () => assert.doesNotThrow(() => verifyContainer(container, { id: container.Id, owner, port: '33171', internalPort: '5432/tcp' })));
for (const [name, mutate] of Object.entries({ owner: x => { x.Config.Labels['qa.owner'] = 'other'; }, phase: x => { x.Config.Labels['qa.phase'] = 'production'; }, binding: x => { x.NetworkSettings.Ports['5432/tcp'][0].HostIp = '0.0.0.0'; }, mount: x => { x.HostConfig.Binds = ['/srv/live:/data']; }, hostNetwork: x => { x.HostConfig.NetworkMode = 'host'; }, id: x => { x.Id = 'b'.repeat(64); } })) {
  test(`refuses container ${name} before cleanup/mutation`, () => { const bad = globalThis.structuredClone(container); mutate(bad); assert.throws(() => verifyContainer(bad, { id: container.Id, owner, port: '33171', internalPort: '5432/tcp' })); });
}
test('refuses another process even when PID matches descriptor', () => assert.throws(() => verifyProcess({ cwd: '/srv/preview', argv: ['node', 'server.js'] }, { cwd: '/tmp/own', marker: 'qa-backend.ts' })));
test('accepts process only with exact worktree and entrypoint', () => assert.doesNotThrow(() => verifyProcess({ cwd: '/tmp/own', argv: ['node', 'tsx', '/tmp/own/frontend/e2e/qa-backend.ts'] }, { cwd: '/tmp/own', marker: '/tmp/own/frontend/e2e/qa-backend.ts' })));

test('refuses different loopback test database despite a valid owned descriptor', () => assert.throws(() => validateTargets({ ...target, ports: { postgres: '33179', redis: '33172' } })));
test('refuses Docker remote endpoint before creating containers', () => assert.throws(() => validateDockerEndpoint('ssh://production.example.test')));
test('accepts only local Unix Docker endpoint', () => assert.doesNotThrow(() => validateDockerEndpoint('unix:///var/run/docker.sock')));
test('refuses bind mount provided through Docker Mounts API', () => { const bad = globalThis.structuredClone(container); bad.Mounts = [{ Type: 'bind', Source: '/srv/live' }]; assert.throws(() => verifyContainer(bad, { id: container.Id, owner, port: '33171', internalPort: '5432/tcp' })); });

test('refuses unrelated process group during cancellation', () => assert.throws(() => verifyGroupMember({ cwd: '/tmp/own', pgrp: 999, sessionId: 123, startTime: '200', argv: ['node', 'build'] }, { root: '/tmp/own', groupId: 123, startTime: '100' })));
test('refuses a group member working outside exclusive worktree', () => assert.throws(() => verifyGroupMember({ cwd: '/srv/live', pgrp: 123, sessionId: 123, startTime: '200', argv: ['node', 'server'] }, { root: '/tmp/own', groupId: 123, startTime: '100' })));
test('refuses older reused process in group', () => assert.throws(() => verifyGroupMember({ cwd: '/tmp/own', pgrp: 123, sessionId: 123, startTime: '50', argv: ['node', 'build'] }, { root: '/tmp/own', groupId: 123, startTime: '100' })));
test('accepts descendant only in newly created own group and owned worktree', () => assert.doesNotThrow(() => verifyGroupMember({ cwd: '/tmp/own/frontend', pgrp: 123, sessionId: 123, startTime: '200', argv: ['node', 'build'] }, { root: '/tmp/own', groupId: 123, startTime: '100' })));

function environmentFixture(files) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ex08-qa-env-guard-'));
  fs.mkdirSync(path.join(directory, 'frontend'));
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(directory, name), content, { mode: 0o600 });
  return directory;
}
test('permits comment-only test helper file without provider settings', () => assert.doesNotThrow(() => assertEnvironmentFiles(environmentFixture({ '.env.test': '# Process environment supplies fresh synthetic settings\n' }))));
test('refuses backend dotenv before Docker/migration without removing file', () => { const directory = environmentFixture({ '.env': 'APP_ENV=production\n' }); assert.throws(() => assertEnvironmentFiles(directory)); assert.equal(fs.existsSync(path.join(directory, '.env')), true); });
test('refuses Next production dotenv before Docker/migration without removing file', () => assert.throws(() => assertEnvironmentFiles(environmentFixture({ 'frontend/.env.production.local': 'APP_ENV=production\n' }))));
test('refuses unknown/provider test environment keys before helper can inherit them', () => assert.throws(() => assertEnvironmentFiles(environmentFixture({ '.env.test': 'REAL_PROVIDER_TOKEN=synthetic-placeholder\n' }))));
const workflow = fs.readFileSync(path.resolve(import.meta.dirname, '../../.github/workflows/ci.yml'), 'utf8');
const ciTestFile = workflow.match(/cat > \.env\.test <<'EOF'\n([\s\S]*?)\n\s+EOF/)[1].split('\n').map(line => line.trim()).join('\n') + '\n';
test('permits exact original isolated critical-CI file only under CI boundary and never reuses URLs', () => assert.doesNotThrow(() => assertEnvironmentFiles(environmentFixture({ '.env.test': ciTestFile }), { ci: 'true' })));
test('refuses same nonempty CI file in ordinary local environment', () => assert.throws(() => assertEnvironmentFiles(environmentFixture({ '.env.test': ciTestFile }), { ci: 'false' })));
test('refuses foreign test URL even under CI file exception', () => assert.throws(() => assertEnvironmentFiles(environmentFixture({ '.env.test': ciTestFile.replace('127.0.0.1:5432', 'foreign.example.test:5432') }), { ci: 'true' })));

test('never includes a mismatched private setting value in guard error message', () => {
  const syntheticPrivate = randomBytes(20).toString('hex');
  const modified = ciTestFile.replace(/JWT_ACCESS_SECRET=[^\n]*/, `JWT_ACCESS_SECRET=${syntheticPrivate}`);
  let error;
  try { assertEnvironmentFiles(environmentFixture({ '.env.test': modified }), { ci: 'true' }); } catch (caught) { error = caught; }
  assert.ok(error);
  assert.equal(error.message.includes(syntheticPrivate), false);
});
