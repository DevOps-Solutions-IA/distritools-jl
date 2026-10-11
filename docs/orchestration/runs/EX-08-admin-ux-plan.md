# EX-08 — Enterprise Admin UX and Operator Usability

**Status:** ACTIVE, DOMAIN WAVE NEXT; F0 + F1/F2/SESSION MERGED. **Input:** EX-07.4 product PR #46 merged on main at bb36de81b0da1c78c9ccee3b4517dc825b5e8cc0, seven exact-head CI PASS (run 38073960147). **Production:** NO-GO; EX-09–EX-12 continue independently.

## Product contract

Deliver an enterprise administrative operations workstation for DistriTools JL, not a generic SaaS dashboard or content-only set of cards. Visual design must enable operators to complete real, auditable business tasks. No dead buttons, unimplemented calls to action, fabricated order/payment/shipping outcomes, irrelevant explanatory blocks, silently empty errors, or text-only substitutes for functionality.

Baseline inventory is **42 Next.js admin page routes**, **20 module declarations** and **71 declared primary actions**. These numbers describe existing source, NOT passed workflows or 71 verified controls. Browser and API evidence must classify each route and each declared action.

### Canonical audit sources in this repository

- docs/orchestration/runs/EX-08-admin-route-inventory.csv — routes, source page, component pattern and browser verification gap.
- docs/orchestration/runs/EX-08-admin-module-catalog.csv — 20 static module declarations, permissions, readiness labels and expected API contracts. Labels are NOT live readiness.
- docs/orchestration/runs/EX-08-admin-action-matrix.csv — 71 claimed actions, each requiring proof of backend authorization, state transition, persistence and audit.

Prior detailed planning and 13 Codex tasks were prepared on the authorized workstation at /home/wundah/distritoolsjl-ex08-prep-20261010. That folder is a handoff resource, not an automatically executable plan. This runbook and the tracked CSVs are the portable, reviewable baseline.

## Verified platform entry for domain work

F0 product PR #48 and its documentary transition are closed. F1/F2/SESSION product PR #51 merged at `220d5f726abdbc9ade64aca39a9dafd050cbce8c`, seven exact-head checks PASS on `459b76c0669af81531ba9e63c2309b2a1acb2658` (run38097274208, attempt1, behind0,61 files). ROOT independently validated297 unit/security,260 full critical,90 E2E,214 frontend and actual compiled-Next browser/session/role/fault/persistence cases; challenger found no unresolved introducedP0/P1/P2. Full validation and preserved failures: EX-08.PLATFORM-orchestrator-validation.md.

This platform entry preserves42 route paths but certifies zero of71 complete domain action workflows. All42 complete live workflows, permission-specific writes, downloads, concurrency and full domain browser/a11y acceptance remain required. Activate CAT/INV/CRM from live main only after the separate platform STATE transition, then remaining domains and QA/challenger. Dependency installation for reproducible browser infrastructure is sequential and exclusively QA-owned; it does not authorize new providers, policy or production.

## Static findings to reproduce and resolve

- AdminSectionPage.tsx is a large shared component and 16 admin routes delegate to it; five detail routes delegate to the generic AdminDetailPage.tsx renderer. Extract specialized screens, preserving all routes and existing behavior before domain redesign.
- frontend/src/lib/admin/server-data.ts can substitute empty fallback collections when an endpoint fails. Errors, empty success, denied access and provider blocked must render differently; data freshness/pagination must not imply success.
- The legal admin table currently references workflowStatus/isPublished, while the backend responds with status/publishedAt. Prove and correct the mapping with real fixtures and browser verification.
- Admin catalog snapshot uses general public API readers for products/brands/categories. Prove whether inactive/draft/archived records are omitted, then use authorized admin reads for operator lists.
- AdminShell navigation/search and metadata READY badges are partly derived from static module descriptions; verify routing and effective permissions, avoid false readiness.
- The project has Vitest component tests but no declared reproducible full-browser E2E harness in frontend/package.json; install and govern compatible test infrastructure before claiming route/action completeness.

The above are code review findings; no browser/runtime defect is declared repaired merely by appearing here.

## Visual and interaction direction

Maintain DistriTools JL identity: neutral black/carbon foundation, industrial-yellow restrained accent, consistent typographic hierarchy, semantic color, clear focus/contrast, compact and efficient data presentation. Avoid oversized promotional headings, duplicated cards, placeholder microcopy, badge noise and generic layouts reused across different business tasks.

Shared design primitives should standardize typography, spacing, navigation, accessible tables/forms/modal confirmations, loading/empty/error/permission/provider-blocked states and audit timelines. Domain workstations should specialize around what an operator must decide and do. Support keyboard/focus, reduced motion, and responsive screens at 320, 375, 768, 1024 and 1440 px.

## Delivery sequencing — isolated worktrees, exclusive ownership

**F0 (serial first):** extract AdminSectionPage.tsx and AdminDetailPage.tsx into typed domain seams and route wrappers. Preserve existing behavior and all 42 routes; do not add invented operations. F0 uniquely owns these shared files until merged and regression-certified.

**F1 (platform after F0):** one owner for server-data.ts, operations.ts, admin proxy/BFF and typed API adapters. Implement stable domain-specific reads, mutation contracts, RBAC/PII/session handling, fail-closed error states, real backend readiness, server pagination and permission-specific responses. Shared API signatures must be fixed before launching domain work.

**F2 (design shell after F0, ownership separate from F1):** one owner for AdminShell.tsx and common UI/styles. Refine navigation, search, action affordances, responsive panel structure and brand design system with tests and accessibility; no edits to F1 files.

**Domain parallel wave (after F0 + F1/F2 integration):**
- CAT: products, brands, categories, variants, SKU, sellability and media.
- INV: inventory, reservations, warehouses, adjustments, price changes and ledgers.
- SALE: orders, payment status, allowed cancellations/COD reconciliation and audit.
- CRM: customer views, quotes, line-item pricing, transitions and authorized conversion; preserve EX-07.4 cross-quote/atomicity guarantees.
- CONTENT: legal revisions, review/approval/publication, footer routes and published link invalidation; preserve current publication version/alerts.
- IAM: users, roles, permissions, settings, audit and 2FA. Mask secrets and sensitive PII.
- LOG: shipping, tracking, notification records, retries only as authorized; keep real provider gates blocked.
- CONTROL: dashboard KPIs, operational alerts, reports and verified CSV/PDF export.

Every lane owns only its own routes/components/features. If shared code changes are required, stop and assign them to F1/F2/orchestrator rather than having two agents edit one file. Codex agents never commit, push, merge or update STATE; orchestrator independently validates and integrates.

## Acceptance: a functional action, not a declaration

A capability is WIRED_VERIFIED only after an authorized operator triggers a real backend endpoint with a valid payload, the result persists, the screen reflects it after reload, audit is recorded and 401/403/validation/concurrency/failure cases are handled. Each of 71 declared actions must have a recorded disposition: WIRED_VERIFIED, BLOCKED_PROVIDER, BLOCKED_DECISION, REMOVED_WITH_APPROVED_RATIONALE or NOT_TESTED. NOT_TESTED actions cannot be treated as completed.

UI sections must distinguish EMPTY_SUCCESS, LOADING, NETWORK_ERROR, SERVER_ERROR, AUTH_REQUIRED, FORBIDDEN, BUSINESS_DECISION_BLOCKED, PROVIDER_BLOCKED and SUCCESS. No fallback to synthetic zero sales, fake tracking, fictitious successful emails, unapproved payment approval or hidden PII disclosure.

## Browser QA, negative tests and release gates

Browser/test subagent independently verifies 42/42 routes (including redirects), action-to-API flows, different roles, login/2FA/session expiration, real persistence in verified disposable PostgreSQL16/Redis7, critical business invariants, import/export/download PDF and CSV, CSV injection protection, redaction, user-impact and rollback. Test responsive screenshots and keyboard/a11y. Record tests/evidence tied to exact candidate SHA; a screenshot or build alone does not prove functionality.

Independent challenger reviews the complete diff for architectural leakage, unguarded API operations, dead controls, false readiness, security/PII/RBAC, broken content publication and operator usability. No P1/P2 technical issue may be hidden by suppressing tests.

Require frontend lint/typecheck/test/build, relevant backend/critical E2E, reproducible browser suite, dependency/security baseline and Gitleaks. PR merges require exact-head 7/7 GitHub checks, branch zero behind main, independent orchestrator approval and a separate docs-only STATE transition.

## Explicit open fences

Keep EX-06 and EX-07 parent BLOCKED_DECISION items, all SEC/GOV obligations, all BLOCKED_PROVIDER statuses, and event-bus held/cutover_pending unchanged. External 99 Envíos, payment, email and WhatsApp providers need separate approved sandbox/production work. EX-08 may present blockers accurately; it does not turn blocked business functionality into a production-ready feature or close EX-09–EX-12.

**Exit:** operator workflows with browser evidence, no dead/fake actions, stable real backend wiring, approved user impact and rollback, full relevant gates and governed merge. Completion of EX-08 does not imply production GO.


## Bounded QA reset closure before browser integration
The separately reviewed test-only PR53 merged 8b9eba627c2c7190284c303d23550cdd14d25b44 after seven exact-head CI38102079752 PASS on 6295637488855fd4e90cd2f6cc9aa13938f7a393,zero behind main,scope6. ROOT315unit/262critical/90E2E/214front/22guards PASS; CI266critical includes4guards. Existing reset limits/assertions/business/helper algorithms are preserved except seven mapper lines for actual Prisma P2010 SQLSTATE. Full evidence and failed attempts: EX-08.QA-test-db-closure.md. This closes only bounded reset recovery. Reproducible browser integration and all domain acceptance remain required; no71-action certificate or production GO. User approved media authority: existing-resource registry plus audited authorized-editor approval; implementation remains pending under separate ownership.


## Bounded reproducible browser entry closed

QA browser product PR55 merged ae9d3aef6cb3e994252c9d00946e49ff46c39cd2 after seven checks on exact35cb0fea8326886ae1e33c8496e21614894e89bd,run38122289650,scope23,behind0 and independent ROOT/challenger PASS. Remote262 critical plus4 guards,42 isolation and5 actual browser cases PASS; original first-head6/7 failure retained. Separate STATE candidate still requires seven exact-head controls. The runner is available for domain acceptance; no complete42-route/71-action certification or production GO follows. Continue frozen CAT/media, INV/CSV/UI, CRM and combined CONTENT/public legal acceptance; SALE owns separate frontscope and real contracts. Full evidence: EX-08.QA-browser-closure.md.


## Catálogo y autoridad de medios: cierre acotado

ProductoPR57 merged36c6ee31b63d45f71a35ef5bc7acdc410159d1fb con siete44a4f5e/CI38126635018,behind0,scope55,independiente0P0P1P2. ROOT22gruposCAT99BFF y9medios/navegación prueban13acciones A04-A16; matriz71 cambia sólo su current_status a WIRED_VERIFIED,58 restantes conservan DECLARED_ONLY_NOT_BROWSER_OR_API_CERTIFIED. Se documenta registro26 y aprobación específica auditada, permiso variantes separado y antiguosP2/logs preservados. Paginación sigue siendo vista de overview, escriturasproducto/variante secuenciales con recuperación; no backendcursor ni transacción ficticia. EX08padreACTIVE,42workflows completos y restantesdominios pendientes. Siguiente INVENTORY V6+CSV+UI, CONTENTV7/proyección, SALE y CRM correcciones bajo ownership; IAM/LOG/CONTROL después. Cadaproducto+STATE exige sus propios siete exact-head; producciónNO-GO/SEC/GOV/providers/decisiones/held/cutover intactos. Cierre detallado EX-08.CAT-closure.md.


EX-08.SESSION.RECOVERY productPR59 closed ac002cc after seven5ec9/38133193706 and independent ROOT source/gates/challenger. ROOT320unit263critical90E2E288frontend,5original+2naturalexpiry/logout401 browser. Historical blocked NextLink browser was not reproduced independently; unit regression and real recovery pass, unique cause NOT_VERIFIED. No additional declared action certified:13CAT/58pending unchanged. Continue fresh-main INVENTORY68 before SALE/CRM shared-controller deltas; CONTENT39V2, IAM and CONTROL frozen ownership/evidence and remaining LOG. Each closure uses product and separate STATE PR with seven exact-head; SEC/GOV/providers/business decisions/held/cutover/production NO-GO unchanged.
