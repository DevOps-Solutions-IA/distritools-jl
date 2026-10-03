const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const statePath = path.join(root, 'docs', 'orchestration', 'STATE.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function gitOk(...args) {
  try {
    execFileSync('git', args, { cwd: root, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const currentHead = git('rev-parse', 'HEAD');
const originMain = git('rev-parse', 'origin/main');
const validatedSha = state.validated_product_sha;

const output = {
  project: state.project,
  canonical_branch: state.canonical_branch,
  validated_product_sha: validatedSha,
  validated_sha_is_ancestor_of_head: gitOk('merge-base', '--is-ancestor', validatedSha, currentHead),
  validated_sha_is_ancestor_of_origin_main: gitOk('merge-base', '--is-ancestor', validatedSha, originMain),
  state_base_sha: state.state_base_sha,
  current_branch: git('branch', '--show-current'),
  current_head: currentHead,
  origin_main: originMain,
  tree_clean: git('status', '--porcelain') === '',
  phase: state.phase,
  active_execution: state.active_execution,
  completed_executions: state.completed_executions,
  next_action: state.next_action,
  known_p0: state.known_p0,
  provider_status: state.provider_status,
};

process.stdout.write(JSON.stringify(output, null, 2) + '\n');
