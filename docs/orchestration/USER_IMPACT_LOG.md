# User Impact Log

This file records any operator, admin, customer, storefront, API-consumer, or support impact caused by execution work.

## Required fields per entry
- Execution:
- Date:
- Surface:
- Change:
- Expected user impact:
- Negative-risk review:
- Compatibility:
- Rollback:
- Evidence:
- Status:

## Entries

### EX-00 — Canonicalization and baseline
- Date: 2026-10-03
- Surface: Repository / engineering workflow
- Change: Established GitHub canonical source of truth, secret scanning, baseline validation, audit JSON fix, and critical frontend dependency fixes.
- Expected user impact: No intended user-facing behavior change except inventory settings now reliably returns costConfigured and no longer fails when audit payload contains Prisma Decimal.
- Negative-risk review: Critical inventory suite, full critical suite, frontend tests and unit tests passed after fixes.
- Compatibility: Preserved existing API behavior; restored expected response field.
- Rollback: Revert merged PRs #1/#2 if regression is proven.
- Evidence: 52/52 frontend, 26/26 backend unit, 83/83 critical E2E, Gitleaks clean.
- Status: PASS

### EX-01.1 — Frontend safe HIGH dependency remediation
- Date: 2026-10-03
- Surface: Frontend dependency/runtime/build chain
- Change: Applied only non-forced compatible dependency updates in the lockfile.
- Expected user impact: None intended; no UI, API, routing, checkout, or admin behavior was changed.
- Negative-risk review: Framework-major migrations were excluded. Typecheck/lint/build and 52/52 frontend tests passed.
- Compatibility: Next remains 15.5.27; Vitest remains 4.1.11; package.json API surface unchanged.
- Rollback: Revert the EX-01.1 lockfile commit.
- Evidence: npm audit 15 HIGH -> 8 HIGH, critical 0, low 0; Gitleaks clean.
- Status: PASS

### EX-01.2 — Tailwind 4 migration
- Date: 2026-10-03
- Surface: Storefront/admin presentation layer
- Change: Migrated Tailwind 3 -> 4 with compatibility CSS/class adjustments intended to preserve current rendering.
- Expected user impact: No intended functional or visual change; dependency security improves by removing the Tailwind/chokidar HIGH family.
- Negative-risk review: 52/52 frontend tests, typecheck/lint/build PASS; executor Chromium checks at 390px/1440px report zero geometry differences on representative pages; orchestrator independently reran static/tests/build/audit/Gitleaks.
- Compatibility: Browser floor becomes Safari 16.4+, Chrome 111+, Firefox 128+. Older browsers are NOT_TESTED.
- Rollback: Revert EX-01.2 frontend migration files and run npm ci in frontend.
- Evidence: docs/orchestration/runs/EX-01.2-frontend-tailwind4.md and local /tmp/ex012-* artifacts.
- Status: PASS pending PR/merge.

### EX-01.3 — Next 16 migration, compatibility fixes, and security corrections
- Date: 2026-10-03
- Surface: Storefront search/catalog/cart, admin shell/auth proxy, frontend build/runtime and dependency tooling.
- Change: Next 15.5.27 -> 16.3.8, React 19.2.5, middleware -> proxy, native ESLint config, bounded lint fixes, alias-route build fixes, fail-closed dev-admin bypass shared across frontend entry points, and stale-search-result suppression during debounce.
- Expected user impact: No intended checkout, API, catalog, or order behavior change. Admin auth is stricter: bypass is accepted only for APP_ENV=local|test and NODE_ENV!=production. During live search debounce, old suggestions are hidden and “Buscando...” is shown rather than presenting results for the previous query.
- Negative-risk review: PASS typecheck; lint 0 errors / 13 warnings; frontend tests 61/61; production build; `git diff --check`; Gitleaks history/diff/source 0 leaks; focused auth/search tests 9/9. Prior browser comparisons and HTTP smoke are recorded in the EX-01.3 run report. Fresh dependency audit was rerun by the orchestrator.
- Compatibility: Next 16.3.8 / React 19.2.5. Fresh full audit: 0 critical / 5 high / 0 moderate / 0 low. Fresh runtime audit with `--omit=dev`: 0 vulnerabilities. Five HIGH advisory nodes remain only in the eslint-config-next -> fast-glob -> micromatch -> braces development-tooling chain; no safe patched braces version is currently available through npm audit and the proposed downgrade is rejected.
- Rollback: Revert the EX-01.3 merge; restore Next 15 dependency lock and middleware naming/config, then run `npm ci` and the frontend validation matrix.
- Evidence: `docs/orchestration/runs/EX-01.3-frontend-next16.md`, `docs/orchestration/runs/EX-01.3-frontend-lint.md`, fresh `/tmp/ex013-fresh-audit.json` and `/tmp/ex013-fresh-runtime-audit.json`.
- Status: PASS / MERGED via PR #9. Merge SHA `4f78b82b7a5fb0ee714e0846590ed323414b8c1f`. No negative user-facing regression observed in the audited scope.

### EX-01.4 — Backend dependency security baseline
- Date: 2026-10-05
- Surface: Backend dependency/runtime compatibility and security posture.
- Change: Applied the orchestrator-authorized compatible dependency batch: Nest platform-express 11.2.7/Multer 2.4.0, Swagger 11.4.7, BullMQ 5.81.5, Supertest 7.3.1, plus locked transitive updates for form-data, qs, and body-parser. No application source, schema, or migration changed.
- Expected user impact: NONE_EXPECTED; no intended API or product behavior change. Multipart and queue/worker paths were exercised locally.
- Negative-risk review: PASS. Fresh orchestrator audit shows 0 critical / 8 high / 4 moderate / 2 low before and 0 critical / 4 high / 2 moderate / 1 low after. Prisma/typecheck/lint/build, 26/26 unit/security tests, targeted Express/Multer+Supertest and BullMQ+Redis smoke tests, the full 14-file critical suite, Gitleaks and git diff check passed. Independent audit also proved BullMQ/msgpackr cross-version compatibility and confirmed cluster-key-slot 1.1.1 is parent-pinned by ioredis 5.11.1.
- Compatibility: Application source remains unchanged; Nest remains major 11 and Prisma remains 6.19.0. Residual Prisma HIGH chain is not fixed by a safe in-range update; npm's Prisma 6.12.0 suggestion is a downgrade and is rejected. `@nestjs/swagger` 11.4.7 retains the js-yaml moderate; proposed Swagger 12.0.2 is a major migration and is isolated. The esbuild LOW via tsx remains out of scope.
- Rollback: Revert the EX-01.4 dependency manifest/lockfile change as one unit, reinstall the prior lockfile, then rerun Prisma validate, typecheck, lint, build, unit/security and critical integration gates. Normal queue rollout monitoring is sufficient; no special msgpackr codec migration step is required.
- Evidence: `docs/orchestration/runs/EX-01.4-backend-high-final.md`; `/tmp/ex014-fresh-audit.json`; `/tmp/ex014-after-batch1.json`; `/tmp/ex014-after-batch2.json`; `/tmp/ex014-runtime-after-safe.json`.
- Status: PASS / MERGED via PR #11. Merge SHA `85be915832f71727ad4459c68bc65d1805f591e2`. No user-facing behavior change observed in the audited scope.

### EX-02 — CI and release governance
- Date: 2026-10-05
- Surface: Engineering governance / CI; critical shipping test fixture assertion only.
- Change: Added seven repeatable CI checks, an isolated test-service target guard, production readiness policy tests, a dependency audit regression gate, and governance documentation. Added an assertion that the 99 Envíos critical test's authenticated actor is the seeded admin.
- Expected user impact: NONE_EXPECTED. No application/runtime behavior, API contract, storefront UI, or provider integration changed.
- Negative-risk review: PASS locally for Prisma validation, backend/frontend quality and tests, critical integration (14 files/83 tests in independent orchestrator rerun), audit regression fixtures, production unsafe-config fixtures, Gitleaks history, workflow lint, reviewer/challenger and diff checks. GitHub Actions and branch protection have not yet been exercised remotely.
- Compatibility: No dependency or schema changes. CI services are ephemeral Postgres 16/Redis 7; test guard requires CI context and explicitly test-named loopback targets. No real provider credentials/calls.
- Rollback: Revert the EX-02 workflow/scripts/docs/state/user-impact changes and the test fixture identity assertion as a single change set; no product data migration is involved.
- Evidence: `docs/orchestration/runs/EX-02-ci-governance-final.md`; four fresh audit artifacts referenced there.
- Status: PASS / READY_FOR_PR after independent orchestrator local audit; remote GitHub checks and main branch protection remain NOT_TESTED until PR publication.

### EX-03.2 — Payment webhook transaction boundary
- Date: 2026-10-06
- Surface: Payment webhook application/infrastructure boundary
- Change: Replaced direct `PrismaService.$transaction` ownership in `ProcessPaymentWebhookUseCase` with a narrow application unit-of-work backed by a Prisma adapter. Transaction callback contents, options, payment/order/inventory semantics, API responses, signature checks, idempotency, audit and event timing are unchanged.
- Expected user impact: NONE_EXPECTED.
- Negative-risk review: Prisma validation, typecheck, lint, build, 29/29 unit/security tests and the full 14-file critical suite passed. Existing replay, webhook signature, duplicate delivery, stock and cancellation-race assertions passed. Architecture findings for the selected use case decreased 121 -> 118.
- Compatibility: No schema, migration, provider, endpoint, DTO, state transition, or event contract change. Existing transaction options remain maxWait=15000 / timeout=30000.
- Rollback: Revert the EX-03.2 port, adapter, DI binding, use-case injection change and focused unit test; no data rollback is needed.
- Evidence: `docs/orchestration/runs/EX-03.2-payment-webhook-final.md`.
- Status: PASS / PHASE_LOCAL_READY_FOR_AUDIT; independent reviewer and orchestrator audit remain required.
