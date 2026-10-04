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
- Status: PASS / READY_FOR_PR. Remote main was freshly fetched and matches base SHA `938abd5853123039ed9c8138ffb270c4e653aa76`. No merge performed yet.
