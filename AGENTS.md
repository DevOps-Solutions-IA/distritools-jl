# DistriTools JL — Agent Operating Contract

## Source of truth
- Canonical repository: DevOps-Solutions-IA/distritools-jl.
- Canonical branch: main.
- Never treat old audits, prompts, screenshots, or duplicated specs as current state without revalidation.
- Read docs/orchestration/STATE.json first. Then read only the execution file(s) relevant to the assigned run.
- For Codex/subagent execution mechanics, read docs/orchestration/CODEX_EXECUTION_PROTOCOL.md.
- `validated_product_sha` in STATE.json is the latest independently validated product/security merge. It must be an ancestor of current main; it is not expected to equal the commit containing STATE.json.

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
11. After a validated product/security merge, record that merge SHA as `validated_product_sha` and update current/completed execution, counters, next_action and user impact. Read live HEAD/origin/main from Git rather than trying to store the self-referential STATE commit SHA.

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

## Lifecycle recovery and accountable closure
- Every execution and local implementation must have an owner, exit condition, preservation location and next action in STATE.json `closure_obligations`. A draft also needs a disposition and follow-up owner; retained debt/providers keep named dependencies.
- Preserve abandoned-session handoffs and dirty work before assigning a successor; active executor leases cannot be overridden. Preserve historical failures and distinguish local QA, GitHub integration and production readiness.
- Follow CODEX_EXECUTION_PROTOCOL stages. Detailed ROOT-02 milestones are evidence requirements within those stages, not a replacement state machine. Never skip merge approval, exact-head CI, independent acceptance or documentary state transition.
- PR evidence must be reproducible and tied to the full authorized diff and exact SHA. An implementer cannot independently accept their own change.
- Cleanup requires an exact-path approved manifest and recoverability verification; merged history alone does not prove dirty worktrees disposable. ROOT-02 grants no deletion authority.
- Run the orchestration lifecycle metadata gate with a verified integration base. It rejects missing ownership, removed obligations and invalid closure transitions; it does not certify external evidence or grant production readiness.
