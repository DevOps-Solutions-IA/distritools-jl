import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
const root = path.resolve(import.meta.dirname, '../..');
function probe(makePath) {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'ex08-evidence-path-'));
  fs.chmodSync(fixture, 0o700);
  const bin = path.join(fixture, 'bin'); fs.mkdirSync(bin);
  const marker = path.join(fixture, 'docker-contact');
  fs.writeFileSync(path.join(bin, 'docker'), `#!/bin/sh\n/usr/bin/touch '${marker}'\nexit 93\n`, { mode: 0o700 });
  const evidence = makePath(fixture);
  const env = Object.fromEntries(['PATH', 'HOME', 'USER', 'LANG', 'TMPDIR'].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  env.PATH = `${bin}:${env.PATH}`; env.EX08_BROWSER_EVIDENCE_DIR = evidence;
  const result = spawnSync(process.execPath, [path.join(root, 'frontend/e2e/run.cjs')], { cwd: root, env, encoding: 'utf8', timeout: 10_000 });
  assert.equal(result.status, 1); // The deliberate Docker sentinel also exits nonzero for safe paths.
  return { result, reachedDocker: fs.existsSync(marker) };
}
function refused(makePath) { const output = probe(makePath); assert.equal(output.reachedDocker, false, 'Unsafe filesystem destination must be refused before Docker contact'); }
function allowed(makePath) { const output = probe(makePath); assert.equal(output.reachedDocker, true, 'A safe external destination must reach the deliberate Docker sentinel'); }
test('refuses external symlink whose resolved destination is the worktree', () => refused(fixture => { const alias = path.join(fixture, 'repo-alias'); fs.symlinkSync(root, alias, 'dir'); return alias; }));
test('refuses missing nested evidence under an external symlink into the worktree', () => refused(fixture => { const alias = path.join(fixture, 'repo-alias'); fs.symlinkSync(root, alias, 'dir'); return path.join(alias, 'not-created', 'private-output'); }));
test('refuses direct evidence inside worktree before Docker', () => refused(() => path.join(root, 'not-created-evidence')));
test('permits a real external directory without changing it', () => allowed(fixture => fixture));
test('permits missing nested external directories', () => allowed(fixture => path.join(fixture, 'not-created', 'external-output')));
test('permits an external symlink resolved to a real external directory', () => allowed(fixture => { const target = path.join(fixture, 'real-external'); fs.mkdirSync(target); const alias = path.join(fixture, 'external-alias'); fs.symlinkSync(target, alias, 'dir'); return path.join(alias, 'new-output'); }));
