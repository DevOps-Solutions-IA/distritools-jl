# Validation Matrix

## Gate A — Git and scope
- Clean tree before execution.
- Branch created from current origin/main.
- Diff contains only assigned scope.
- git diff --check PASS.
- No force-push unless explicitly authorized for recovery.

## Gate B — Secrets and dependencies
- gitleaks git --redact PASS.
- npm audit snapshots captured for changed workspaces.
- No new CRITICAL/HIGH findings caused by the change.
- No npm audit fix --force.
- Lockfile changes reviewed and attributable.

## Gate C — Backend static
- npm run prisma:validate
- npm run typecheck
- npm run lint
- npm run build

## Gate D — Frontend static
- frontend npm run typecheck
- frontend npm run lint
- frontend npm run build

## Gate E — Tests
- Frontend unit/component/API tests.
- Backend unit tests.
- Targeted regression test for every reproduced bug.
- npm run test:critical against isolated .env.test infrastructure.
- Failure injection and concurrency scenarios for stateful write paths.

## Gate F — Data safety
- DATABASE_URL proven to point to test DB before destructive test setup.
- Migrations tested on disposable DB.
- No production data mutation in validation.
- Schema/data migration has rollback/forward-fix plan.

## Gate G — API/security contracts
- Server-side RBAC remains authoritative.
- PII masking/redaction verified.
- Public tracking contains no PII.
- Payment/shipping/notifications never report mock success as real external success.
- Readiness blocks missing providers/credentials and unsafe production configuration.

## Gate H — User impact
- docs/orchestration/USER_IMPACT_LOG.md updated for behavior/UI/API changes.
- Compatibility and rollback documented.
- Browser/click evidence required for UX/admin execution.

## Gate I — External providers
- Sandbox only unless production explicitly authorized.
- Credentials never logged or committed.
- Auth, rate limits, retries, idempotency, webhook validation, error mapping, and provider outage behavior tested.

## Gate J — Release
- Required CI checks green on exact SHA.
- Release evidence archived.
- Health/ready/metrics smoke passes.
- Known blockers resolved or release is NO-GO.
- main protected from unvalidated direct mutation.

## Gate K — Accountable lifecycle and recoverability
- Every tracked obligation has an owner, explicit exit condition, preservation location and next action in STATE.json `closure_obligations`; drafts, abandoned sessions, retained debt and provider blockers have a named follow-up.
- Run `node scripts/ci/orchestration-lifecycle-gate.js --base-ref <verified-base-commit>` and its Node tests. Required production-readiness-guard includes this structural check; the seven canonical check names are unchanged.
- Reject missing/unresolved ownership, dropped obligations, unknown/skipped transitions, incomplete blocker records, and unsupported MERGED/CLOSED metadata. New entries begin PLANNED/BASELINED. Failed premerge gates return to IMPLEMENTING; closure requires merge and documentary-transition receipts.
- Independently verify evidence references, actual exact-head checks and director approval; the metadata gate cannot validate their authenticity.
- Compare dirty/untracked content as well as commit ancestry; detect squash/cherry-pick equivalents before importing candidates. Inventory coverage does not mean semantic equivalence or QA acceptance.
- Cleanup: verify authoritative source/backup hashes and a restoration method, account for unique data and mandatory evidence, and obtain a specific exact-path director-approved deletion manifest. ROOT-02 performs no deletions.
- Preserve security baselines, provider fail-closed behavior, DRAFT / NO_PUBLICAR and production NO-GO while their existing dependencies remain unresolved.
