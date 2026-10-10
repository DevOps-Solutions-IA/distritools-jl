# Enterprise Execution Plan

The project is completed through numbered executions. Each execution has a branch, bounded scope, hard gates, user-impact review, evidence, and a state transition. Executors may not skip executions without orchestrator approval.

## EX-00 — Canonicalization and executable baseline — PASS
Goal: establish GitHub source of truth, secret hygiene, isolated test infrastructure, and verified baseline.
Evidence: GitHub canonical; Gitleaks clean; frontend 52/52; backend unit 26/26; critical E2E 83/83; builds/typechecks/lints PASS.
Known exception: architecture check reports pre-existing debt.

## EX-01 — Dependency security high-risk remediation — PASS
Goal: reduce frontend 15 HIGH and backend 8 HIGH without unsafe forced upgrades.
Method: safe patch/minor/transitive batches first; isolate major migrations; no downgrade acceptance without evidence.
Exit: critical stays 0; HIGH reduced materially; all baseline gates remain green; unresolved HIGH categorized with concrete owner/reason.
Sub-runs: EX-01.1 frontend safe HIGH PASS; EX-01.2 Tailwind 4 PASS; EX-01.3 Next 16 PASS/MERGED; EX-01.4 backend HIGH safe remediation PASS/MERGED. Residual Prisma HIGH and Swagger moderate are explicit release obligations, not hidden findings.

## EX-02 — CI, branch governance, and repeatable release gates — PASS / PROVIDER-BLOCKED GOVERNANCE
Goal: enforce Prisma validate, lint, typecheck, builds, unit tests, critical tests, Gitleaks, no-mock production guard, artifacts, and branch protection.
Exit: PR cannot merge when required gates fail; rollback/evidence tied to SHA.

## EX-03 — Architecture boundary hardening — PASS
Goal: remove highest-risk direct Prisma coupling and unsafe casts incrementally, beginning with write paths and oversized admin controller seams.
Exit: architecture findings reduced with no behavior regression; no big-bang rewrite.
Sub-runs: EX-03.1 AdjustStockUseCase PASS/MERGED via PR #16; EX-03.2 ProcessPaymentWebhookUseCase PASS/MERGED via PR #18; EX-03.3 CreateOrderUseCase PASS/MERGED via PR #20; EX-03.4 CancelOrderUseCase PASS/MERGED via PR #22. Architecture findings reduced 124 -> 112 without behavior changes.

## EX-04 — Event bus / BullMQ / idempotency / failure semantics — PASS / CUTOVER DEFERRED
Goal: replace accidental in-memory-only production path, register handlers explicitly, define Redis failure behavior, dedupe/retry semantics, and decide transactional outbox strategy.
Exit: domain events reach intended consumer once logically, retry safely, and fail closed where required.
Sub-runs: EX-04.1 typed event contracts/handler coverage PASS/MERGED via PR #24; EX-04.2 durable transactional outbox PASS/MERGED via PR #26; EX-04.3 consumer idempotency/notification recovery PASS/MERGED via PR #28; EX-04.4 Retry/DLQ and Redis Outage Operations PASS/MERGED via PR #30; EX-04.5 Cutover Readiness and Persisted Routing Boundary PASS/MERGED via PR #32 (7/7 exact-head CI, product merge ba0a2f220c13ebf56fb6dcac8da2f579a01b25dc). Production relay/worker remains disabled and new durable intents are fenced as cutover_pending. Production cutover is deferred until the EX-06 inventory producer gap, EX-07 order.paid notification disposition, mixed-version retirement and release authorization are closed.

## EX-05 — Auth, RBAC, sessions, audit, secrets, readiness — PASS / RELEASE GATES DEFERRED
Goal: verify login/2FA/session rotation/revocation, permissions, audit redaction, throttling, CORS/trusted proxy, production auth guards, and secret handling.
Exit: security matrix green with explicit production blockers.
Sub-runs: EX-05.1 Auth/RBAC/Session Security Baseline PASS/MERGED via PR #34 (7/7 exact-head CI, product merge 776cbccbd81986edf97805befcedfc3e30edc836). Production release requires Security/Product approval of TTL maxima, a controlled one-use-2FA rollout and review of distributed throttling/trusted-proxy topology. No production GO.

## EX-06 — Inventory, orders, checkout, payments internal correctness — INTERNAL GATES PASS / BLOCKED_DECISION
Goal: harden stock allocation/reserve/commit/release, order transitions, idempotency, webhook replay, cancellation races, payment state semantics, and PSE failure UX contract.
Exit: invariant/stress/failure-injection gates green; no fake payment success.
Sub-runs: EX-06.1 Inventory Reservation, Commit and Release Invariants PASS/MERGED via PR #36; EX-06.2 Order and Payment Lifecycle Correctness PASS/MERGED via PR #38 (7/7 exact-head CI, product merge 9a76cd3c072d59f0df742dd1eaa5725d25d38cc7). EX-06 parent is not marked completed: inventory.low_stock_detected producer remains BLOCKED_DECISION (Product/Inventory Operations) and cancellation-before-approved-webhook payment reconciliation remains BLOCKED_DECISION (Product/Payments/Finance). No production provider/cutover authorization; independent EX-07 operations can proceed.

## EX-07 — Internal operations: admin, analytics, search, notifications, CRM/content — SUBRUNS MERGED / POLICY DECISIONS OPEN
Goal: stabilize admin APIs, reports/exports, PII masking, search/reindex, notification persistence/retry, CRM/quotes, legal/footer workflows, and split highest-risk admin controller seams.
Exit: operational workflows are test-backed and fail closed.
Sub-runs: EX-07.1 Admin Operations Access, PII and Export Safety PASS/MERGED via PR #40; EX-07.2 Notification Persistence, Recovery and Consumer Disposition PASS/MERGED via PR #42 (7/7 exact-head CI, product merge d0862858b432d6b71de035b8e9a32c33ec088f9a). EX-07.3 Catalog Search, Projection Consistency and Reindex Safety PASS/MERGED via PR #44 (7/7 exact-head CI, product merge 5233d5c6a48e3b1717c3be8dab428a9f438d0531); catalog stock across inactive warehouses remains BLOCKED_DECISION under Product/Inventory Operations. EX-07.4 CRM, Quotes, Legal and Footer Workflow Correctness PASS/MERGED via PR #46 (7/7 exact-head CI run 38073960147; product merge bb36de81b0da1c78c9ccee3b4517dc825b5e8cc0). 52 files, backend unit/security 283, frontend 88, critical 241 + 4 environment guards; quote atomicity and Footer F3 validated. EX-07 parent remains incomplete due to notification/business policy decisions; EX-08 UX can proceed from merged main. order.paid template/recipient/channel remains BLOCKED_DECISION; manual retry of exhausted or uncertain notifications requires operator policy. No fake durable consumer or real provider activation.

## EX-08 — Admin UX and operator usability — ACTIVE (F0 NEXT)
Goal: browser-audit admin routes, eliminate cloned-page feel, improve hierarchy/readiness/alerts/forms/tables/actions, click-test all controls, validate PDF/CSV output.
Exit: operator workflows have browser evidence and no dead/fake actions.
User-impact review is mandatory. Runbook: docs/orchestration/runs/EX-08-admin-ux-plan.md. Baseline inventory: 42 admin routes, 20 modules, 71 declared actions (not verified); F0 seam extraction first. External providers and unresolved commercial policies stay blocked.

## EX-09 — Provider readiness framework
Goal: centralize provider selection, configuration validation, readiness states, mock-vs-real separation, secret masking, sandbox-only external testing controls.
Exit: production cannot start/claim readiness with mocks or missing credentials.

## EX-10 — 99 Envíos integration
Goal: authorized sandbox auth, quote, carrier selection, preenvío, external number, PDF, novedades, tracking, idempotency, retry, COD policy, PII masking.
Exit: sandbox evidence tied to SHA; MOCK99 never treated as real.
Blocked until credentials/sandbox authorization exist.

## EX-11 — Other external providers
Goal: payment gateway (approved provider), email, WhatsApp, and any approved shipping alternatives.
Exit: each provider has sandbox contract tests, failure modes, webhook/security controls, and readiness integration.
Blocked until provider/business decisions and credentials exist.

## EX-12 — Production release certification
Goal: full clean checkout/admin/provider E2E, load/smoke, security re-audit, migrations, backup/rollback, observability, TLS/DNS/CORS callbacks, documentation, release evidence.
Exit: explicit GO/NO-GO tied to exact SHA and environment. No production GO while BLOCKED_PROVIDER or unresolved P0 exists.

## Loop policy
Every execution follows: BASELINE -> IMPLEMENT -> TARGETED TEST -> FULL RELEVANT GATE -> SECURITY -> USER IMPACT -> DIFF REVIEW -> COMMIT -> PR -> INDEPENDENT VALIDATION -> MERGE -> STATE UPDATE.
Any FAIL loops back to IMPLEMENT with a narrowly scoped corrective sub-run (e.g. EX-04.1, EX-04.2) until exit criteria are met.
