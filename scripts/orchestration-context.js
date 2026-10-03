const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const statePath = path.join(root, 'docs', 'orchestration', 'STATE.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

const output = {
  project: state.project,
  canonical_branch: state.canonical_branch,
  recorded_canonical_sha: state.canonical_sha,
  current_branch: git('branch', '--show-current'),
  current_head: git('rev-parse', 'HEAD'),
  origin_main: git('rev-parse', 'origin/main'),
  tree_clean: git('status', '--porcelain') === '',
  phase: state.phase,
  active_execution: state.active_execution,
  completed_executions: state.completed_executions,
  next_action: state.next_action,
  known_p0: state.known_p0,
  provider_status: state.provider_status,
};

process.stdout.write(JSON.stringify(output, null, 2) + '\n');
