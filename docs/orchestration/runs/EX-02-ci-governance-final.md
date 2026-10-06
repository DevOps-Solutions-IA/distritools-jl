# EX-02 — CI Governance: Local Handoff

## Status

**PASS / MERGED WITH PROVIDER GOVERNANCE BLOCKER**. All seven CI checks passed on the exact PR head and PR #14 was merged. GitHub branch protection/rulesets cannot be enabled for this private repository on the current provider plan; this external governance obligation remains open and release-blocking unless the plan is upgraded or an explicit risk acceptance is recorded.

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
| Critical integration | LOCAL PASS / REMOTE RERUN REQUIRED | Full suite `npm run test:critical` passed 14 files / 83 tests with isolated Postgres 16 / Redis 7 and `connection_limit=20`. PR run `37352851034` used a runner-derived pool of 3 and failed stress cases; this local-only correction still needs a new PR run. |
| Dependency regression | PASS | Gate passed all four supplied current full/runtime audit JSON files |
| Test target guard | PASS | Guard requires CI context, test mode, test-named local PostgreSQL, rejects remote hosts/shared dev ports, and restricts default service ports to CI |
| Production mock/readiness policy | PASS | Requires explicit production readiness/auth state, strong JWT/2FA values, documented logistics configuration, and known payment credentials when online payments are enabled; tests unsafe configs and local mocks |
| Gitleaks history | PASS | Latest `gitleaks git --redact .`, 83 commits scanned, no leaks |
| Gitleaks source | PASS | `gitleaks dir --redact .` in a clean versioned-source mirror containing the current changes; exact fixture fingerprint only, no leaks. Untracked local credentials/artifacts were not scanned or suppressed. |
| Diff whitespace | PASS | `git diff --check` |
| Independent reviewer | PASS | Read-only reviewer confirmed pool limit is scoped to `critical-integration`, preserved provider/auth semantics, and found no blocking diff or documentation issue. GitHub checks and branch protection remain separate remote gates. |
| GitHub Actions on PR SHA | PASS | Final validation run `37415300257` on exact head `b7f93a1cff48c8dd19647250a3cc8636e428f26b`: all seven stable checks PASS. |
| Main branch protection | BLOCKED_PROVIDER | Branch-protection and repository-ruleset APIs both return HTTP 403 for this private repository: provider plan upgrade required. Manual PR + 7/7 exact-head governance remains active but is not equivalent enforcement. |

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
- At that point in the history, the remote status remained 5/7; the subsequent PR run below advanced to 6/7, with only `critical-integration` failing. EX-02 remains open; no final status is declared here.
- Follow-up PR run `37352851034` (head `34e86875d9427ba497bef0309fba9ab027dd93ef`) confirms the provider correction and Gitleaks fingerprint: `secret-scan` PASS and the provider-none admin-operations assertion PASS. `critical-integration` still failed in `concurrency-stress` because Prisma's runner-derived pool was only 3 connections; logs show P2024 pool exhaustion and P2028 interactive transaction expiry, causing Scenarios A, B, and G to violate their existing expected success counts.
- Reproduction: isolated Postgres 16 / Redis 7, same critical stress file and same runner-style environment. `connection_limit=3` reproduced A/B/G failures; `connection_limit=10` still exhausted during the 10-webhook burst; `connection_limit=20` passed all 8/8 stress tests. No test assertions or runtime source were changed.
- CI-only remediation under validation: pin `connection_limit=20` in the critical job `DATABASE_URL` and generated `.env.test`, retaining the test DB, local service hosts, `ADMIN_AUTH_DISABLED=false`, no global shipping provider, and `AUTO_SHIPPING_MODE=disabled`. This caps the test pool below PostgreSQL's standard 100-connection limit while covering the suite's documented 8-order/10-webhook concurrency. Full local validation now passes at 14 files / 83 tests. The remote workflow must rerun on an authorized PR revision; EX-02 remains open.
- Current local gates after the pool correction: `actionlint` v1.7.7 PASS; `node --test scripts/ci/tests/*.test.js` 22/22 PASS; full critical suite 14 files / 83 tests PASS at `connection_limit=20`; Gitleaks git 83 commits PASS; Gitleaks source-dir PASS on the clean versioned-source mirror plus current edits; `git diff --check` PASS. No production/application source or assertions changed.

## EX-02 Stream A dependency-security continuation — 2026-10-05
- Status: `EX02_SECURITY_LOCAL_READY_FOR_AUDIT`; EX-02 remains `REMOTE_VALIDATION_IN_PROGRESS`, not closed. Branch/head at run start: `ci/validate-release-gates-2026-10` / `af4308a86e037ec59bcc69448da18a5486771897`; `origin/main` verified as `292a37912248c1ea08c2a04e3410978fec2380b5`. No commit, push, merge, STATE, or USER_IMPACT_LOG change.
- Fresh audits before changes: backend full `1 critical / 4 high / 2 moderate / 1 low`; backend runtime `1 critical / 4 high / 2 moderate / 0 low`; frontend full `0 critical / 6 high / 0 moderate / 0 low`; frontend runtime `0 critical / 1 high / 0 moderate / 0 low`. The backend CRITICAL is `proxy-addr@2.0.7` via `@nestjs/platform-express@11.2.7 -> express@5.2.1`, allowed by Express's `^2.0.7` range. The frontend HIGH is `source-map-js@1.2.1`, reachable through PostCSS under Next/Tailwind, allowed by the existing `^1.2.1` ranges.
- Lockfile-only updates, with manifests unchanged: root `package-lock.json` resolves `proxy-addr 2.0.7 -> 2.0.8`; `frontend/package-lock.json` resolves `source-map-js 1.2.1 -> 1.2.2`. npm initially moved identical OpenCollective funding metadata from `cors` to `proxy-addr`; the minimal diff preserves the original `cors` metadata and only changes proxy version, resolved URL, and integrity. Frontend npm lockfile normalization was discarded; no unrelated metadata churn remains.
- Fresh audits after changes: backend full `0 critical / 4 high / 2 moderate / 1 low`; backend runtime `0 critical / 4 high / 2 moderate / 0 low`; frontend full `0 critical / 5 high / 0 moderate / 0 low`; frontend runtime `0 critical / 0 high / 0 moderate / 0 low`. The known Prisma HIGH chain, Swagger/js-yaml MODERATE, backend esbuild LOW, and five frontend eslint-config-next tooling HIGH findings remain visible. No direct dependency or parent major changed; no override or `npm audit fix --force` used.
- Dependency-security gate: PASS for all four fresh after-audit reports against the existing exact-fingerprint baseline; gate tests 6/6 PASS. Audits and detailed JSON are in `/tmp/ex02-stream-a-{backend,frontend}-{before,after}.json` and corresponding `*-runtime-{before,after}.json` files.
- Backend: Prisma validate PASS; typecheck PASS; lint PASS; build PASS; unit/security PASS 26/26 across 9 suites. Frontend: typecheck PASS; lint PASS (13 pre-existing warnings, 0 errors); tests PASS 61/61 across 10 files; production build PASS. Build emitted the existing Node `MODULE_TYPELESS_PACKAGE_JSON` warning for `tailwind.config.ts`; no build failure.
- Critical integration: PASS 14 files / 83 tests / 0 failures using isolated, ephemeral Postgres 16 and Redis 7 on random loopback ports; test DB `distritoolsjl_test`, `connection_limit=20`. Shared developer services on 55440/56379 were left untouched. Stress scenarios A/B/G passed. The suite emitted the expected injected persistence-failure log for its failure-injection test and `MaxListenersExceededWarning` during concurrency stress; assertions passed. Raw log: `/tmp/ex02-stream-a-critical.log`.
- Gitleaks v8.28.0 history scan PASS (86 commits, no leaks); source scan PASS from a clean `git archive` mirror with the two updated lockfiles overlaid (no leaks). `git diff --check` PASS.
- Lockfile audit reviewed direct/transitive paths, installed versions, parent constraints and npm audit fix availability before editing. Remaining advisories are not changed in this bounded safe batch: Prisma 6.19.0 -> `@prisma/config` -> `deepmerge-ts`/`effect` remains upstream/compatibility blocked (npm suggests the prohibited Prisma 6.12.0 downgrade); Swagger 11.4.7 -> js-yaml moderate requires Swagger 12 major evaluation; frontend's five HIGH findings remain dev-tooling under eslint-config-next with no accepted safe parent remediation in this run. Owner: orchestrator to sequence separate Prisma compatibility, Swagger 12 and upstream frontend tooling tracks. Backend esbuild LOW was left unchanged as out of scope.
- Independent diff reviewer/challenger: **PASS**, no actionable findings; confirmed only the two in-range transitive lockfile updates, no manifest/product changes, and no unrelated funding metadata churn. User-facing impact: `NONE_EXPECTED`; lockfiles only, no runtime/source or API behavior change. Rollback: revert the two lockfile entries only; no schema/data migration required.

## Final remote closure
- Final PR validation head: `b7f93a1cff48c8dd19647250a3cc8636e428f26b`.
- Final GitHub Actions run: `37415300257`.
- Stable checks: `backend-quality`, `backend-unit-security`, `frontend-quality`, `critical-integration`, `secret-scan`, `dependency-security`, `production-readiness-guard` — **7/7 PASS**.
- PR #14 squash-merged at `0b7286eb22a17df3ab1cf276af58899b78421ef7`.
- Final independent audits after compatible transitive patches: backend full 0 critical / 4 high / 2 moderate / 1 low; backend runtime 0/4/2/0; frontend full 0/5/0/0; frontend runtime 0 vulnerabilities.
- Branch protection/rulesets: **BLOCKED_PROVIDER**, not a test failure. Both GitHub APIs return 403 with the provider plan-upgrade requirement despite admin repository permission.
- Manual fallback until capability upgrade: PR-only orchestration policy, exact-head 7/7 CI required, no force/direct main updates by the operating process.
- EX-02 repository/CI engineering work is complete; the branch-governance enforcement obligation remains open for EX-12 release governance.
