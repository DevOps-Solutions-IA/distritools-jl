import { assertEnvironmentFiles, assertEvidenceDirectory } from './environment.mjs';
import { setTimeout } from 'node:timers';
import console from 'node:console';
import process from 'node:process';
import { createRequire } from 'node:module';
const nodeRequire = createRequire(import.meta.url);
// Only creates new local labelled services. It never accepts an existing DB target.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { validateTargets, verifyContainer, verifyProcess, PHASE, RESERVED_PORTS, validateDockerEndpoint, verifyGroupMember } from './safety.mjs';
const root = path.resolve(import.meta.dirname, '../..');
const frontend = path.join(root, 'frontend');
const containers = [], processes = [];
let runDir, runtime, owner, sourceProof, interrupted = false;
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
function docker(args) { return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function write(name, value) { fs.writeFileSync(path.join(runDir, name), JSON.stringify(value, null, 2), { mode: 0o600 }); }
function inspect(item) {
  const actual = JSON.parse(docker(['inspect', item.id]))[0];
  verifyContainer(actual, { ...item, owner });
  return actual;
}
function proveTargets() {
  assertEnvironmentFiles(root);
  validateTargets({ ports: { postgres: containers.find(item => item.kind === 'postgres').port, redis: containers.find(item => item.kind === 'redis').port }, owner, databaseUrl: runtime.DATABASE_URL, redisUrl: runtime.REDIS_URL, appEnv: runtime.APP_ENV, nodeEnv: runtime.NODE_ENV, authDisabled: runtime.ADMIN_AUTH_DISABLED });
  for (const item of containers) inspect(item);
  const { validateTestEnvironment } = nodeRequire(path.join(root, 'scripts/ci/assert-test-environment'));
  if (!validateTestEnvironment(runtime).ok) throw new Error('Existing test-environment guard refused targets');
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  if (RESERVED_PORTS.has(String(port))) return freePort();
  return port;
}
function processInfo(pid) {
  return { cwd: fs.readlinkSync(`/proc/${pid}/cwd`), argv: fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0'), startTime: fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')[19], pgrp: Number(fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')[2]), sessionId: Number(fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')[3]), state: fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')[0] };
}
async function start(command, args, cwd, env, name, marker) {
  const log = fs.openSync(path.join(runDir, `private-${name}.log`), 'wx', 0o600);
  const child = spawn(command, args, { cwd, env, detached: true, stdio: ['ignore', log, log] });
  fs.closeSync(log);
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  let expected;
  if (!marker) marker = processInfo(child.pid).argv[1];
  if (marker) {
    // Shell wrappers may exec their entrypoint just after spawn; require exact argv.
    for (let attempt = 0; attempt < 30; attempt++) {
      if (child.exitCode !== null) throw new Error(`${name} exited before ownership proof`);
      const actual = processInfo(child.pid);
      if (actual.argv.includes(marker)) { if (actual.pgrp !== child.pid) throw new Error('Exclusive process group was not created'); expected = { cwd, marker, startTime: actual.startTime, groupId: actual.pgrp, root }; break; }
      await pause(100);
    }
    if (!expected) throw new Error(`${name} exact process entrypoint not observed`);
    processes.push({ child, expected, name });
    write('processes.json', processes.map(item => ({ pid: item.child.pid, ...item.expected, owner, name: item.name })));
  }
  return child;
}
async function command(name, executable, args, cwd, env) {
  const marker = path.join(frontend, 'e2e/qa-command.mjs');
  const child = await start(process.execPath, [marker, executable, ...args], cwd, env, name, marker);
  const code = await new Promise((resolve, reject) => {
    const timer = globalThis.setInterval(() => { if (interrupted) { globalThis.clearInterval(timer); reject(new Error('Interrupted during owned command')); } }, 200);
    child.once('exit', value => { globalThis.clearInterval(timer); resolve(value); });
  });
  if (interrupted) throw new Error('Interrupted during owned command');
  write(`${name}-receipt.json`, { status: code === 0 ? 'PASS' : 'FAIL', code, name });
  if (code !== 0) throw new Error(`${name} failed; private log preserved`);
}
async function waitFor(check, name, timeout = 90_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (interrupted) throw new Error('Interrupted'); if (await check()) return; await pause(300); }
  throw new Error(`${name} did not become ready`);
}
async function createContainer(kind, image, internalPort, args, envFile) {
  const name = `${owner}-${kind}`;
  const hostPort = await freePort();
  const dockerArgs = ['run', '--detach', '--label', `qa.owner=${owner}`, '--label', `qa.phase=${PHASE}`, '--name', name, '--publish', `127.0.0.1:${hostPort}:${internalPort}`];
  if (envFile) dockerArgs.push('--env-file', envFile);
  dockerArgs.push(image, ...args);
  const id = docker(dockerArgs);
  const actual = JSON.parse(docker(['inspect', id]))[0];
  const item = { id, kind, name, image, internalPort: `${internalPort}/tcp`, port: actual.NetworkSettings.Ports[`${internalPort}/tcp`][0].HostPort };
  containers.push(item);
  inspect(item);
  write('services.json', { owner, phase: PHASE, containers, authority: 'Created by this runner; IDs/labels/bindings verified before each mutation and cleanup' });
  return item;
}
function groupMembers(expected) {
  const members = [];
  for (const entry of fs.readdirSync('/proc')) {
    if (!/^\d+$/.test(entry)) continue;
    try {
      const actual = processInfo(Number(entry));
      if (actual.pgrp !== expected.groupId || actual.state === 'Z') continue;
      verifyGroupMember(actual, expected);
      members.push({ pid: Number(entry), ...actual });
    } catch (error) {
      if (!['ENOENT', 'ESRCH', 'EACCES'].includes(error.code)) throw error;
    }
  }
  return members;
}
async function cleanup() {
  const results = [];
  for (const item of processes.toReversed()) {
    try {
      const members = groupMembers(item.expected);
      if (!members.length) { results.push({ kind: 'process', name: item.name, alreadyStopped: true }); continue; }
      const leader = members.find(member => member.pid === item.child.pid);
      if (leader) verifyProcess(leader, item.expected);
      for (const member of members) {
        try {
          const actual = processInfo(member.pid);
          verifyGroupMember(actual, item.expected);
          if (actual.startTime !== member.startTime) throw new Error('PID changed during own group cleanup');
          process.kill(member.pid, 'SIGTERM');
        } catch (error) { if (!['ENOENT', 'ESRCH'].includes(error.code)) throw error; }
      }
      const deadline = Date.now() + 20_000;
      while (groupMembers(item.expected).length && Date.now() < deadline) await pause(100);
      for (const member of groupMembers(item.expected)) {
        verifyGroupMember(processInfo(member.pid), item.expected);
        process.kill(member.pid, 'SIGKILL');
      }
      results.push({ kind: 'process', name: item.name, groupId: item.expected.groupId, stopped: true, provedMembers: members.map(member => ({ pid: member.pid, cwd: member.cwd, startTime: member.startTime })) });
    } catch { results.push({ kind: 'process', name: item.name, status: 'FAIL ownership mismatch; left untouched' }); }
  }
  for (const item of containers.toReversed()) {
    try { inspect(item); docker(['rm', '--force', '--volumes', item.id]); results.push({ kind: 'container', id: item.id, removed: true }); }
    catch { results.push({ kind: 'container', id: item.id, status: 'FAIL ownership/cleanup; left untouched' }); }
  }
  if (runDir) write('cleanup.json', { owner, results });
  if (results.some(item => item.status)) process.exitCode = 1;
}
function sourceHashes() {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean).map(file => path.join(root, file));
  const owned = fs.readdirSync(path.join(frontend, 'e2e'), { recursive: true }).map(file => path.join(frontend, 'e2e', file)).filter(file => fs.statSync(file).isFile());
  owned.push(path.join(frontend, 'playwright.config.ts'), path.join(frontend, 'package.json'), path.join(frontend, 'package-lock.json'));
  const files = Array.from(new Set([...tracked, ...owned])).sort();
  return Object.fromEntries(files.map(file => [path.relative(root, file), createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
}
async function main() {
  assertEnvironmentFiles(root);
  const evidence = assertEvidenceDirectory(process.env.EX08_BROWSER_EVIDENCE_DIR, root);
  if (process.env.DATABASE_URL || process.env.REDIS_URL) throw new Error('Existing service URLs are refused; use this runner with no DATABASE_URL/REDIS_URL exported');
  if ((process.env.APP_ENV && process.env.APP_ENV !== 'test') || process.env.NODE_ENV === 'production' || process.env.ADMIN_AUTH_DISABLED === 'true') throw new Error('Production/auth bypass environment refused');
  const dockerContext = JSON.parse(docker(['context', 'inspect']))[0];
  validateDockerEndpoint(dockerContext.Endpoints.docker.Host);
  if (process.env.DOCKER_HOST) validateDockerEndpoint(process.env.DOCKER_HOST);
  fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });
  const verifiedEvidence = assertEvidenceDirectory(evidence, root);
  if (verifiedEvidence !== evidence) throw new Error('Evidence directory changed during initialization');
  runDir = fs.mkdtempSync(path.join(verifiedEvidence, 'run-'));
  fs.chmodSync(runDir, 0o700);
  owner = `ex08-qa-browser-${randomBytes(10).toString('hex')}`;
  sourceProof = sourceHashes();
  write('source-hashes.json', { head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), dirty: Boolean(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).trim()), aggregate: createHash('sha256').update(JSON.stringify(sourceProof)).digest('hex'), files: sourceProof, semantics: 'All tracked source plus owned untracked QA files; HEAD is parent when dirty, not a tested committed candidate' });
  write('entry.json', { owner, pid: process.pid, root, head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), time: new Date().toISOString(), production: 'NO-GO' });
  const postgresFile = path.join(runDir, 'private-postgres.env');
  const password = randomBytes(24).toString('hex');
  fs.writeFileSync(postgresFile, `POSTGRES_USER=qa\nPOSTGRES_PASSWORD=${password}\nPOSTGRES_DB=ex08_qa_browser_test\n`, { mode: 0o600 });
  const pg = await createContainer('postgres', 'postgres:16-alpine', 5432, [], postgresFile);
  const redis = await createContainer('redis', 'redis:7-alpine', 6379, ['redis-server', '--appendonly', 'yes', '--appendfsync', 'always', '--maxmemory-policy', 'noeviction']);
  const backendPort = await freePort(), frontendPort = await freePort();
  runtime = Object.fromEntries(['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'SYSTEMROOT'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(runtime, { DOCKER_CONTEXT: dockerContext.Name, NODE_ENV: 'test', APP_ENV: 'test', CI: 'true', ADMIN_AUTH_DISABLED: 'false', AUTO_SHIPPING_MODE: 'disabled', NODE_PATH: `${root}/dist:${root}`, DATABASE_URL: `postgresql://qa:${password}@127.0.0.1:${pg.port}/ex08_qa_browser_test?schema=public&connection_limit=20`, REDIS_URL: `redis://127.0.0.1:${redis.port}`, REDIS_PASSWORD: '', EX08_BROWSER_RUN_DIR: runDir, EX08_BROWSER_BACKEND_PORT: String(backendPort), EX08_BROWSER_BASE_URL: `http://127.0.0.1:${frontendPort}`, NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${backendPort}`, NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${frontendPort}`, NEXT_TELEMETRY_DISABLED: '1', npm_config_cache: process.env.npm_config_cache || path.join(os.homedir(), '.npm') });
  if (process.env.DOCKER_HOST) runtime.DOCKER_HOST = process.env.DOCKER_HOST;
  for (const key of ['PAYMENT_GATEWAY_SECRET', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JWT_2FA_CHALLENGE_SECRET', 'TWO_FACTOR_ENCRYPTION_KEY']) runtime[key] = randomBytes(32).toString('hex');
  proveTargets();
  await waitFor(async () => { inspect(pg); try { return docker(['exec', pg.id, 'pg_isready', '-h', '127.0.0.1', '-U', 'qa', '-d', 'ex08_qa_browser_test']).includes('accepting connections'); } catch { return false; } }, 'PostgreSQL');
  inspect(pg); const pgVersion = docker(['exec', pg.id, 'psql', '-U', 'qa', '-d', 'ex08_qa_browser_test', '-Atc', 'SHOW server_version']);
  if (!pgVersion.startsWith('16.')) throw new Error('PostgreSQL16 required');
  await waitFor(async () => { inspect(redis); try { return docker(['exec', redis.id, 'redis-cli', 'ping']) === 'PONG'; } catch { return false; } }, 'Redis');
  inspect(redis); const redisVersion = docker(['exec', redis.id, 'redis-server', '--version']);
  if (!redisVersion.includes('v=7.')) throw new Error('Redis7 required');
  for (const [key, expected] of [['appendonly', 'yes'], ['appendfsync', 'always'], ['maxmemory-policy', 'noeviction']]) {
    inspect(redis); if (docker(['exec', redis.id, 'redis-cli', '--raw', 'CONFIG', 'GET', key]).split('\n')[1] !== expected) throw new Error('Queue Redis contract mismatch');
  }
  write('service-version-proof.json', { postgres: pgVersion, redis: redisVersion, queueContract: 'appendonly yes/appendfsync always/noeviction', owner });
  // Existing helper requires a file even though all sensitive settings are already supplied.
  const envFile = path.join(root, '.env.test');
  if (!fs.existsSync(envFile)) fs.writeFileSync(envFile, '# Browser runner supplies authoritative private process environment.\n', { mode: 0o600 });
  proveTargets(); await command('prisma-validate', 'npm', ['run', 'prisma:validate'], root, runtime);
  proveTargets(); await command('prisma-generate', 'npm', ['run', 'prisma:generate'], root, runtime);
  proveTargets(); await command('prisma-migrate', 'npm', ['run', 'prisma:migrate:deploy'], root, runtime);
  await command('backend-build', 'npm', ['run', 'build'], root, runtime);
  const backendMarker = path.join(frontend, 'e2e/qa-backend.mjs');
  proveTargets(); await start(process.execPath, [backendMarker], root, runtime, 'backend', backendMarker);
  await waitFor(async () => fs.existsSync(path.join(runDir, 'backend-ready.json')), 'Real Nest backend', 180_000);
  const production = { ...runtime, NODE_ENV: 'production' };
  await command('next-build', 'npm', ['run', 'build'], frontend, production);
  const nextMarker = path.join(frontend, 'e2e/qa-next.mjs');
  await start(process.execPath, [nextMarker], frontend, production, 'next', nextMarker);
  await waitFor(async () => { try { return (await globalThis.fetch(`${runtime.EX08_BROWSER_BASE_URL}/admin/login`)).status === 200; } catch { return false; } }, 'Compiled Next production');
  proveTargets(); await command('playwright', process.execPath, [path.join(frontend, 'node_modules/@playwright/test/cli.js'), 'test'], frontend, runtime);
  if (JSON.stringify(sourceHashes()) !== JSON.stringify(sourceProof)) throw new Error('Harness source changed during execution; run evidence is not final acceptance');
  write('acceptance.json', { status: 'PASS', sourceHashesVerified: true, sourceAggregate: createHash('sha256').update(JSON.stringify(sourceProof)).digest('hex'), head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), owner, scope: 'Selected actual platform browser flows only; all42/71 domain certification NOT_TESTED', production: 'NO-GO' });
  console.log(`PASS reproducible isolated browser baseline; sanitized evidence ${runDir}/browser-results.json`);
}
process.once('SIGINT', () => { interrupted = true; });
process.once('SIGTERM', () => { interrupted = true; });
main().catch(error => {
  console.error(`FAIL browser infrastructure: ${error.message}`);
  if (runDir) write('failure.json', { status: 'FAIL', reason: error.message, details: 'Private process logs retained; never upload private-* or fixture files' });
  process.exitCode = 1;
}).finally(cleanup);
