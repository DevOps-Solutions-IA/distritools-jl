const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

// These are the existing CODEX_EXECUTION_PROTOCOL stages, not a second state machine.
const stages = ['PLANNED', 'BASELINED', 'IMPLEMENTING', 'TARGETED_GREEN', 'FULL_GATE_GREEN',
  'SECURITY_GREEN', 'USER_IMPACT_REVIEWED', 'READY_FOR_PR', 'PR_VALIDATED', 'MERGED', 'CLOSED'];
const metadata = ['id', 'owner', 'exit_condition', 'preservation_location', 'next_action'];
const defined = (value) => typeof value === 'string' && value.trim().length > 0
  && !/^(TBD|TODO|UNKNOWN|UNASSIGNED|PENDING|NONE|N\/A|NULL|NOT_ASSIGNED)$/i.test(value.trim());
const sha = (value) => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);

function validateLifecycle(current, previous) {
  const failures = [];
  const items = current?.closure_obligations;
  if (!Array.isArray(items) || items.length === 0) return ['closure_obligations must be a nonempty array'];
  const oldItems = previous?.closure_obligations;
  if (oldItems !== undefined && !Array.isArray(oldItems)) return ['base closure_obligations must be an array'];
  const old = new Map((oldItems || []).filter(Boolean).map((item) => [item.id, item]));
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      failures.push('closure obligation must be an object');
      continue;
    }
    for (const key of metadata) if (!defined(item[key])) failures.push(`${item.id || 'obligation'}: missing ${key}`);
    if (seen.has(item.id)) failures.push(`${item.id}: duplicate identity`);
    seen.add(item.id);
    const index = stages.indexOf(item.stage);
    const prior = old.get(item.id);
    if (index < 0) failures.push(`${item.id}: unknown canonical stage`);
    const allowed = (from, to) => {
      const before = stages.indexOf(from);
      return before >= 0 && (stages.indexOf(to) === before + 1
        || (before >= 2 && before < 9 && to === 'IMPLEMENTING' && from !== to));
    };
    const history = item.stage_history;
    const previousHistory = prior?.stage_history || [];
    if (history !== undefined && !Array.isArray(history)) {
      failures.push(`${item.id}: stage_history must be an array`);
    } else if (history || previousHistory.length) {
      const entries = history || [];
      if (!Array.isArray(previousHistory) || previousHistory.length > entries.length
        || previousHistory.some((entry, offset) => JSON.stringify(entry) !== JSON.stringify(entries[offset]))) {
        failures.push(`${item.id}: stage history prefix must be preserved`);
      }
      let from = prior?.stage;
      for (let offset = 0; offset < entries.length; offset += 1) {
        const entry = entries[offset];
        if (!entry || !stages.includes(entry.stage) || !defined(entry.owner) || !defined(entry.evidence)) {
          failures.push(`${item.id}: stage history requires canonical stage, owner and evidence`);
          continue;
        }
        if (offset < previousHistory.length) continue;
        if (from === undefined) {
          if (!['PLANNED', 'BASELINED'].includes(entry.stage)) failures.push(`${item.id}: history must begin PLANNED or BASELINED`);
        } else if (!allowed(from, entry.stage)) failures.push(`${item.id}: invalid history transition`);
        from = entry.stage;
      }
      if (entries.length === 0 || entries.at(-1)?.stage !== item.stage) failures.push(`${item.id}: history must end at declared stage`);
    } else {
      if (!prior && index > 1) failures.push(`${item.id}: new obligations start PLANNED or BASELINED`);
      if (prior && prior.stage !== item.stage && !allowed(prior.stage, item.stage)) failures.push(`${item.id}: invalid stage transition`);
    }
    if (prior?.blocker && item.blocker === undefined) {
      const resolution = item.blocker_resolution || {};
      for (const key of ['owner', 'evidence', 'disposition', 'next_action']) {
        if (!defined(resolution[key])) failures.push(`${item.id}: clearing blocker requires ${key}`);
      }
    }
    if (item.blocker !== undefined) {
      const blocker = item.blocker;
      if (!blocker || typeof blocker !== 'object' || Array.isArray(blocker)) {
        failures.push(`${item.id}: blocker must be an object`);
      } else {
        if (!['FAIL', 'BLOCKED_PROVIDER', 'BLOCKED_DECISION', 'NOT_TESTED', 'DEBT_DETECTED'].includes(blocker.status)) {
          failures.push(`${item.id}: invalid blocker evidence status`);
        }
        for (const key of ['condition', 'evidence', 'owner', 'next_action', 'dependency', 'preservation_location']) {
          if (!defined(blocker[key])) failures.push(`${item.id}: blocker missing ${key}`);
        }
      }
    }
    if (index >= 9) {
      const receipt = item.merge_receipt || {};
      if (!Number.isInteger(receipt.pr) || receipt.pr < 1) failures.push(`${item.id}: merge PR required`);
      if (!sha(receipt.head_sha) || !sha(receipt.merge_sha)) failures.push(`${item.id}: exact head and merge SHAs required`);
      if (receipt.seven_exact_head_checks !== 'PASS') failures.push(`${item.id}: seven exact-head checks required`);
      for (const key of ['director_approval', 'independent_acceptance']) {
        if (!defined(receipt[key])) failures.push(`${item.id}: merge receipt missing ${key}`);
      }
      if (item.blocker) failures.push(`${item.id}: merged/closed work cannot retain an unresolved blocker`);
      if (index === 10 && !defined(receipt.state_transition)) failures.push(`${item.id}: documentary state transition required`);
    }
  }
  for (const id of old.keys()) if (!seen.has(id)) failures.push(`${id}: obligation removed; preserve its disposition`);
  return failures;
}

if (require.main === module) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--base-ref' || !args[1] || args[1].startsWith('-')) {
      throw new Error('usage: node scripts/ci/orchestration-lifecycle-gate.js --base-ref <commit>');
    }
    const root = path.resolve(__dirname, '../..');
    const statePath = 'docs/orchestration/STATE.json';
    const base = execFileSync('git', ['rev-parse', '--verify', `${args[1]}^{commit}`], { cwd: root, encoding: 'utf8' }).trim();
    const prior = JSON.parse(execFileSync('git', ['show', `${base}:${statePath}`], { cwd: root, encoding: 'utf8' }));
    const current = JSON.parse(fs.readFileSync(path.join(root, statePath), 'utf8'));
    const failures = validateLifecycle(current, prior);
    if (failures.length) throw new Error(failures.join('\n'));
    process.stdout.write(`PASS: ${current.closure_obligations.length} closure obligations; base ${base}\n`);
  } catch (error) {
    process.stderr.write(`FAIL: orchestration lifecycle metadata: ${error.message}\n`);
    process.exitCode = 1;
  }
}
module.exports = { validateLifecycle };
