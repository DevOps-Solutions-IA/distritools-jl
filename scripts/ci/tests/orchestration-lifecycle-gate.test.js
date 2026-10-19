const assert = require('node:assert/strict');
const test = require('node:test');
const { validateLifecycle } = require('../orchestration-lifecycle-gate');

function obligation(overrides = {}) {
  return {
    id: 'ROOT02-DOC', owner: 'ROOT-02', stage: 'BASELINED',
    exit_condition: 'Director-approved merge and documented state transition',
    preservation_location: 'docs/orchestration/consolidation',
    next_action: 'Review evidence before opening a PR',
    ...overrides,
  };
}
function state(items) { return { closure_obligations: items }; }

test('accepts bootstrap metadata and adjacent canonical progression', () => {
  assert.deepEqual(validateLifecycle(state([obligation()]), {}), []);
  assert.deepEqual(validateLifecycle(state([obligation({ stage: 'IMPLEMENTING' })]), state([obligation()])), []);
});

test('fails closed on a missing register, malformed entries and unresolved ownership', () => {
  for (const input of [{}, state([]), state([null]), state([obligation({ owner: '' })]), state([obligation({ owner: 'TBD' })])]) {
    assert.ok(validateLifecycle(input, {}).length > 0);
  }
});

test('rejects missing exit, preservation and next-action metadata', () => {
  for (const field of ['id', 'exit_condition', 'preservation_location', 'next_action']) {
    assert.ok(validateLifecycle(state([obligation({ [field]: '' })]), {}).length > 0);
  }
});

test('rejects unknown stages, duplicate identities and disappearing obligations', () => {
  assert.ok(validateLifecycle(state([obligation({ stage: 'DONE_LOCALLY' })]), {}).length > 0);
  assert.ok(validateLifecycle(state([obligation(), obligation()]), {}).length > 0);
  assert.ok(validateLifecycle(state([obligation({ id: 'OTHER' })]), state([obligation()])).length > 0);
});

test('rejects skipping directly from baseline to closure and precompleted bootstrap records', () => {
  assert.ok(validateLifecycle(state([obligation({ stage: 'CLOSED' })]), state([obligation()])).length > 0);
  assert.ok(validateLifecycle(state([obligation({ stage: 'FULL_GATE_GREEN' })]), {}).length > 0);
});

test('allows premerge failed gates to return to implementation but preserves merged stages', () => {
  assert.deepEqual(validateLifecycle(state([obligation({ stage: 'IMPLEMENTING' })]), state([obligation({ stage: 'SECURITY_GREEN' })])), []);
  assert.ok(validateLifecycle(state([obligation({ stage: 'IMPLEMENTING' })]), state([obligation({ stage: 'MERGED' })])).length > 0);
});

test('blocked work needs reproducible evidence, dependency and named recovery ownership', () => {
  const blocker = { status: 'BLOCKED_DECISION', condition: 'Active exclusive lease', evidence: 'docs/receipt.md', owner: 'ROOT-01', next_action: 'Supply final handoff', dependency: 'ROOT-01 release', preservation_location: '/preserved/source' };
  assert.deepEqual(validateLifecycle(state([obligation({ blocker })]), {}), []);
  for (const field of ['condition', 'evidence', 'owner', 'next_action', 'dependency', 'preservation_location', 'status']) {
    assert.ok(validateLifecycle(state([obligation({ blocker: { ...blocker, [field]: '' } })]), {}).length > 0);
  }
});

test('merge and closure require receipts, exact-head checks and documentary transition', () => {
  const receipt = { pr: 81, head_sha: 'a'.repeat(40), merge_sha: 'b'.repeat(40), seven_exact_head_checks: 'PASS', director_approval: 'docs/director-receipt.md', independent_acceptance: 'docs/review.md', state_transition: 'docs/transition.md' };
  assert.deepEqual(validateLifecycle(state([obligation({ stage: 'CLOSED', merge_receipt: receipt })]), state([obligation({ stage: 'MERGED' })])), []);
  for (const field of Object.keys(receipt)) {
    assert.ok(validateLifecycle(state([obligation({ stage: 'CLOSED', merge_receipt: { ...receipt, [field]: '' } })]), state([obligation({ stage: 'MERGED' })])).length > 0);
  }
});

test('rejects sentinel ownership and clearing a blocker without preserved disposition', () => {
  for (const owner of ['NONE', 'N/A', 'NULL', 'NOT_ASSIGNED']) {
    assert.ok(validateLifecycle(state([obligation({ owner })]), {}).length > 0);
  }
  const before = obligation({ blocker: { status: 'BLOCKED_PROVIDER', condition: 'No sandbox approval', evidence: 'docs/blocker.md', owner: 'Provider operator', next_action: 'Obtain approval', dependency: 'Sandbox authorization', preservation_location: '/preserved/provider' } });
  assert.ok(validateLifecycle(state([obligation()]), state([before])).length > 0);
  const resolution = { owner: 'Director', evidence: 'docs/approval.md', disposition: 'Sandbox-only scope approved; production still blocked', next_action: 'Run independently assigned sandbox validation' };
  assert.deepEqual(validateLifecycle(state([obligation({ blocker_resolution: resolution })]), state([before])), []);
  for (const field of Object.keys(resolution)) {
    assert.ok(validateLifecycle(state([obligation({ blocker_resolution: { ...resolution, [field]: '' } })]), state([before])).length > 0);
  }
});

test('allows evidence-backed contiguous multi-stage progress in one PR', () => {
  const stage_history = [
    { stage: 'IMPLEMENTING', owner: 'Executor', evidence: 'docs/diff.md' },
    { stage: 'TARGETED_GREEN', owner: 'QA', evidence: 'docs/targeted.md' },
    { stage: 'FULL_GATE_GREEN', owner: 'QA', evidence: 'docs/full.md' },
  ];
  assert.deepEqual(validateLifecycle(state([obligation({ stage: 'FULL_GATE_GREEN', stage_history })]), state([obligation()])), []);
  for (const history of [stage_history.slice(1), stage_history.slice(0, 2), [...stage_history, stage_history[2]], [stage_history[0], { ...stage_history[1], owner: 'NONE' }, stage_history[2]], [stage_history[0], { ...stage_history[1], evidence: '' }, stage_history[2]], 'malformed']) {
    assert.ok(validateLifecycle(state([obligation({ stage: 'FULL_GATE_GREEN', stage_history: history })]), state([obligation()])).length > 0);
  }
});

test('retains history prefixes and validates histories even without a stage change', () => {
  const entry = { stage: 'IMPLEMENTING', owner: 'Executor', evidence: 'docs/diff.md' };
  const prior = obligation({ stage: 'IMPLEMENTING', stage_history: [entry] });
  const next = obligation({ stage: 'TARGETED_GREEN', stage_history: [entry, { stage: 'TARGETED_GREEN', owner: 'QA', evidence: 'docs/targeted.md' }] });
  assert.deepEqual(validateLifecycle(state([next]), state([prior])), []);
  assert.ok(validateLifecycle(state([{ ...next, stage_history: [{ ...entry, evidence: 'rewritten' }, next.stage_history[1]] }]), state([prior])).length > 0);
  assert.ok(validateLifecycle(state([obligation({ stage: 'IMPLEMENTING' })]), state([prior])).length > 0);
  assert.ok(validateLifecycle(state([obligation({ stage_history: [{ stage: 'CLOSED', owner: 'Executor', evidence: 'claimed' }] })]), state([obligation()])).length > 0);
});
