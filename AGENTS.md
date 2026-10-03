# DistriTools JL — Agent Operating Contract

## Source of truth
- Canonical repository: DevOps-Solutions-IA/distritools-jl.
- Canonical branch: main.
- Never treat old audits, prompts, screenshots, or duplicated specs as current state without revalidation.
- Read docs/orchestration/STATE.json first. Then read only the execution file(s) relevant to the assigned run.
- For Codex/subagent execution mechanics, read docs/orchestration/CODEX_EXECUTION_PROTOCOL.md.

## Roles
- Orchestrator: owns sequencing, acceptance criteria, state transitions, validation, user-impact review, PR/merge decisions, and provider readiness.
- Executor agent (Codex or other): changes only the assigned scope on the assigned branch. It must not merge, force-push, widen scope, suppress security findings, or reinterpret acceptance criteria.
- Reviewer/subagent: may inspect, test, compare, or challenge a proposed change but must not mutate canonical state unless explicitly assigned as executor.

## Mandatory workflow
1. Confirm branch, HEAD, upstream and clean tree.
2. Read docs/orchestration/STATE.json and the assigned execution entry.
3. Record baseline evidence before modifications.
4. Make the smallest coherent change.
5. Run all gates listed for that execution.
6. Record user-facing impact, including regressions or behavior changes.
7. Stop on any unexpected HIGH/CRITICAL security regression, data-loss risk, provider ambiguity, or destructive migration.
8. Present diff, evidence, remaining blockers, and rollback path.
9. No commit/push unless the execution explicitly authorizes it.
10. No merge to main without orchestrator approval.
11. After merge, STATE.json must be synchronized to the exact canonical SHA before starting the next execution.

## Hard prohibitions
- No npm audit fix --force.
- No destructive Git history rewrite unless explicitly authorized.
- No production credentials in code, docs, issues, logs, prompts, or screenshots.
- No real payment, email, WhatsApp, shipping, or provider calls without explicit sandbox/production authorization.
- No broad refactor mixed with security/provider fixes.
- No disabling tests, guards, RBAC, audit, readiness, or fail-closed behavior to make a gate pass.
- No overwriting unrelated dirty worktrees; use an isolated branch/worktree or stop and report.

## Evidence labels
Use exactly: PASS, FAIL, BLOCKED_PROVIDER, BLOCKED_DECISION, USER_OBSERVED, NOT_TESTED, DEBT_DETECTED.

## User-impact requirement
Every execution that changes API responses, admin behavior, storefront behavior, auth, checkout, inventory, payment, shipping, notification, or reports must update docs/orchestration/USER_IMPACT_LOG.md.

## Context efficiency
Do not re-audit the whole repository. Use docs/orchestration/STATE.json, git diff, targeted source files, the current execution record, and scripts/orchestration-context.js. Expand scope only when evidence proves it is necessary.
