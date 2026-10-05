# EX-02 — CI Governance: Local Handoff

## Status

**REMOTE_VALIDATION_IN_PROGRESS — NOT FINAL**. This handoff does not declare EX-02 complete. GitHub Actions checks and branch-protection verification remain required; no merge is authorized.

## Baseline

- Branch: `ci/enterprise-release-gates-2026-10`
- Base at start: `origin/main` / `HEAD` `601bd3ef2bc04a3f85adf393f671fb41daf4a0ec`
- Initial worktree: clean
- Existing developer `distritoolsjl-postgres` and Redis services on ports 55440/56379 were left running and untouched.
- Audits used as authoritative EX-01.4 evidence: `/tmp/ex014-after-batch2.json`, `/tmp/ex014-runtime-after-safe.json`, `/tmp/ex013-fresh-audit.json`, `/tmp/ex013-fresh-runtime-audit.json`.

## Implementation

- Added `.github/workflows/ci.yml` with seven stable jobs: `backend-quality`, `backend-unit-security`, `frontend-quality`, `critical-integration`, `secret-scan`, `dependency-security`, and `production-readiness-guard`.
- Pinned GitHub actions by immutable commit SHA; workflow permission is `contents: read` only. No deployment or real external-provider credentials/calls are configured.
- Critical tests use ephemeral Postgres 16 / Redis 7, a test-only database, test-only credentials, explicit environment validation, Prisma generation/migrations, and a retained test log artifact.
- Added CI-context/test-target guard, production configuration policy guard (including 2FA encryption/challenge secrets and known Wompi/PayU credential requirements), and dependency audit regression/fingerprint gate with tests.
- Added documented audit baseline with exact known finding fingerprints; findings remain visible in logs/artifacts rather than suppressed.
- Added a fixture identity assertion in `tests/critical/99envios-shipping.e2e.test.ts` so the authenticated actor must match the seeded admin before the shipment FK path is exercised.
- Added `docs/orchestration/CI_GOVERNANCE.md` describing required check names, security constraints, known audit baseline, and orchestrator-owned branch protection.

## Audit evidence

The EX-01.4 backend audit baseline is `0 critical / 4 high / 2 moderate / 1 low`; backend runtime is `0 / 4 / 2 / 0`. Frontend full is `0 / 5 / 0 / 0`; frontend runtime is `0 / 0 / 0 / 0`. `dependency-security-gate.js` passed against all four supplied fresh audit artifacts and printed package/path/severity details. The known Prisma HIGH chain, Swagger/js-yaml MODERATE, esbuild LOW, and frontend tooling HIGH findings remain open and are not represented as fixed.

## Gate results

| Gate | Result | Evidence |
| --- | --- | --- |
| Workflow YAML/schema | PASS | `actionlint .github/workflows/ci.yml` |
| Guard/helper tests | PASS | `node --test scripts/ci/tests/*.test.js`, 22/22 |
| Backend Prisma validation | PASS | `npm run prisma:validate` |
| Backend typecheck | PASS | `npm run typecheck` |
| Backend lint | PASS | `npm run lint` |
| Backend build | PASS | `npm run build` |
| Backend unit/security | PASS | 26/26 across 9 suites |
| Frontend typecheck | PASS | `cd frontend && npm run typecheck` |
| Frontend lint | PASS | `cd frontend && npm run lint`; 13 existing warnings, 0 errors |
| Frontend tests | PASS | `cd frontend && npm test`, 61/61 across 10 files |
| Frontend production build | PASS | `cd frontend && npm run build`; configured with reserved `.invalid` URLs |
| Critical integration | PASS | `npm run test:critical` against disposable Postgres 16 / Redis 7, with no global `SHIPPING_PROVIDER`; 14 files / 83 tests. The provider-none assertion passes. |
| Dependency regression | PASS | Gate passed all four supplied current full/runtime audit JSON files |
| Test target guard | PASS | Guard requires CI context, test mode, test-named local PostgreSQL, rejects remote hosts/shared dev ports, and restricts default service ports to CI |
| Production mock/readiness policy | PASS | Requires explicit production readiness/auth state, strong JWT/2FA values, documented logistics configuration, and known payment credentials when online payments are enabled; tests unsafe configs and local mocks |
| Gitleaks history | PASS | `gitleaks git --redact .`, 77 commits scanned, no leaks |
| Gitleaks source | PASS | `gitleaks dir --redact .` in a clean versioned-source mirror containing the current changes; exact fixture fingerprint only, no leaks. Untracked local credentials/artifacts were not scanned or suppressed. |
| Diff whitespace | PASS | `git diff --check` |
| Independent reviewer | PASS | Read-only reviewer/challenger found no remaining blocking local-diff findings; GitHub checks and branch protection are outside local review |
| GitHub Actions on PR SHA | FAIL / REMEDIATION READY | Orchestrator reports 5/7 checks pass; `critical-integration` and `secret-scan` are the two remaining checks. This local correction is not yet pushed or remotely re-run. |
| Main branch protection | NOT_TESTED | Orchestrator-owned after checks exist remotely |

The first critical-integration failure was diagnosed: `ADMIN_AUTH_DISABLED=true` enabled the dev-admin bypass, which replaced the authenticated actor with a non-persisted UUID and caused the shipment creator foreign-key rejection. Keeping `ADMIN_AUTH_DISABLED=false` is intentional and validates normal auth/RBAC. A later, separate remote failure expected `provider='none'` but received `internal` because the job environment and generated `.env.test` both forced `SHIPPING_PROVIDER=internal`. This correction removes those two provider defaults while retaining `AUTO_SHIPPING_MODE=disabled`, so individual tests alone choose an explicit provider. No assertions or product-source code are changed.

## Security and user impact

- User-facing impact: `NONE_EXPECTED`; no product/business implementation changed.
- CI uses least privilege and no actual provider credentials. Secret values are not printed by new guards.
- The CI dependency baseline intentionally allows only the currently documented audit identities/counts; a new identity fails even if aggregate count remains unchanged.
- Test-environment guard rejects non-loopback database/Redis targets; only CI-owned service containers are used by the critical job.
- Rollback: remove the workflow, `scripts/ci/`, baseline, test identity assertion, and EX-02 documentation/state/user-impact entry as one change set; product runtime is unchanged.

## Outstanding ownership

- Orchestrator: independently review local diff/evidence, publish branch/open PR, verify seven checks on exact PR SHA, enable required checks and direct-update/force-push protections on `main`, and advance STATE after merge.
- Known dependency remediation remains owned by its separate approved Prisma compatibility and Swagger major-upgrade tracks; EX-02 does not modify dependency versions.

## Independent orchestrator local audit
- Canonical base freshly verified at 601bd3ef2bc04a3f85adf393f671fb41daf4a0ec before commit.
- actionlint PASS.
- CI guard/helper tests 22/22 PASS.
- Backend Prisma validate/typecheck/lint/build and unit-security 26/26 PASS.
- Frontend typecheck/lint/tests/build PASS; tests 61/61, lint 0 errors / 13 known warnings.
- Full critical suite independently rerun: 14 files / 83 tests PASS.
- Fresh dependency audits for backend/frontend full+runtime matched documented count ceilings and finding fingerprints.
- git diff --check and Gitleaks diff PASS.
- Local audit result: READY_FOR_PR. Remote GitHub checks and main branch protection remain required.

## Remote bootstrap diagnostic
- GitHub Actions repository setting: enabled; allowed_actions=all.
- Default-branch workflow registry before EX-02 merge: 0 workflows.
- Introduction PR head before bootstrap: 0 workflow runs and 0 check-runs.
- Conclusion: the first workflow cannot satisfy its own pull_request remote gate before it exists on main.
- Approved one-time sequence: bootstrap-merge the independently audited introduction PR; create a follow-up validation PR; require all seven checks green on its exact SHA; configure branch protection; close EX-02 only after those remote gates pass.

## Bootstrap remote findings and corrections
- Bootstrap push run `37333247826` registered all seven jobs. Five passed on the first remote attempt; `secret-scan` and `critical-integration` failed.
- `secret-scan` root cause: Gitleaks v8.28.0 declares Go module path `github.com/zricethezav/gitleaks/v8`; the bootstrap workflow used the renamed GitHub organization path. Corrected the install path without changing the pinned version.
- `critical-integration` root cause: CI set `APP_ENV=test` and `ADMIN_AUTH_DISABLED=true`, which activates the dev-admin bypass. `JwtAuthGuard` then replaces the authenticated request actor with an ephemeral bypass user whose UUID is not persisted in `users`; shipment creation correctly rejects that UUID via `shipments_created_by_id_fkey`.
- Root cause reproduced locally A/B: bypass=true reproduced the FK/P2023 failure; bypass=false passed the 99 Envios shipping suite 4/4. CI now sets `ADMIN_AUTH_DISABLED=false`, so critical integration validates real authentication/RBAC rather than bypass behavior.
- These corrections are workflow/test-environment fixes only; no product runtime code was changed.

- PR validation run exposed one `secret-scan` false positive: `gitleaks git` passed, while `gitleaks dir` reported the already-reviewed test-only `TWO_FACTOR_ENCRYPTION_KEY` fixture in `docker-compose.test.yml`. The ignore file contains only its exact dir-scan fingerprint (`docker-compose.test.yml:generic-api-key:48`) alongside the existing commit-specific fingerprint; no path/rule-wide allowlist was added.
- The critical suite's canonical count is 14 files / 83 tests. Do not mark EX-02 final until both remaining GitHub checks pass on the current PR revision and the orchestrator closes the remote gates.

## EX-02 remote correction continuation — 2026-10-05
- Current executor branch/HEAD: `ci/validate-release-gates-2026-10` / `5e36d88d57a96fa7b778c89187a4fa4d585b955a`; no commit, push, or merge performed.
- The remote FK/UUID failure was not transient: `ADMIN_AUTH_DISABLED=true` enabled dev-admin bypass and supplied an actor UUID absent from persisted users. Keep `ADMIN_AUTH_DISABLED=false` in job env and generated `.env.test`.
- The later critical-integration failure is distinct: workflow job env and generated `.env.test` globally set `SHIPPING_PROVIDER=internal`, changing the test that expects provider `none`. Both global defaults are removed; `AUTO_SHIPPING_MODE=disabled` remains. Tests requiring a provider configure it locally; the no-provider test receives no global provider override. Assertions and product code are unchanged.
- Local rerun evidence: `actionlint` v1.7.7 PASS; CI helper tests 22/22 PASS; `npm run test:critical` PASS, 14 files / 83 tests, using isolated Postgres 16 / Redis 7; Gitleaks v8.28.0 history scan PASS (82 commits); Gitleaks source-dir scan PASS on versioned checkout mirror plus current edits; `git diff --check` PASS.
- The first dir scan of the broad developer workspace encountered ignored local artifacts outside the PR source (including local credential files). They were not changed or allowlisted; the final source scan used only tracked checkout contents plus the three changed files, matching CI checkout scope.
- Remote status remains 5/7 checks PASS until the orchestrator publishes this revision and observes `critical-integration` and `secret-scan` pass on the PR SHA. EX-02 remains open; no final status is declared here.
