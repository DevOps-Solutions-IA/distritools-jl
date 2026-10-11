import process from 'node:process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const nodeRequire = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../..');
const { validateTestEnvironment } = nodeRequire(path.join(root, 'scripts/ci/assert-test-environment.js'));
const allowed = new Set(['CI', 'NODE_ENV', 'APP_ENV', 'ADMIN_AUTH_DISABLED', 'DATABASE_URL', 'REDIS_URL', 'REDIS_PASSWORD', 'AUTO_SHIPPING_MODE', 'PAYMENT_GATEWAY_SECRET', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'JWT_2FA_CHALLENGE_SECRET', 'TWO_FACTOR_ENCRYPTION_KEY']);
function assertEnvironmentFiles(worktree, context = { ci: process.env.CI }) {
  for (const directory of [worktree, path.join(worktree, 'frontend')]) {
    for (const name of ['.env', '.env.local', '.env.production', '.env.production.local', '.env.test.local']) {
      assert.ok(!fs.existsSync(path.join(directory, name)), 'Application/Next dotenv files are refused; leave existing files intact and use a clean exclusive QA worktree');
    }
  }
  const testFile = path.join(worktree, '.env.test');
  if (!fs.existsSync(testFile)) return;
  const values = {};
  for (const line of fs.readFileSync(testFile, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    assert.ok(separator > 0, 'Ambiguous test environment file syntax');
    const key = trimmed.slice(0, separator);
    assert.ok(allowed.has(key), 'Unknown/provider key in test environment file; file left intact');
    assert.ok(!(key in values), 'Duplicate test environment setting is refused');
    values[key] = trimmed.slice(separator + 1);
  }
  if (!Object.keys(values).length) return;
  assert.equal(context.ci, 'true', 'Nonempty existing test files are accepted only inside the documented isolated CI boundary');
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8');
  const heredoc = workflow.match(/cat > \.env\.test <<'EOF'\n([\s\S]*?)\n\s+EOF/);
  assert.ok(heredoc, 'Canonical isolated critical-CI test file contract was not found');
  const canonical = Object.fromEntries(heredoc[1].split('\n').map(line => line.trim()).filter(Boolean).map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1)]; }));
  if (Object.keys(values).length !== Object.keys(canonical).length || Object.entries(canonical).some(([key, value]) => values[key] !== value)) {
    throw new Error('Existing test file differs from canonical isolated CI fixture; private values omitted');
  }
  for (const [key, expected] of [['CI', 'true'], ['NODE_ENV', 'test'], ['APP_ENV', 'test'], ['ADMIN_AUTH_DISABLED', 'false'], ['AUTO_SHIPPING_MODE', 'disabled'], ['REDIS_PASSWORD', '']]) {
    if (key in values) assert.equal(values[key], expected, 'Unsafe or ambiguous existing test environment setting');
  }
  if ('DATABASE_URL' in values || 'REDIS_URL' in values) {
    const result = validateTestEnvironment({ ...values, CI: 'true', NODE_ENV: 'test' });
    assert.ok(result.ok, 'Existing test file must contain safe local test URLs; these URLs are never reused');
  }
}

function assertEvidenceDirectory(directory, worktree) {
  assert.ok(typeof directory === 'string' && path.isAbsolute(directory), 'Set EX08_BROWSER_EVIDENCE_DIR to an absolute persistent directory outside the repository');
  const realRoot = fs.realpathSync(worktree);
  let ancestor = path.resolve(directory);
  const missing = [];
  while (true) {
    try { fs.lstatSync(ancestor); break; }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const parent = path.dirname(ancestor);
      assert.notEqual(parent, ancestor, 'Evidence directory ancestor could not be resolved');
      missing.unshift(path.basename(ancestor));
      ancestor = parent;
    }
  }
  const realAncestor = fs.realpathSync(ancestor);
  assert.ok(fs.statSync(realAncestor).isDirectory(), 'Evidence path must resolve through a real directory');
  const resolved = path.resolve(realAncestor, ...missing);
  const relative = path.relative(realRoot, resolved);
  assert.ok(relative && (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)), 'Evidence directory must resolve outside the repository');
  return resolved;
}
export { assertEnvironmentFiles, assertEvidenceDirectory };
