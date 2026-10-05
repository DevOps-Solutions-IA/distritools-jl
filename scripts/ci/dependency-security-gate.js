#!/usr/bin/env node
'use strict';

const fs = require('node:fs');

const SEVERITIES = ['critical', 'high', 'moderate', 'low'];

function normalizeCounts(metadata) {
  if (!metadata || typeof metadata !== 'object') return null;
  const normalized = {};
  for (const severity of SEVERITIES) {
    const count = metadata[severity];
    if (!Number.isInteger(count) || count < 0) return null;
    normalized[severity] = count;
  }
  return normalized;
}

function findingFingerprint(name, vulnerability) {
  const nodes = Array.isArray(vulnerability?.nodes) ? [...vulnerability.nodes].sort() : [];
  const via = Array.isArray(vulnerability?.via)
    ? vulnerability.via.map((item) => typeof item === 'string'
      ? `dep:${item}`
      : `advisory:${item.url ?? `${item.name ?? 'unknown'}:${item.range ?? ''}`}`).sort()
    : [];
  return `${name}|${nodes.join(',')}|${via.join(',')}`;
}

function summarizeFindings(vulnerabilities) {
  if (!vulnerabilities || typeof vulnerabilities !== 'object' || Array.isArray(vulnerabilities)) return [];
  return Object.entries(vulnerabilities).map(([name, vulnerability]) => ({
    name,
    severity: vulnerability?.severity ?? 'unknown',
    isDirect: Boolean(vulnerability?.isDirect),
    nodes: Array.isArray(vulnerability?.nodes) ? vulnerability.nodes : [],
    via: Array.isArray(vulnerability?.via)
      ? vulnerability.via.map((item) => typeof item === 'string' ? item : `${item.name ?? 'advisory'}: ${item.title ?? item.url ?? 'details in audit artifact'}`)
      : [],
  })).sort((left, right) => left.severity.localeCompare(right.severity) || left.name.localeCompare(right.name));
}

function evaluateAudit(profile, baseline, report) {
  const actual = normalizeCounts(report?.metadata?.vulnerabilities);
  if (!actual) {
    return { ok: false, profile, counts: null, regressions: ['missing metadata.vulnerabilities; audit output is invalid or registry request failed'], findings: summarizeFindings(report?.vulnerabilities) };
  }

  const regressions = [];
  if (!Array.isArray(baseline.findings)
      || baseline.findings.some((fingerprint) => typeof fingerprint !== 'string' || fingerprint.length === 0)
      || new Set(baseline.findings).size !== baseline.findings.length
      || (SEVERITIES.reduce((total, severity) => total + (baseline[severity] ?? 0), 0) > 0 && baseline.findings.length === 0)) {
    regressions.push('missing documented finding fingerprints');
  }
  for (const severity of SEVERITIES) {
    if (!Number.isInteger(baseline?.[severity]) || baseline[severity] < 0) {
      regressions.push(`invalid documented baseline for ${severity}`);
    } else if (actual[severity] > baseline[severity]) {
      regressions.push(`${severity}: ${actual[severity]} > ${baseline[severity]}`);
    }
  }

  const findings = summarizeFindings(report.vulnerabilities);
  if (Array.isArray(baseline.findings)) {
    const knownFindings = new Set(baseline.findings);
    for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
      const fingerprint = findingFingerprint(name, vulnerability);
      if (!knownFindings.has(fingerprint)) regressions.push(`new finding: ${name} (${vulnerability?.severity ?? 'unknown'}): ${fingerprint}`);
    }
  }

  return { ok: regressions.length === 0, profile, counts: actual, regressions, findings };
}

function parseArguments(argv) {
  let baselinePath;
  const auditFiles = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--baseline') baselinePath = argv[++index];
    else if (argv[index] === '--audit') auditFiles.push(argv[++index]);
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (!baselinePath || auditFiles.length === 0) throw new Error('Usage: dependency-security-gate.js --baseline FILE --audit PROFILE=FILE [--audit PROFILE=FILE ...]');
  return { baselinePath, auditFiles };
}

function main(argv) {
  const { baselinePath, auditFiles } = parseArguments(argv);
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  let failed = false;

  for (const entry of auditFiles) {
    const separator = entry.indexOf('=');
    if (separator < 1) throw new Error(`Audit argument must be PROFILE=FILE: ${entry}`);
    const profile = entry.slice(0, separator);
    const file = entry.slice(separator + 1);
    const profileBaseline = baseline.profiles?.[profile];
    if (!profileBaseline) throw new Error(`No documented baseline exists for profile ${profile}`);
    const result = evaluateAudit(profile, profileBaseline, JSON.parse(fs.readFileSync(file, 'utf8')));
    console.log(`${result.ok ? 'PASS' : 'FAIL'} ${profile}: ${result.counts ? SEVERITIES.map((severity) => `${severity}=${result.counts[severity]}/${profileBaseline[severity]}`).join(' ') : result.regressions[0]}`);
    for (const finding of result.findings) {
      console.log(`  ${finding.severity} ${finding.name}${finding.isDirect ? ' (direct)' : ' (transitive)'}; nodes=${finding.nodes.join(', ') || 'not supplied'}; via=${finding.via.join(' | ') || 'not supplied'}`);
    }
    for (const regression of result.regressions) console.error(`  ${regression}`);
    failed ||= !result.ok;
  }

  return failed ? 1 : 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

module.exports = { evaluateAudit, findingFingerprint, summarizeFindings };
