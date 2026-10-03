# Codex Execution Protocol

## Purpose
This protocol turns Codex and other agents into bounded executors inside the DistriTools JL control plane. The orchestrator owns sequencing, validation, merge authority, state transitions, user-impact review, and production readiness. Executors do not redefine scope.

## Roles per execution
- Orchestrator: selects the execution, freezes acceptance criteria, validates evidence, updates STATE.json, decides PR/merge/rollback, and records user impact.
- Executor: implements only the assigned branch/scope and stops on hard-stop conditions.
- Test subagent: reproduces defects and runs targeted + required gates independently from implementation reasoning.
- Security subagent: checks dependency/security deltas, secrets, auth/RBAC/readiness and fail-closed semantics.
- Reviewer/challenger: searches for regressions, missing edge cases, architectural leakage, accidental scope growth, and user-facing negative impact.
- UX/browser subagent: mandatory for admin/storefront visual or interaction changes; collects browser/click evidence.

One agent may perform multiple roles only when the execution record says so. Evidence must still be separated by role.

## Execution state machine
PLANNED -> BASELINED -> IMPLEMENTING -> TARGETED_GREEN -> FULL_GATE_GREEN -> SECURITY_GREEN -> USER_IMPACT_REVIEWED -> READY_FOR_PR -> PR_VALIDATED -> MERGED -> CLOSED.

Any failing gate returns the run to IMPLEMENTING. Provider ambiguity uses BLOCKED_PROVIDER. Missing business policy uses BLOCKED_DECISION. Architecture debt that does not invalidate behavior uses DEBT_DETECTED.

## Mandatory context pack
Before coding, read only:
1. AGENTS.md
2. docs/orchestration/STATE.json
3. docs/orchestration/EXECUTION_PLAN.md section for the assigned EX
4. the matching docs/orchestration/runs/EX-xx*.md file
5. git diff / targeted source files required by the execution

Do not re-audit the whole repository unless the orchestrator explicitly assigns an audit execution.

## Executor loop
1. Baseline: branch, HEAD, origin/main, clean tree, relevant audit/tests.
2. Reproduce: prove the defect/debt or capture the dependency/provider state.
3. Implement: smallest coherent change.
4. Targeted gate: test the exact defect or migration.
5. Reviewer loop: inspect diff and challenge assumptions.
6. Full relevant gate: run the matrix sections assigned to the execution.
7. Security loop: gitleaks, audit/security checks, fail-closed review.
8. User-impact loop: API/UI/operator/customer impact and rollback.
9. Evidence: update run record with exact commands/results.
10. Stop before merge; orchestrator validates and transitions state.

## Hard stops
Stop immediately and report without hiding the failure when any of these occurs:
- new CRITICAL/HIGH security regression caused by the change
- destructive/non-test database target ambiguity
- production credential or provider ambiguity
- migration/data-loss risk without rollback/forward-fix plan
- auth/RBAC/audit/readiness bypass
- unexpected API/user-visible behavior outside assigned scope
- merge conflict or branch base drift
- requirement to use force-push, history rewrite, npm audit fix --force, or broad suppressions

## Branch and PR rules
- Branch from current origin/main.
- One execution/sub-run per branch.
- No direct main writes for product/security work.
- No force-push unless orchestrator explicitly authorizes recovery.
- PR body must include scope, before/after evidence, gates, user impact, rollback, and exact remaining blockers.
- Merge only after orchestrator independent validation.
- After merge: update STATE.json canonical_sha, completed/current execution, security/provider counters, next_action, and USER_IMPACT_LOG.md when applicable.

## Validation ownership
The executor may report PASS, but the orchestrator independently verifies mergeability, branch/base relation, critical evidence, and canonical SHA. Production readiness requires the full VALIDATION_MATRIX.md, not executor confidence.

## User-impact contract
Every execution classifies impact as:
- NONE_EXPECTED
- API_CONTRACT
- ADMIN_OPERATOR
- STOREFRONT_CUSTOMER
- AUTH_SECURITY
- CHECKOUT_PAYMENT
- INVENTORY_ORDER
- SHIPPING_PROVIDER
- NOTIFICATION
- REPORT_EXPORT

Any non-NONE impact must be written to USER_IMPACT_LOG.md with negative-risk review and rollback.

## Remote execution policy
Remote Desktop/terminal control may be used to inspect, run tests, capture browser evidence, or execute bounded commands on the authorized machine. Never overwrite unrelated dirty work. Prefer isolated branches/worktrees. Destructive commands require proven test targets and explicit execution scope.

## Provider policy
Mocks remain local/test only. Real payment, email, WhatsApp, 99 Envíos or other provider calls require explicit sandbox/production authorization, secret-safe configuration, idempotency/retry/error mapping, and readiness integration. A mock success is never production evidence.

## Token/context efficiency
STATE.json is the machine-readable checkpoint. Every completed sub-run must make STATE.json sufficient to answer: where are we, what passed, what is blocked, what is active, and what is next. Long raw logs stay in artifacts/tmp; run records keep concise evidence and pointers.

## Completion rule
The system is not production-ready until EX-12 closes with no unresolved P0, no BLOCKED_PROVIDER required for launch scope, required CI gates green on the exact release SHA, and rollback/observability/provider evidence complete.
