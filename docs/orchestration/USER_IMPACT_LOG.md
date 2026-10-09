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

### EX-03.3 — Create order transaction boundary
- Date: 2026-10-06
- Surface: Order creation / checkout application-infrastructure boundary.
- Change: Replaced direct Prisma transaction ownership in `CreateOrderUseCase` with an application-facing `CreateOrderUnitOfWork` backed by a Prisma adapter. Stock reservation, order creation and order-item creation remain atomic in the same transaction; audit and `order.created` publication remain post-commit.
- Expected user impact: NONE_EXPECTED. No intended change to checkout/API responses, product/promotion/tax/total rules, order status, stock semantics, tracking, audit/event timing or provider behavior.
- Negative-risk review: PASS. Focused adapter tests 2/2; backend unit/security 31/31; focused orders/checkout 12/12; concurrency/failure-injection 8/8; full critical 14 files/83 tests; Prisma/typecheck/lint/build, Gitleaks history/source and diff check passed. Independent reviewer/challenger PASS.
- Compatibility: No schema, migration, API/DTO, transaction-option, dependency, provider or retry changes. Existing direct transaction boundary behavior is preserved.
- Rollback: Revert the port, adapter, Nest binding, use-case injection substitution, focused test and EX-03.3 evidence entry as one set; no database rollback is needed.
- Evidence: `docs/orchestration/runs/EX-03.3-create-order-final.md`.
- Status: PASS / PHASE_LOCAL_READY_FOR_AUDIT; overall architecture checker remains DEBT_DETECTED for 115 unrelated findings.

### EX-03.4 — Cancel order transaction boundary
- Date: 2026-10-06
- Surface: Order cancellation / inventory reservation release application-infrastructure boundary.
- Change: Replaced direct Prisma transaction ownership in `CancelOrderUseCase` with an application-facing `CancelOrderUnitOfWork` backed by a Prisma adapter. Stock release and order cancellation remain atomic; permission/policy checks remain pre-transaction and cancellation audit/event remain post-commit.
- Expected user impact: NONE_EXPECTED. No intended change to cancellation authorization, cancellation policy, inventory semantics, public response, audit/event behavior or payment/webhook race outcome.
- Negative-risk review: PASS. Focused adapter tests 2/2; backend unit/security 33/33; focused orders/payment/inventory 12/12; concurrency 8/8 including cancel-vs-webhook race; full critical 14 files/83 tests; Prisma/typecheck/lint/build, Gitleaks history/source and diff check passed. Independent reviewer/challenger PASS.
- Compatibility: No schema/migration, API/DTO, dependency, transaction-option, retry, isolation, event/outbox, or provider change.
- Rollback: Revert the cancellation port, adapter, Nest binding, use-case injection substitution, focused unit test and EX-03.4 evidence entry together; no database rollback is needed.
- Evidence: `docs/orchestration/runs/EX-03.4-cancel-order-final.md`.
- Status: PASS / PHASE_LOCAL_READY_FOR_AUDIT; architecture checker remains DEBT_DETECTED for 112 unrelated findings.

### EX-04.1 — Event contracts and explicit handler coverage
- Date: 2026-10-06
- Surface: Internal domain-event publishers, in-memory subscribers, and BullMQ worker dispatch.
- Change: Added typed/versioned `v1` contracts, runtime boundary validation, an explicit injected handler registry, and fail-closed worker processing. Preserved the in-memory publisher as the default and preserved the BullMQ envelope/job identity.
- Expected user impact: NONE_EXPECTED for valid existing producer events. Invalid event payloads now fail before in-memory subscriber dispatch; malformed, unsupported, or unhandled BullMQ jobs reject rather than being acknowledged. No checkout, API, provider, or business rule change is intended.
- Negative-risk review: PASS. Final focused event tests 12/12; backend unit/security 49/49; critical suite 14 files / 83 tests; Prisma validate, typecheck, lint, build, Gitleaks history/source, diff check and independent reviewer passed.
- Compatibility: No schema/migration, dependency, external provider, transport-binding, API-response, or persisted-data change. `inventory.low_stock_detected` remains producer-missing; `order.paid` remains a known notification-template gap; no BullMQ worker route is active.
- Rollback: Revert EX-04.1 source, tests and documentation together; no data/schema rollback is required.
- Evidence: `docs/orchestration/runs/EX-04.1-event-contracts-final.md`.
- Status: PASS / PHASE_LOCAL_READY_FOR_AUDIT; no commit, push, merge, or STATE transition performed.

### EX-04.2 - Durable transactional outbox
- Date: 2026-10-06
- Surface: Order creation/cancellation and payment webhook intent capture; isolated event transport.
- Change: Added mandatory held outbox capture inside existing transactions and reused persisted event IDs in post-commit legacy publication. Added bounded lease/claim relay with no normal runtime registration or activation. Worker/handlers, providers, API response shapes and business rules remain unchanged.
- Expected user impact: Existing requests retain audit then awaited subscriber behavior. Outbox insert/validation failure now rolls back the scoped business transaction instead of allowing committed business state without durable intent. Schema must precede capture-code deployment. Event occurrence records transaction capture time.
- Negative-risk review: PASS. Executor quality/security gates and independent source review passed. Fresh orchestrator runs proved 57/57 unit/security, 24/24 real outbox failure-injection cases, full critical 15 files / 107 tests, and dedicated migration forward/rollback/forward. Source/test snapshots were unchanged during execution. Executor sandbox failures are historical and resolved by this isolated verification.
- Compatibility: Additive table only; no dependency, provider, frontend, event payload/version or stock/payment state-rule changes. Normal in-memory delivery retained; held rows are not delivered or automatically replayed. Existing versioned recipient fields require protected DB/backups; no payload endpoint/log added.
- Rollback: Revert EX-04.2 application code as a unit while retaining the schema and all outbox records. Forward-fix/reconcile durable history; test-only DROP is forbidden in production or any backlog-bearing DB.
- Evidence: `docs/orchestration/runs/EX-04.2-durable-outbox-final.md`; focused failure-injection suite and disposable migration test; exact logs referenced in the final record.
- Status: PASS / MERGED via PR #26, exact validation HEAD `41007efafa7c403a4d30bfe4b422b4a62092ea8a`, CI run 37518205916 (7/7 SUCCESS), squash merge `a7eb83885b55d93fc2f44821d737d0f61b20d324`. Orchestrator verified disposable-service acceptance and the remote diff. No production transport or provider activation. The post-merge transition closes EX-04.2 and prepares EX-04.3 consumer idempotency/reconciliation and notification recovery.

### EX-04.3 — Consumer idempotency and notification recovery
- Date: 2026-10-06/07 UTC
- Classification: NOTIFICATION; bounded admin delivery-state extension.
- Surface: Existing notification/event consumers, persisted delivery/audit state, search projections and admin status responses.
- Change: Shared per-consumer/event inbox identity and envelope conflict checks; atomic notification/audit intent; fenced sending and recoverable dispatch; bounded search batches with durable progress; read-only held-history evidence.
- Expected impact: Existing successful checkout/order/payment payloads, rules, event contracts, templates and recipients remain unchanged. After supported notification intent commits, a caught Redis enqueue error leaves eligible pending work and an audit-flush error leaves durable audit intent; the originating operation need not fail solely for that post-commit step. Pending intent is not queue acceptance or delivered status. Database/inbox failures and unsupported handlers still fail observably.
- Admin behavior: Status may be sending or uncertain. Sending does not prove delivery; uncertain is not safe for blind retry. Explicit public-field serialization excludes leases/tokens/eligibility/internal errors. Authentication, notifications.read permission, masking and read-only behavior are preserved.
- Audit behavior: One logical queued audit records durable scheduling intent. State transitions and audit intents commit together; later audit recovery preserves original transition time and does not resend notifications or exhaust provider attempts.
- Search behavior: At most 50 targets per transaction and 100 batches per durable delivery, with atomic cursor/projection progress and completion only after all batches. Public absent IDs and ids:[] retain full reindex; internal empty batches remain empty.
- Validation: Corrected snapshot passes 63/63 backend unit/security, 17/17 consumers, 24/24 outbox, 7/7 platform, 16 files/125 critical and 1/1 guarded migration roundtrip. Prisma/source typecheck/lint/build and focused test typing pass. Independent findings are closed; prior failures and test-fixture corrections remain in the final record. No assertions/security gates were suppressed.
- Compatibility: Additive schema includes inbox/audit intents and new notification enum values. Historical notifications default ineligible; held outbox history remains held. No production relay, historical replay, provider activation, lifecycle/template invention or frontend change.
- Security/privacy: Recovery/reconciliation exposes safe identities/categories without new recipient/provider payload logging. Real providers remain BLOCKED_PROVIDER. Existing dependency and governance obligations remain open.
- Rollback: Preserve schema, notification/inbox/audit records and held history. Use a binary compatible with persisted sending/uncertain values or forward-fix. A pre-EX-04.3 binary is not a certified rollback target; no destructive reverse against populated/deployment databases.
- Evidence: docs/orchestration/runs/EX-04.3-consumer-idempotency-final.md.
- Status: PASS / MERGED via PR #28; exact validated HEAD `019821ef8d86e2c1915e0a248672db74b8117fa1`, CI run 37549977112 (7/7 SUCCESS), squash merge `a782d553a17362f213908f9e53f891aa8ef14fa0`. Remote byte/diff audit PASS. The documentation transition records the validated product and prepares EX-04.4; production relay/history/provider activation remains outside this acceptance.

### EX-04.4 — Retry, DLQ and Redis outage operations
- Date: 2026-10-07
- Surface: Internal domain-event delivery/recovery and notification queue operations; admin replay operations API.
- Change: Separated fail-fast producer and reconnecting worker Redis policies; made consumer business retry attempts durable in PostgreSQL and distinct from Redis outage; added durable per-event/consumer parking, bounded cursor reconciliation, RBAC/audited replay with leases, role readiness and bounded worker shutdown. Added two additive migrations for parking and held-delivery evidence.
- Expected user impact: No intended storefront, checkout, order, payment, public tracking or provider behavior change. When queue delivery fails, existing durable event intent stays pending/recoverable; terminal, exhausted or uncertain work is surfaced for operator review rather than acknowledged as successful. Operator replay now requires explicit per-delivery authorization and durable eligibility checks. Delivery remains AT-LEAST-ONCE, not exactly-once.
- Negative-risk review: PASS locally for focused EX-04.4 12/12; full backend unit/security 66/66; full critical 17 files/137 tests; full E2E 10 files/63 tests; Prisma generate/validate/migrate deploy and isolated guarded migration roundtrip; typecheck, lint, build; fresh Gitleaks history/source/diff; `git diff --check`. Independent static challenger: PASS; it did not execute tests.
- Compatibility: Two additive migrations add durable delivery parking and safe held-delivery evidence; no destructive migration, package/lockfile change, event contract, real provider call, production worker/relay activation or historical held promotion. Deploy schema before application. Rollback preserves schema and durable records; reverse SQL is restricted to the disposable migration test DB and refuses populated evidence.
- Security/operations: PostgreSQL remains authority for event intent, consumer completion, retry/parking and notification sent/uncertain guards. Replay requires `domain_events.replay`; logs/parking use safe categories and stable identifiers. Durable worker registration and replay/reconciliation queue mutations are test-only; production readiness reports the worker capability unavailable. Only labeled disposable Postgres/Redis services were used. Real providers remain BLOCKED_PROVIDER and existing security/governance obligations remain open.
- Rollback: Roll back application binaries only while retaining the parking table and durable rows; reconcile/forward-fix before any schema retirement. Never use the guarded test-only reverse outside its disposable database.
- Evidence: `docs/orchestration/runs/EX-04.4-retry-dlq-redis-final.md`; `/tmp/ex044-critical-final.log`; `/tmp/ex044-e2e-final.log`; `/tmp/ex044-unit-final.log`; `/tmp/ex044-gitleaks-history.log`; `/tmp/ex044-gitleaks-source.log`; `/tmp/ex044-gitleaks-diff.log`; `/tmp/ex044-backend-audit.json`.
- Status: PASS / MERGED via PR #30. Final exact validation HEAD 43880c174e726362b0f058b8c88d2c8804b060c5; CI run 37652904614 7/7 SUCCESS; squash merge d38a11f774aea513638e1da7e9236d05f16e1101. First CI attempt exposed only a test-fixture portability defect (host redis-server absent); the Docker fallback was validated 12/12 and the final exact-head run passed. Production relay, historical held replay and real providers remain unactivated.

### EX-04.5 — Persisted routing boundary and cutover readiness
- Date: 2026-10-07
- Surface: Domain-event intent capture for orders, payments, catalog/content, promotions and auto-shipping; read-only admin cutover readiness; queue Redis operations evidence.
- Change: Added an immutable per-event persisted route linked to the stable outbox `eventId`, transactionally captured with business/shipment state. Normal routing stays `legacy_hold`; durable routing is test-only. Added a bounded read-only evaluator protected by `domain_events.cutover.read`. Shipment quote, carrier selection, guide and failure events now use the same persisted routing boundary.
- Expected user impact: No intended storefront/API response change. Existing legacy subscribers continue receiving events under default route. Admin operators with the new permission can inspect bounded event/consumer/parking readiness without payload or PII. Queue failures retain PostgreSQL intent and cannot trigger duplicate legacy fallback.
- Negative-risk review: PASS locally: Prisma validate/generate, backend typecheck/lint/build, 77 unit/security tests, EX-04.5 focused 6/6, full critical 18 files/143 tests, E2E 10 files/63 tests, disposable migration forward/reverse/forward, Redis AOF/noeviction restart probe, Gitleaks history/source/diff, diff check and independent challenger. Historical held snapshots remained byte-for-byte unchanged.
- Compatibility/security: One additive migration. Old binaries that do not understand persisted routing are not certified rollback-compatible; preserve schema and do not enable durable routing in a mixed-version production rollout. `order.paid` consumer/template and `inventory.low_stock_detected` producer remain blocked gaps. Real providers and production relay/worker remain disabled. Existing SEC/GOV obligations remain open.
- Rollback: Retain the additive routing table and all event history. Roll application binaries back only to a version tested with current persisted routing; pre-EX-04.5 binary compatibility is unverified. Do not reverse the migration on a populated database; guarded reverse is disposable-test-only.
- Evidence: `docs/orchestration/runs/EX-04.5-cutover-readiness-final.md`; `/tmp/ex045-critical-final.log`; `/tmp/ex045-e2e-final.log`; isolated migration DB `ex045_migration_test`; isolated Redis AOF job restore probe.
- Status: PASS / MERGED via PR #32. Final validated HEAD c42c765865b2400da29cdd44732cb5dad4992bcd; CI run 37683738400 7/7 SUCCESS; squash merge ba0a2f220c13ebf56fb6dcac8da2f579a01b25dc. Pre-merge P2 on mixed-version relay visibility was closed with the persisted cutover_pending fence; an EX-04.4-style eligible predicate has zero visibility into new durable intents. Production cutover, historical replay and real providers remain unactivated.

### EX-05.1 — Auth, RBAC and session security baseline
- Date: 2026-10-07
- Surface: Admin authentication, access/refresh sessions, 2FA, security readiness and audit redaction.
- Change: Normalized login failures, made refresh rotation conditional on persisted session/JTI state, added persisted one-use 2FA challenges, hardened production/staging secret and CORS checks, prevented dev-admin bypass under conflicting production labels, and expanded recursive audit redaction.
- Expected user impact: Login failures no longer reveal whether an account is unknown, inactive, or 2FA-ineligible. Existing pre-deployment 2FA challenges cannot be used after rollout and must be reissued. Production/staging startup/readiness rejects missing or unsafe authentication configuration. Session refresh races fail closed; the losing refresh token family is revoked.
- Compatibility/rollout: Additive `AuthTwoFactorChallenge` table migration required before application rollout. In-flight legacy challenges are intentionally invalidated. Existing production plaintext 2FA seeds, if any, need controlled re-enrollment before deployment. No API provider integration, role/permission policy, password policy, or token lifetime default was intentionally changed.
- Security and limitations: Access/refresh/2FA challenge secrets are distinct. Production/staging effective TTL maxima are 15m/7d/10m respectively; shorter positive durations are permitted, and malformed/over-limit values fail startup/readiness and token issuance without fallback. This is an orchestrator-approved technical policy pending the required Security/Product organizational approval; it does not authorize production GO. Process-local throttles do not aggregate across replicas; trusted proxy remains disabled absent deployment-specific topology/allowlist approval. No production data or secrets were inspected.
- Evidence: `docs/orchestration/runs/EX-05.1-auth-rbac-session-final.md`.
- Status: PASS / MERGED via PR #34; validation HEAD 8e820c41b4882b74f25c3afd958f08cc83c5ebbe, CI 37819330424 7/7 SUCCESS, squash merge 776cbccbd81986edf97805befcedfc3e30edc836. Technical TTL P2 resolved (access <=15m, refresh <=7d, challenge <=10m); organizational Security/Product approval and rollout compatibility remain release obligations. No production activation or provider calls.

### EX-06.1 — Inventory reservation invariants
- Date: 2026-10-08
- Surface: Inventory reserve/commit/release use cases and their order, checkout, webhook, and cancellation transaction boundaries.
- Change: Repeated target lines are aggregated deterministically; exact operation retries remain idempotent after balances change; conflicting reference reuse fails. Inventory movements and audit writes now share the owning transaction, including caller-supplied UOWs.
- Expected user impact: No API/DTO or stock policy changes. Multi-line orders that repeat a variant/warehouse are reserved/committed/released by their aggregate quantity instead of being mistaken for duplicate operations. If inventory audit persistence fails, the stock operation now rolls back rather than committing without its audit record. Exact retries return the prior operation result; incompatible reuse of the same operation reference remains a conflict.
- Validation: Disposable PostgreSQL focused EX-06.1 15/15, unit/security 127/127, critical 20 files/173 tests, E2E 10 files/74 tests, Prisma validation, typecheck/lint/build and readiness/dependency guard tests passed. Independent challenger and final secret scanning are recorded in `docs/orchestration/runs/EX-06.1-inventory-reservation-final.md`.
- Limitations: No schema migration or production/provider/event-bus activation. `inventory.low_stock_detected` remains BLOCKED_DECISION because current `minStock`/`reorderPoint` fields do not define event crossing, deduplication, re-arm or ownership semantics. Existing historical held event state is untouched.

- Status: PASS / MERGED via PR #36. Exact validated HEAD 6851f2ddbeaeed800f3b4942365cee50e4d76b72; CI 37864693590 7/7 SUCCESS; product merge 927b536c47492a1c94d4d9f3937eaf870e32d9df. No provider activation, production or historical held mutation. Low-stock producer remains BLOCKED_DECISION.

### EX-06.2 — Order and payment lifecycle correctness
- Date: 2026-10-08
- Surface: Authenticated order creation, guest checkout, payment intent/webhook handling, cancellation and stock integration.
- Change: Added optional `Idempotency-Key` handling for order creation/checkout with persisted hashed request identity; made order/cancel/payment audits transaction-bound; serialized payment intents and webhook terminal decisions; strict webhook body/schema/event identity validation; disabled mock payment intents outside approved local/test contexts.
- Expected user impact: Identical keyed create/checkout retries return the same order and do not reserve stock twice; reusing a key with different request data returns conflict. Guest PSE checkout now fails before order/stock mutation because no provider is configured. Missing raw webhook bytes and unknown payment outcomes fail closed. Audit persistence failure rolls back corresponding order/payment/stock state.
- Compatibility: Existing callers may omit the idempotency header. Additive PostgreSQL idempotency table migration is required before application rollout; retain its rows on rollback. No amount/tax/promotion/accounting semantics, payment provider, production relay or TTL policy changed.
- Limitations: Payment approved after an order cancellation won is left pending with its webhook unprocessed and retryable; Product/Payments/Finance must choose an authorized reconciliation/reversal/refund disposition. `inventory.low_stock_detected` remains BLOCKED_DECISION under Product/Inventory Operations ownership. Real providers remain BLOCKED_PROVIDER.
- Evidence: `docs/orchestration/runs/EX-06.2-order-payment-lifecycle-final.md`.
- Status: PHASE_LOCAL_READY_FOR_AUDIT — final local gates pass (critical 21 files/186 tests; E2E 10 files/86 tests; unit/security 86 tests; frontend 62 tests; CI/readiness guards 22 tests). Challenger reports no technical P1/P2. No commit, push, PR, merge, STATE transition, production activation or real-provider call performed.

- Status: PASS / MERGED via PR #38, HEAD 3891e6c64e0ae8f9435d802f6cb495f681d0cc6c, CI 37874226272 7/7 SUCCESS; product merge 9a76cd3c072d59f0df742dd1eaa5725d25d38cc7. EX-06 parent remains BLOCKED_DECISION for late approved webhook after cancellation and low-stock producer; no production provider activation.

### EX-07.1 — Admin access, PII and export safety
- Date: 2026-10-08
- Surface: Administrative orders, customers, payments, dashboard, reports, audit, notifications, shipment events and CSV report output.
- Change: Sensitive order identity/address/notes, customer identity, financial amounts and payment details now require their existing granular permissions; sensitive order views are audited. Admin serializers omit internal provider/webhook payloads and secrets, historical audit JSON is redacted on read, and permission-denial logs omit actor identifiers. Report and dashboard sources are bounded; report relations use deterministic per-relation caps and fail closed rather than silently truncating. CSV text neutralizes spreadsheet formula injection while retaining legitimate numeric negative amounts. PII export and customer export remain blocked.
- Expected user impact: Operators without `customers.read_sensitive` see masked identities/address/notes; users without `reports.financial.read` see `NO_PERMISSION` for financial fields and cannot access financial report/export routes. Audit export remains separately gated by `audit.export`. Large report source/relation sets return a bounded error and require narrower filters. No provider, payment, order-state, inventory, or production behavior is intentionally changed.
- Limitations: Customer profiles remain records in the existing `Customer` model; order-only guest buyers remain inspectable through the permission-controlled orders surface and are not materialized by a customer-list GET. EX-06 payment-after-cancel and low-stock event decisions remain open; order.paid notification disposition remains assigned to the later EX-07 notifications track. Real providers remain BLOCKED_PROVIDER.
- Evidence: `docs/orchestration/runs/EX-07.1-admin-access-pii-exports-final.md`.
- Status: PHASE_LOCAL_READY_FOR_AUDIT. Local critical/E2E/unit, Prisma, typecheck/lint/build, fresh dependency audits, Gitleaks and diff-check completed; independent challenger reports no P1/P2. No commit, push, PR, merge, `STATE.json` modification, production activation or real-provider call.

- Status: PASS / MERGED via PR #40. Final validation HEAD 135caf4f465d281ac06ab10fe8ed69fe9d251014; CI run 37940210860 7/7 SUCCESS; product merge e6ae83aeb99ece1d5961c90eeefd712215028728. Production, real providers and event-bus cutover remain unauthorized. EX-06 and order.paid business gaps remain open.

### EX-07.2 — Notification delivery recovery (local candidate)
- Date: 2026-10-09
- Surface: Internal domain-event notification persistence, queue recovery, delivery-attempt limits, stale send claims and local/test mock provider safety.
- Change: Recovery uses one DB-authoritative three-attempt limit across claim eligibility and BullMQ job options; retryable failed rows can be reconstructed after Redis loss, including reactivation of a retained failed BullMQ job with the original notification ID. Expired legacy sends without a claim token now transition to uncertain with durable audit intent. Mock email/WhatsApp refuse to return synthetic delivery success in production/staging.
- Expected user impact: Local/test behavior retains its existing mocks. In production/staging the mock adapters now fail closed rather than writing local email content or representing synthetic email/WhatsApp delivery as sent. Recovery can resume eligible work under the original identity; exhausted DB attempts remain failed and are not auto-retried. Uncertain results remain protected from blind resend. No API, schema, or business-template changes.
- Limitations: No notification retry/replay endpoint or post-exhaustion policy was added. `order.paid` remains `BLOCKED_DECISION` for Product/Notifications/Payments; `inventory.low_stock_detected` remains `BLOCKED_DECISION` for Product/Inventory Operations; EX-06 payment-after-cancellation remains open. Email, WhatsApp, payments/PSE, and shipping remain `BLOCKED_PROVIDER`. No production, event-bus cutover, historical replay, or held-state mutation.
- Evidence: `docs/orchestration/runs/EX-07.2-notification-delivery-recovery-final.md`. Local candidate only; orchestrator audit/CI/merge pending.
