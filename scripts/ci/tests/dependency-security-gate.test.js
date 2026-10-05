const assert = require('node:assert/strict');
const test = require('node:test');
const { evaluateAudit, findingFingerprint } = require('../dependency-security-gate');

const baselineFindings = [
  findingFingerprint('prisma', { nodes: ['node_modules/prisma'], via: ['@prisma/config'] }),
  findingFingerprint('@nestjs/swagger', { nodes: ['node_modules/@nestjs/swagger'], via: ['js-yaml'] }),
];
const baseline = { critical: 0, high: 4, moderate: 2, low: 1, findings: baselineFindings };

function report(counts, vulnerabilities = {}) {
  return { metadata: { vulnerabilities: counts }, vulnerabilities };
}

test('accepts documented counts and keeps residual advisories visible', () => {
  const result = evaluateAudit('backend-full', baseline, report(baseline, {
    prisma: { severity: 'high', nodes: ['node_modules/prisma'], via: ['@prisma/config'] },
    '@nestjs/swagger': { severity: 'moderate', nodes: ['node_modules/@nestjs/swagger'], via: ['js-yaml'] },
  }));

  assert.equal(result.ok, true);
  assert.equal(result.findings.length, 2);
  assert.deepEqual(result.findings.map(({ name }) => name), ['prisma', '@nestjs/swagger']);
});

test('fails when any severity exceeds its documented baseline', () => {
  const result = evaluateAudit('backend-full', baseline, report({ ...baseline, high: 5 }, {
    prisma: { severity: 'high', nodes: ['node_modules/prisma'], via: ['@prisma/config'] },
    introduced: { severity: 'high', nodes: ['node_modules/introduced'], via: ['GHSA-example'] },
  }));

  assert.equal(result.ok, false);
  assert.ok(result.regressions.includes('high: 5 > 4'));
  assert.equal(result.findings.some(({ name }) => name === 'introduced'), true);
});

test('always fails a new critical even if another count is below baseline', () => {
  const result = evaluateAudit('frontend-full', { critical: 0, high: 5, moderate: 0, low: 0, findings: ['known|node_modules/known|advisory:known'] }, report({
    critical: 1, high: 4, moderate: 0, low: 0,
  }, { compromised: { severity: 'critical', nodes: ['node_modules/compromised'], via: ['GHSA-example'] } }));

  assert.equal(result.ok, false);
  assert.ok(result.regressions.includes('critical: 1 > 0'));
});

test('fails on a new advisory identity even when severity counts do not rise', () => {
  const result = evaluateAudit('backend-full', {
    ...baseline,
    findings: [findingFingerprint('known-package', { nodes: ['node_modules/known-package'], via: ['GHSA-known'] })],
  }, report(baseline, {
    'known-package': { severity: 'high', nodes: ['node_modules/known-package'], via: ['GHSA-known'] },
    'new-advisory': { severity: 'high', nodes: ['node_modules/new-advisory'], via: ['GHSA-new'] },
  }));

  assert.equal(result.ok, false);
  assert.ok(result.regressions.some((regression) => regression.includes('new finding: new-advisory')));
});

test('fails closed when npm audit output has no vulnerability metadata', () => {
  const result = evaluateAudit('backend-full', baseline, { error: { code: 'ENOTFOUND' } });

  assert.equal(result.ok, false);
  assert.match(result.regressions[0], /missing metadata/);
});

test('fails closed when the documented advisory fingerprint baseline is missing', () => {
  const result = evaluateAudit('backend-full', {
    critical: 0,
    high: 4,
    moderate: 2,
    low: 1,
  }, report(baseline));

  assert.equal(result.ok, false);
  assert.ok(result.regressions.includes('missing documented finding fingerprints'));
});
