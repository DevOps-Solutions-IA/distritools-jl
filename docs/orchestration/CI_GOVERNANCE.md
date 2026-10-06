# CI and Branch Governance

## Required status checks

After this workflow is merged and has produced checks on `main`, require these exact job names in branch protection:

- `backend-quality`
- `backend-unit-security`
- `frontend-quality`
- `critical-integration`
- `secret-scan`
- `dependency-security`
- `production-readiness-guard`

The orchestrator owns enabling protection on `main`; it cannot be configured reliably before the checks exist on GitHub. Require pull requests, block force pushes and direct updates, and do not allow administrator bypass for routine changes.

## Workflow security and repeatability

- `.github/workflows/ci.yml` runs for pull requests targeting `main`, pushes to `main`, and manual dispatch.
- Workflow-wide token permission is read-only (`contents: read`). No job writes repository state, publishes packages, deploys, or accesses provider credentials.
- Third-party actions are pinned to immutable commit SHAs: checkout v4.2.2, setup-node v4.4.0, and upload-artifact v4.6.2. `actionlint` and Gitleaks are installed from Go modules at explicit versions (1.7.7 and 8.28.0).
- Critical integration tests use ephemeral GitHub-hosted Postgres 16 and Redis 7 services and an explicitly test-named database. `scripts/ci/assert-test-environment.js` requires the CI-owned service context and fails closed on non-test mode, non-PostgreSQL/Redis URLs, remote hosts, this repository's shared developer ports (55440/56379), or a database name without a test marker. Default service ports 5432/6379 are accepted only when `CI=true`; local disposable services may use dynamically assigned ports when deliberately run in CI-compatible mode. The GitHub Actions `services` declaration is the actual lifecycle/isolation boundary; the URL guard is not an attestation mechanism for arbitrary user-managed database processes.
- The critical job writes only test-only `.env.test` values, keeps `ADMIN_AUTH_DISABLED=false`, does not impose a global shipping provider, and disables auto-shipping. Individual tests select any mock/test provider they require. No real payment, shipping, email, WhatsApp, or external provider credentials are configured.
- Gitleaks scans full Git history and the checked-out source. Security audit JSON is retained as a workflow artifact for 30 days, including known residual advisory details.
- `dependency-security` compares full and runtime npm audit results against `scripts/ci/dependency-baseline.json`. It fails when severity counts rise or when an unrecorded advisory/path appears, while printing known findings. This is a regression gate, not a claim that all known advisories are remediated.
- `production-readiness-guard` tests fail-closed configuration policy, including 2FA secrets and the currently documented Wompi/PayU credential names when online payments are enabled. It does not assert production readiness for the deployment; real provider/domain credentials remain independently blocked until authorized and configured.

## Baseline at EX-02

Source is the orchestrator-validated EX-01.4 dependency audit artifacts, with EX-01.3 frontend artifacts:

| Profile | Critical | High | Moderate | Low |
| --- | ---: | ---: | ---: | ---: |
| Backend full | 0 | 4 | 2 | 1 |
| Backend runtime | 0 | 4 | 2 | 0 |
| Frontend full | 0 | 5 | 0 | 0 |
| Frontend runtime | 0 | 0 | 0 | 0 |

Known findings remain visible: backend Prisma/deepmerge-ts/effect HIGH chain, Swagger/js-yaml MODERATE, esbuild LOW; frontend eslint-config-next/fast-glob/micromatch/braces HIGH nodes are development tooling only. No downgrade, `npm audit fix --force`, advisory ignore, or suppression is part of this policy.

## Operator workflow

For each pull request, wait for all seven stable checks on the exact head SHA. Any changed audit identity requires review and an explicit baseline update; do not update the baseline merely to make a failing run green. The orchestrator independently reviews check results and configures branch protection after merge.

## First-workflow bootstrap

Because this repository had no workflow on the default branch before EX-02, GitHub cannot produce the new pull-request checks on the same PR that introduces the first workflow. Actions was verified enabled, while the repository workflow registry and the introduction-PR head both reported zero workflow runs/checks. The one-time bootstrap procedure is therefore: independently audit the workflow locally; merge only the CI introduction PR; immediately open a validation PR from the resulting main; require all seven checks green on that exact validation head SHA; then configure main branch protection to require those exact checks and PR-based updates. This exception applies only to the first workflow bootstrap and must not be reused once CI exists on main.

## Critical authentication policy

The `critical-integration` job must run with `ADMIN_AUTH_DISABLED=false`. Critical E2E tests exercise real admin login/RBAC and must not use the local/test admin bypass. Enabling the bypass in this job is a CI configuration defect because the bypass actor is intentionally ephemeral and is not a persisted `users` row.


## EX-02 remote closure

- Validation PR #14 exact head `b7f93a1cff48c8dd19647250a3cc8636e428f26b` produced all seven stable checks successfully in workflow run `37415300257`.
- PR #14 merged to main at `0b7286eb22a17df3ab1cf276af58899b78421ef7`.
- During validation, newly published advisories for `proxy-addr<2.0.8` and `source-map-js<1.2.2` were detected by the regression gate, remediated with compatible transitive lockfile updates, and the gate returned green without changing its baseline.
- GitHub branch-protection and repository-ruleset APIs both return HTTP 403 for this private repository with the provider message requiring a plan upgrade (or public visibility). The authenticated account has repository admin permission, so this is a product-plan capability blocker, not an authorization failure.
- Until that capability is available, the operating fallback is mandatory: no direct/force updates by the orchestration process; every merge must use a PR and all seven checks must be green on the exact head SHA. This fallback does not claim technical enforcement equivalent to branch protection and remains a release governance obligation.
- GitHub Actions currently emits non-blocking warnings that the pinned action revisions target Node.js 20 and are being forced to Node.js 24, and that `ubuntu-latest` will migrate to Ubuntu 26. Track these as CI-maintenance debt; they did not fail EX-02.
