# EX-03 — Architecture First Seam

## Execution status

**EX03_LOCAL_READY_FOR_AUDIT** — local gates for this bounded seam are complete. This is not an EX-03-wide architecture closure: the architecture checker still reports pre-existing debt outside the selected use case. No commit, push, merge, `STATE.json` edit, or EX-02 worktree edit was made.

## Isolation and baseline

- Worktree: `/home/wundah/distritoolsjl-ex03`
- Branch: `architecture/ex03-boundary-2026-10`
- Base and current `HEAD`: `292a37912248c1ea08c2a04e3410978fec2380b5` (`origin/main` at execution start)
- EX-02 remains in `/home/wundah/distritoolsjl`, branch `ci/validate-release-gates-2026-10`; its local changes were not accessed or modified.
- EX-03 worktree was clean at entry. Dependencies were installed from the checked-in lockfile with `npm ci`.
- Test services used a dedicated Compose project (`ex03`) and alternate loopback ports 55449/56389 because standard test ports were occupied. Only the EX-03-owned test containers were started; no shared development or production database/provider was used.

## Baseline evidence before implementation

| Gate | Baseline result |
|---|---|
| `npm run architecture:check` | **DEBT_DETECTED**. Direct Prisma coupling in application write paths, direct Prisma controllers, a 2,915-line admin controller, and `as never` casts. |
| `DATABASE_URL=<local test placeholder> npm run prisma:validate` | **PASS** |
| `npm run typecheck` | **PASS** after lockfile install; the initial empty-worktree global tool resolution was discarded. |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** |
| Unit/security tests | **PASS**, 26/26 |
| Critical inventory/order/payment suites | **PASS**, 17/17 across `inventory-enterprise.e2e.test.ts` and `inventory-orders-payments.e2e.test.ts` |

## Direct Prisma use inventory

Inventory method: `rg -l 'PrismaService|PrismaClient|@prisma/client|\\.\\$transaction' src --glob '*.ts'`. This is a source-level inventory, including generated Prisma types/enums and seeds, not a claim that every listed file issues a runtime query. Counts at baseline: **45 application, 17 domain, 37 infrastructure, 4 shared/other**.

### Application — 45 files; highest risk is direct `PrismaService` in use cases

- `src/modules/analytics/application/use-cases/get-admin-dashboard.use-case.ts`
- `src/modules/analytics/application/use-cases/get-admin-reports.use-case.ts`
- `src/modules/analytics/application/use-cases/get-operational-metrics.use-case.ts`
- `src/modules/brands/application/use-cases/create-brand.use-case.ts`
- `src/modules/brands/application/use-cases/update-brand.use-case.ts`
- `src/modules/inventory/application/use-cases/adjust-stock.use-case.ts`
- `src/modules/inventory/application/use-cases/apply-inventory-import.use-case.ts`
- `src/modules/inventory/application/use-cases/close-inventory-count-session.use-case.ts`
- `src/modules/inventory/application/use-cases/commit-stock.use-case.ts`
- `src/modules/inventory/application/use-cases/create-inventory-count-session.use-case.ts`
- `src/modules/inventory/application/use-cases/dry-run-inventory-import.use-case.ts`
- `src/modules/inventory/application/use-cases/export-inventory.use-case.ts`
- `src/modules/inventory/application/use-cases/get-inventory-alerts.use-case.ts`
- `src/modules/inventory/application/use-cases/get-inventory-overview.use-case.ts`
- `src/modules/inventory/application/use-cases/get-inventory-valuation.use-case.ts`
- `src/modules/inventory/application/use-cases/get-reservations.use-case.ts`
- `src/modules/inventory/application/use-cases/get-stock-movements.use-case.ts`
- `src/modules/inventory/application/use-cases/get-warehouses.use-case.ts`
- `src/modules/inventory/application/use-cases/process-return.use-case.ts`
- `src/modules/inventory/application/use-cases/release-stock.use-case.ts`
- `src/modules/inventory/application/use-cases/reserve-stock.use-case.ts`
- `src/modules/inventory/application/use-cases/update-count-session-lines.use-case.ts`
- `src/modules/inventory/application/use-cases/update-inventory-settings.use-case.ts`
- `src/modules/notifications/application/use-cases/send-notification.use-case.ts`
- `src/modules/orders/application/use-cases/cancel-order.use-case.ts`
- `src/modules/orders/application/use-cases/create-order.use-case.ts`
- `src/modules/payments/application/use-cases/create-payment-intent.use-case.ts`
- `src/modules/payments/application/use-cases/process-payment-webhook.use-case.ts`
- `src/modules/products/application/use-cases/archive-product.use-case.ts`
- `src/modules/products/application/use-cases/create-product.use-case.ts`
- `src/modules/products/application/use-cases/evaluate-product-sellability.use-case.ts`
- `src/modules/products/application/use-cases/get-catalog-operations.use-case.ts`
- `src/modules/products/application/use-cases/set-product-status.use-case.ts`
- `src/modules/products/application/use-cases/update-product.use-case.ts`
- `src/modules/search/application/use-cases/reindex-content.use-case.ts`
- `src/modules/search/application/use-cases/reindex-variants.use-case.ts`
- `src/modules/shipping/application/services/auto-shipping-infra.service.ts`
- `src/modules/shipping/application/services/auto-shipping-provider.service.ts`
- `src/modules/shipping/application/services/auto-shipping.service.ts`
- `src/modules/shipping/application/use-cases/create-shipment.use-case.ts`
- `src/modules/shipping/application/use-cases/shipment-read.use-case.ts`
- `src/modules/shipping/application/use-cases/shipment-write.use-case.ts`
- `src/modules/stock-movements/application/use-cases/list-stock-movements.use-case.ts`
- `src/modules/variants/application/use-cases/create-variant.use-case.ts`
- `src/modules/variants/application/use-cases/update-variant.use-case.ts`

### Domain — 17 files; generated client type coupling

- `src/modules/brands/domain/entities/brand.entity.ts`
- `src/modules/brands/domain/repositories/brand.repository.ts`
- `src/modules/brands/domain/services/brand-policy.service.ts`
- `src/modules/content/domain/entities/content-block.entity.ts`
- `src/modules/inventory/domain/repositories/inventory.repository.ts`
- `src/modules/notifications/domain/entities/notification.entity.ts`
- `src/modules/notifications/domain/repositories/notification.repository.ts`
- `src/modules/notifications/domain/services/notification-template.service.ts`
- `src/modules/orders/domain/entities/order.entity.ts`
- `src/modules/orders/domain/repositories/order.repository.ts`
- `src/modules/products/domain/repositories/product.repository.ts`
- `src/modules/products/domain/services/catalog-sellability.service.ts`
- `src/modules/products/domain/services/product-policy.service.ts`
- `src/modules/promotions/domain/entities/promotion.entity.ts`
- `src/modules/promotions/domain/services/promotion-evaluator.service.ts`
- `src/modules/stock-movements/domain/entities/stock-movement.entity.ts`
- `src/modules/stock-movements/domain/repositories/stock-movement.repository.ts`

### Infrastructure — 37 files; expected adapter/seed usage plus controller leakage

- `src/modules/admin-operations/infrastructure/http/controllers/admin-operations.controller.ts`
- `src/modules/analytics/infrastructure/repositories/prisma-analytics.repository.ts`
- `src/modules/auth/infrastructure/repositories/prisma-audit.repository.ts`
- `src/modules/auth/infrastructure/repositories/prisma-auth-session.repository.ts`
- `src/modules/auth/infrastructure/repositories/prisma-auth-user.repository.ts`
- `src/modules/brands/infrastructure/repositories/prisma-brand.repository.ts`
- `src/modules/brands/infrastructure/seeds/brand-taxonomy.seed.ts`
- `src/modules/categories/infrastructure/repositories/prisma-category.repository.ts`
- `src/modules/categories/infrastructure/seeds/category-taxonomy.seed.ts`
- `src/modules/content/infrastructure/repositories/prisma-content.repository.ts`
- `src/modules/inventory/infrastructure/http/controllers/inventory.controller.ts`
- `src/modules/inventory/infrastructure/repositories/prisma-inventory-reference.repository.ts`
- `src/modules/inventory/infrastructure/repositories/prisma-inventory.repository.ts`
- `src/modules/notifications/infrastructure/repositories/prisma-notification.repository.ts`
- `src/modules/order-items/infrastructure/repositories/prisma-order-item.repository.ts`
- `src/modules/orders/infrastructure/providers/prisma-tracking.provider.ts`
- `src/modules/orders/infrastructure/repositories/prisma-order-variant.repository.ts`
- `src/modules/orders/infrastructure/repositories/prisma-order.repository.ts`
- `src/modules/payments/infrastructure/repositories/prisma-payment.repository.ts`
- `src/modules/permissions/infrastructure/repositories/prisma-permission-role-reference.repository.ts`
- `src/modules/permissions/infrastructure/repositories/prisma-permission.repository.ts`
- `src/modules/permissions/infrastructure/repositories/prisma-role-permission.repository.ts`
- `src/modules/products/infrastructure/http/controllers/products.controller.ts`
- `src/modules/products/infrastructure/repositories/prisma-product.repository.ts`
- `src/modules/products/infrastructure/seeds/master-product-catalog.seed.ts`
- `src/modules/promotions/infrastructure/repositories/prisma-promotion.repository.ts`
- `src/modules/roles/infrastructure/http/controllers/roles.controller.ts`
- `src/modules/roles/infrastructure/repositories/prisma-role-user-assignment.repository.ts`
- `src/modules/roles/infrastructure/repositories/prisma-role.repository.ts`
- `src/modules/search/infrastructure/repositories/prisma-search.repository.ts`
- `src/modules/stock-movements/infrastructure/http/controllers/stock-movements.controller.ts`
- `src/modules/stock-movements/infrastructure/repositories/prisma-stock-movement.repository.ts`
- `src/modules/users/infrastructure/http/controllers/users.controller.ts`
- `src/modules/users/infrastructure/repositories/prisma-admin-user.repository.ts`
- `src/modules/users/infrastructure/repositories/prisma-role-reference.repository.ts`
- `src/modules/variants/infrastructure/repositories/prisma-variant.repository.ts`
- `src/modules/webhooks/infrastructure/repositories/prisma-webhook-receipt.repository.ts`

### Shared/other — 4 files

- `src/common/guards/permissions.guard.ts`
- `src/infra/db/prisma/prisma.module.ts`
- `src/infra/db/prisma/prisma.service.ts`
- `src/infra/monitoring/monitoring.controller.ts`

### Risk ranking and debt

1. **Critical write paths:** inventory reserve/release/commit/adjust/return/import/count; order create/cancel; payment intent/webhook. Application use cases directly depend on `PrismaService` and/or own interactive transaction boundaries. Errors here can violate stock/order/payment invariants or replay semantics.
2. **Security/auth:** `src/common/guards/permissions.guard.ts` queries persistence at the shared guard boundary; user/role controllers directly depend on Prisma; auth/session/audit repositories otherwise isolate persistence as expected.
3. **Shipping:** create/read/write and auto-shipping application services directly access Prisma; provider/API work remains explicitly out of this seam.
4. **Controller seams:** `admin-operations.controller.ts` imports Prisma and is 2,915 lines; `roles.controller.ts` and `users.controller.ts` also directly inject Prisma. Splitting them is explicitly deferred to avoid a broad rewrite.
5. **Other direct application coupling:** analytics, catalog, search, notification, variant and brand use cases directly use Prisma.
6. **Domain client coupling:** domain entities/repositories/services import generated Prisma types/enums; `InventoryRepository` transaction methods accept `Prisma.TransactionClient`. This seam removes runtime `PrismaService` ownership from one use case but intentionally does not solve the broader type leak.
7. **Unsafe casts:** `as never` remains in inventory cost conversion; shipping controller quote body; auto-shipping services; shipment create/read/write/webhook persistence. They require separate contract/type-specific work; none changed here.

## Selected seam and implementation

**Selected:** `AdjustStockUseCase`, the manual inventory write path, already composed inventory, stock-movement and audit repositories but injected `PrismaService` solely to open `$transaction`. It is a smaller and safer boundary than order/payment redesign or splitting the admin controller.

- Added `InventoryRepository.withTransaction(operation)` as the transaction entry point.
- Implemented delegation to `PrismaService.$transaction` in `PrismaInventoryRepository`.
- Changed `AdjustStockUseCase` to run its existing lock, idempotency lookup, inventory update/create, and movement writes through that port; removed its direct `PrismaService` injection.
- Added `tests/unit/inventory-transaction.repository.unit.test.ts` to assert one transaction delegation and result propagation.
- No schema/migration, HTTP/API/DTO, provider, checkout/payment, stock invariant, transaction contents, or dependency change.

Architecture check baseline contained three `ARCH-001` matches for `AdjustStockUseCase` (Prisma import/injection sites); final check has zero findings for that file. Overall findings decreased **124 -> 121**. `npm run architecture:check` remains nonzero because unrelated pre-existing findings remain; this is recorded as **DEBT_DETECTED**, not represented as a global PASS.

## Validation evidence

| Gate | Result |
|---|---|
| `DATABASE_URL=<local test placeholder> npm run prisma:validate` | **PASS** |
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** |
| New transaction boundary unit test | **PASS**, 1/1 |
| All unit/security tests including new test | **PASS**, 27/27 |
| Targeted critical inventory/order/payment suites | **PASS**, 17/17 |
| `npm run test:critical` on isolated EX-03 Postgres 16/Redis 7 | **PASS**, 14 files / 83 tests |
| `gitleaks git --redact .` | **PASS**, 83 commits scanned, zero leaks |
| `gitleaks dir --redact src` | **PASS**, zero leaks |
| `git diff --check` | **PASS** |
| `npm run architecture:check` | **DEBT_DETECTED**, 121 unrelated remaining findings; selected use-case finding removed |

The critical suite logs expected injected-failure diagnostics in a failure-injection scenario; its assertions pass. The test-run-generated `.env.test` and local 2FA reset fixture were removed after validation. Do not scan or disclose their contents. Gitleaks scans of `src`, the new unit test, and this run record report zero leaks.

## Independent reviewer/challenger

`codex review --uncommitted` reviewed the change and reported no actionable findings. It independently confirmed that the transaction boundary preserves Prisma transaction delegation and the unit test/typecheck pass. Its note that integration tests were not executed by the reviewer is distinct from executor evidence: the executor ran `npm run test:critical` and verified 14 files / 83 tests passing from the captured log.

## User impact, rollback, and residual risk

- User impact: **NONE_EXPECTED**. HTTP/API behavior, permissions, audit payload, transaction placement and business rules remain unchanged.
- Rollback: revert only the three source edits and remove the added focused unit test; no data or migration rollback is needed.
- Residual architecture debt: Prisma transaction type remains part of the inventory persistence port; other use cases, security boundaries, admin controllers, and unsafe casts remain untouched and need separately scoped EX-03 seams.
- No external provider credentials or calls were used.

## Final handoff

**EX03_LOCAL_READY_FOR_AUDIT**. Worktree and uncommitted diff are intentionally retained for orchestrator audit. No commit, push, merge, or `STATE.json` update was performed; `active_execution` remains EX-02.
