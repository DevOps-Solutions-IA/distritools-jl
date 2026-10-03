# Enterprise Execution Plan

The project is completed through numbered executions. Each execution has a branch, bounded scope, hard gates, user-impact review, evidence, and a state transition. Executors may not skip executions without orchestrator approval.

## EX-00 — Canonicalization and executable baseline — PASS
Goal: establish GitHub source of truth, secret hygiene, isolated test infrastructure, and verified baseline.
Evidence: GitHub canonical; Gitleaks clean; frontend 52/52; backend unit 26/26; critical E2E 83/83; builds/typechecks/lints PASS.
Known exception: architecture check reports pre-existing debt.

## EX-01 — Dependency security high-risk remediation — ACTIVE
Goal: reduce frontend 15 HIGH and backend 8 HIGH without unsafe forced upgrades.
Method: safe patch/minor/transitive batches first; isolate major migrations; no downgrade acceptance without evidence.
Exit: critical stays 0; HIGH reduced materially; all baseline gates remain green; unresolved HIGH categorized with concrete owner/reason.

## EX-02 — CI, branch governance, and repeatable release gates
Goal: enforce Prisma validate, lint, typecheck, builds, unit tests, critical tests, Gitleaks, no-mock production guard, artifacts, and branch protection.
Exit: PR cannot merge when required gates fail; rollback/evidence tied to SHA.

## EX-03 — Architecture boundary hardening
Goal: remove highest-risk direct Prisma coupling and unsafe casts incrementally, beginning with write paths and oversized admin controller seams.
Exit: architecture findings reduced with no behavior regression; no big-bang rewrite.

## EX-04 — Event bus / BullMQ / idempotency / failure semantics
Goal: replace accidental in-memory-only production path, register handlers explicitly, define Redis failure behavior, dedupe/retry semantics, and decide transactional outbox strategy.
Exit: domain events reach intended consumer once logically, retry safely, and fail closed where required.

## EX-05 — Auth, RBAC, sessions, audit, secrets, readiness
Goal: verify login/2FA/session rotation/revocation, permissions, audit redaction, throttling, CORS/trusted proxy, production auth guards, and secret handling.
Exit: security matrix green with explicit production blockers.

## EX-06 — Inventory, orders, checkout, payments internal correctness
Goal: harden stock allocation/reserve/commit/release, order transitions, idempotency, webhook replay, cancellation races, payment state semantics, and PSE failure UX contract.
Exit: invariant/stress/failure-injection gates green; no fake payment success.

## EX-07 — Internal operations: admin, analytics, search, notifications, CRM/content
Goal: stabilize admin APIs, reports/exports, PII masking, search/reindex, notification persistence/retry, CRM/quotes, legal/footer workflows, and split highest-risk admin controller seams.
Exit: operational workflows are test-backed and fail closed.

## EX-08 — Admin UX and operator usability
Goal: browser-audit admin routes, eliminate cloned-page feel, improve hierarchy/readiness/alerts/forms/tables/actions, click-test all controls, validate PDF/CSV output.
Exit: operator workflows have browser evidence and no dead/fake actions.
User-impact review is mandatory.

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
