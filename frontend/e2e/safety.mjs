import { URL } from 'node:url';
import assert from 'node:assert/strict';
const RESERVED_PORTS = new Set(['5432', '6379', '55440', '56379', '33155', '33156', '33157', '33158', '33159', '33160', '33161', '3322', '3324', '3326', '3327', ...Array.from({ length: 24 }, (_, index) => String(33451 + index))]);
const PHASE = 'EX08_QA_BROWSER_INFRA';
function validateTargets(target) {
  assert.match(target.owner, /^ex08-qa-browser-[a-f0-9]{10,}$/);
  assert.equal(target.nodeEnv, 'test');
  assert.equal(target.appEnv, 'test');
  assert.equal(target.authDisabled, 'false');
  const database = new URL(target.databaseUrl), redis = new URL(target.redisUrl);
  for (const url of [database, redis]) {
    assert.equal(url.hostname, '127.0.0.1', 'Only explicit IPv4 loopback targets are allowed');
    assert.ok(url.port && !RESERVED_PORTS.has(url.port), 'Refusing shared/default/other-agent service port');
  }
  assert.ok(['postgres:', 'postgresql:'].includes(database.protocol));
  assert.match(decodeURIComponent(database.pathname.slice(1)), /^ex08_qa_browser_test$/);
  assert.equal(database.port, String(target.ports?.postgres), 'Database URL does not belong to the owned container');
  assert.equal(redis.port, String(target.ports?.redis), 'Redis URL does not belong to the owned container');
  assert.equal(redis.protocol, 'redis:');
  assert.equal(redis.pathname, '', 'Only newly owned Redis database zero');
}
function verifyContainer(actual, expected) {
  assert.equal(actual.Id, expected.id);
  assert.equal(actual.Config.Labels['qa.owner'], expected.owner);
  assert.equal(actual.Config.Labels['qa.phase'], PHASE);
  assert.notEqual(actual.HostConfig.NetworkMode, 'host');
  assert.ok(!actual.HostConfig.Binds?.length, 'Refusing host-mounted containers');
  assert.ok(!actual.Mounts?.some(mount => mount.Type === 'bind'), 'Refusing Docker bind mounts');
  const bindings = actual.NetworkSettings.Ports[expected.internalPort];
  assert.equal(bindings?.length, 1);
  assert.equal(bindings[0].HostIp, '127.0.0.1');
  assert.equal(bindings[0].HostPort, String(expected.port));
}
function verifyProcess(actual, expected) {
  assert.equal(actual.cwd, expected.cwd);
  assert.ok(actual.argv.includes(expected.marker), 'Refusing process with different exact entrypoint');
  if (expected.startTime) assert.equal(actual.startTime, expected.startTime, 'PID was reused');
}
function validateDockerEndpoint(endpoint) {
  const url = new URL(endpoint);
  assert.equal(url.protocol, 'unix:', 'Remote Docker daemons are refused');
  assert.equal(url.hostname, '');
  assert.ok(url.pathname.startsWith('/') && url.pathname.endsWith('/docker.sock'));
}
function verifyGroupMember(actual, expected) {
  assert.equal(actual.pgrp, expected.groupId);
  assert.equal(actual.sessionId, expected.groupId);
  assert.ok(BigInt(actual.startTime) >= BigInt(expected.startTime), 'Refusing process older than own group');
  assert.ok(actual.cwd === expected.root || actual.cwd.startsWith(`${expected.root}/`), 'Refusing outside-worktree group member');
  assert.ok(actual.argv.length > 0 && actual.argv[0], 'Missing command ownership evidence');
}
export { verifyGroupMember, validateDockerEndpoint, validateTargets, verifyContainer, verifyProcess, PHASE, RESERVED_PORTS };
