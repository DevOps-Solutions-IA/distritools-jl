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

## EX-08 — Admin UX and operator usability — ACTIVE (DOMAIN WAVE NEXT)
Goal: browser-audit admin routes, eliminate cloned-page feel, improve hierarchy/readiness/alerts/forms/tables/actions, click-test all controls, validate PDF/CSV output.
Exit: operator workflows have browser evidence and no dead/fake actions.
User-impact review is mandatory. Runbook: docs/orchestration/runs/EX-08-admin-ux-plan.md. Baseline inventory: 42 admin routes, 20 modules, 71 declared actions (full workflows NOT_TESTED). F0 and F1/F2/SESSION product/documentary closures are complete (platform product PR51 and documentary PR52). The separate bounded test-reset QA PR53 is merged after seven exact-head checks; its documentary transition preserves EX08 ACTIVE and does not certify domain actions. PR #51 product merge220d5f726abdbc9ade64aca39a9dafd050cbce8c, seven exact-head CI38097274208 PASS. CAT13, INV9, SALE5, CRM4 and IAM11 were previously certified (42/71). CONTENT product PR77 is director-merged at e8249f7937421ae21008a80cc514dfd0b7fa23e7 after its own seven and new-main seven39204902568; this separate documentary transition proposes seven A50-A56,49/71verified and22pending only after its own exact-head seven and director merge. See EX-08.CONTENT-closure.md. LOG30 then CONTROL16 require current-main reconciliation and new exclusive executor leases; remaining domains and QA must individually certify all71 actions and42 full route workflows. LEGAL24 DRAFT/NO_PUBLICAR, architectureGLOBALFAIL167/deltaPASS0, Stable155FAIL, HIGH/SEC/GOV, business/provider/held/cutover fences remain. Envia blueprint and operational multiagent documentation are separate queues, not an EX10 provider transition or implementation. External providers and unresolved commercial policies stay blocked.

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


## EX-08.QA.TEST_DB_RETRY — bounded test helper closure
PR53 product merged 8b9eba627c2c7190284c303d23550cdd14d25b44, exact head6295637488855fd4e90cd2f6cc9aa13938f7a393, CI38102079752 attempt1 sevenPASS, behind0,scope6. ROOT315 unit/security,262critical,90E2E,214front,22guards/Prisma13/quality/Gitleaks PASS; CI266critical includes4guards. Wrapped40P01/55P03 now reach existing bounded retries; original tests/reset/seeds/auth/workers/business source unchanged. Challenger no introducedP0/P1/P2. Historical failures/SEC/GOV/business/provider/replay fences preserved; parentEX08 and71-action certification remain open. Documentary STATE transition is separate and requires its own seven exact-head checks.

## ROOT-02 — Consolidation and lifecycle recovery — ACTIVE

Scope: account for local worktrees/branches and external artifacts, reconcile unique work against live GitHub main, preserve LOG/CONTROL/Envia/LEGAL/platform candidates, close bounded engineering acceptance cycles, and prepare independently reviewed PRs. Execution evidence and inventory: `docs/orchestration/consolidation/README.md`; batch ownership and exit criteria: `INTEGRATION/BATCH_PLAN.md` and STATE.json `closure_obligations`. This extends the current control plane and does not restart completed domains.

Exit: every discovered asset has a documented disposition and recovery owner; valuable local work has an authorized integration path; technical integration and closure require complete local gates, independent acceptance, seven exact-head checks, director merge approval and a documentary transition. Blocked provider/legal/business scopes retain evidence and exact dependencies. No production, provider, legal-publication or deletion authority. Official EX-08 certification remains 49/71,22 pending; inventory, documentation and PRs add zero certified actions.

Sequencing update2026-10-19: ROOT-01 final handoff certifies LOG local QA PASS (383backend/771frontend/385critical/90E2E/18+7browser) on frozen1302-source input; original QA leases released. Reuse certified local QA, keep promotion pending LOG-specific security/governance and separately owned PR81 current-main/exact-head/director acceptance. Approved LEGAL24 documentary PR79 is mergeda5ef8f0; PR80 was specifically director-approved and squash merged at ebbf77ed04fd03fdc2529628f54214acda514888 after seven exact-head checks on 5cbc8f7212719d11b165cebd7b50c652bd4a523b. Post-main run 39309806432 is PASS. The single receipt transition is docs/orchestration/consolidation/INTEGRATION/PR80_MERGE_VERIFICATION.md and requires its own review/seven/director approval; it does not close ROOT02 or certify new actions. Preserve49/71 and NO_PUBLICAR. CONTROL six-action recovery excludes merged audit/legacy/tracking boundaries and retains tracking.read. Envia documentation is separate from provider implementation. LEGAL24 remains DRAFT / NO_PUBLICAR. Security/GOV/platform preparation cannot close historical findings without current proof. Cleanup is a proposal only until an exact manifest is approved and recoverability is verified.


## EX-08 LOG — product merged, full action acceptance remains pending

PR81 product32 was director-squash merged at cc37da873147b459bec7a81da01d8a31c56466f6, approved HEAD337943d077157389c7f31da8ecdd122414b5a044. Product39321669362 and new-main39325850805 each passed seven exact-head checks attempt1;1352 source hashes/32 postimages preserved. This documentary transition records zero newly accepted actions:49/71 verified and22 pending remain unchanged. Five technically verified read paths are partial evidence: the master requires exact action audit and notifications paginated history; the supplied evidence covers denied-access audit and a latest100 window, not positive per-read audit or complete history pagination. A43/A45/A46/A47/A48 and A49 remain NOT_TESTED for full acceptance; A38-A42/A44 BLOCKED_PROVIDER. Earlier local QA PASS and snapshots remain historical evidence, not a full LOG certificate. See EX-08.LOG-technical-boundary-closure.md.

Next: independent/director audit of this receipt-only PR and its own seven CI; a new scoped authorization is needed for the remaining audit/pagination/provider-validation work. FullLOG/EX08/ROOT02 remain open. CONTROL is separately owned by ROOT02/PR83, with tracking.read/IAM16/LEGAL24/governance preserved. ARCHITECTURE_GLOBAL FAIL167/deltaPASS0, inherited security failures/debt, Stable155 FAIL, legal DRAFT/NO_PUBLICAR, commercial/provider/held/cutover fences and production NO-GO remain unchanged. No provider activation, waiver or deletion is authorized.
