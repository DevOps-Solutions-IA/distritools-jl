# EX-02 — CI, branch governance, and repeatable release gates

## Identity
- Parent program: internal-hardening
- Target branch: ci/enterprise-release-gates-2026-10
- Canonical base: current origin/main at phase start
- Executor: Codex autonomous executor
- Auditor/remote governance authority: orchestrator
- Initial state: PLANNED

## Objective
Turn the validated local quality/security process into mandatory, repeatable GitHub CI gates before architecture, event-bus, auth, checkout, and provider work continues.

## Scope
Implement repository CI/workflow code and supporting validation scripts only. Reuse existing isolated test infrastructure. Do not change product/business behavior.

Required CI surfaces:
1. backend static quality: npm ci, Prisma validate, typecheck, lint, build
2. backend unit/security tests
3. frontend npm ci, typecheck, lint, tests, build
4. critical integration suite against isolated test PostgreSQL/Redis
5. Gitleaks
6. dependency security regression gate
7. production mock/readiness guard
8. stable named required checks and evidence/artifacts

## Dependency security regression policy
Known advisories are not to be hidden or globally ignored. CI must fail on regression versus the canonical documented baseline and always fail on any new CRITICAL.
Current documented baselines:
- frontend full audit: 0 critical / 5 high / 0 moderate / 0 low; runtime audit 0 vulnerabilities
- backend full audit: 0 critical / 4 high / 2 moderate / 1 low
- backend runtime audit: 0 critical / 4 high / 2 moderate / 0 low

The gate must make known residual advisory paths visible in artifacts/output while preventing count/severity regression. Do not use npm audit fix, force, blanket ignore, or suppression to pass CI.

## Isolated integration requirements
- use `.env.test` and CI-owned test-only database/Redis services; the environment guard must reject this repository's shared developer-service ports
- never target production or developer databases
- preserve the existing test isolation guard
- no real payment/email/WhatsApp/shipping provider calls
- mocks/test providers may be used only where current critical tests already authorize them
- clean up CI-owned resources

## Workflow security
- least-privilege GitHub Actions permissions
- no secrets printed in logs
- no pull_request_target for untrusted code execution
- avoid write permissions unless strictly required
- prefer maintained official actions
- document action/version pinning choice
- no arbitrary curl-pipe-shell installers without checksum/version control

## Required local implementation loop
1. inspect existing .github/workflows and scripts; do not assume none exist
2. map every existing local validation command to a CI job/check
3. add the minimum supporting scripts needed for deterministic gates
4. lint/parse workflow YAML
5. execute supporting scripts locally where possible
6. run backend and frontend local gates after workflow/script changes
7. reviewer/challenger review for unsafe permissions, secret exposure, production DB/provider access, skipped tests, and non-deterministic commands
8. document exact check names that branch protection should require
9. update STATE.json, USER_IMPACT_LOG.md when applicable, and final evidence

## Required check contract
Choose stable check names and document them. The final set must cover:
- backend-quality
- backend-unit-security
- frontend-quality
- critical-integration
- secret-scan
- dependency-security
- production-readiness-guard

Jobs may be split internally, but the orchestrator must be able to configure branch protection against stable names.

## Hard stops
- production database/credential ambiguity
- workflow can call real external providers
- workflow needs broad repository write permissions
- any required current local test is removed/skipped/weakened
- dependency gate hides known advisories instead of baselining/regression-checking them
- critical suite cannot run deterministically in an isolated CI environment

## Validation before local handoff
- workflow YAML/schema sanity PASS
- backend Prisma validate/typecheck/lint/build PASS
- backend unit/security PASS
- frontend typecheck/lint/tests/build PASS
- critical suite PASS using isolated services
- Gitleaks PASS
- dependency-security helper PASS against current documented baseline and FAIL test against an intentionally worse fixture/input
- production readiness/mock guard PASS and FAIL test against an intentionally unsafe fixture/config
- git diff --check PASS
- no secrets in diff
- final reviewer/challenger PASS

## Remote/orchestrator-only completion
Codex does not need GitHub permission to finish local implementation.
After PHASE_LOCAL_READY_FOR_AUDIT, orchestrator will:
1. independently audit diff and local evidence
2. commit/push/open PR if needed
3. verify GitHub Actions execute on the PR
4. require all intended checks green on the exact head SHA
5. merge
6. enable/update main branch protection requiring the stable check names
7. verify direct merge is blocked by governance
8. update STATE.json and advance EX-03

## Completion contract
Codex should finish with:
PHASE_LOCAL_READY_FOR_AUDIT

Final evidence:
docs/orchestration/runs/EX-02-ci-governance-final.md

Do not merge main.
