# EX-03 Next Architectural Seam Analysis

## Status

**EX03_NEXT_SEAM_ANALYSIS_READY** — discovery only; no source implementation. This artifact is the only intended worktree change. No schema, `STATE.json`, `USER_IMPACT_LOG.md`, commit, push, or merge was changed/performed.

## Baseline and preservation

- Analysis worktree: `/home/wundah/distritoolsjl-ex03-nextseam`
- Branch: `analysis/ex03-next-seam-2026-10`
- Base/current `HEAD`: `292a37912248c1ea08c2a04e3410978fec2380b5` (`origin/main`)
- `origin/main` was fetched and verified at the same SHA before creating this worktree.
- Baseline tree was clean. The existing EX-03 worktree `/home/wundah/distritoolsjl-ex03` remains untouched at `1715b43d57070d09d26a99be1e1e04c6508fd8c7`.
- Prior EX-03 report was consulted only for context: its first seam is `AdjustStockUseCase`; that implementation is not in this fresh `origin/main` snapshot and was not changed or stacked here.

## Selected next seam

**Payment webhook finalization transaction orchestration** in `src/modules/payments/application/use-cases/process-payment-webhook.use-case.ts` (especially lines 84–186).

This is the highest-risk bounded write-path seam identified after the already-audited manual stock adjustment: one transaction claims an idempotency receipt and coordinates payment finalization, order transition, and stock commit/release. A partial commit can misstate payment/order state or consume/release stock incorrectly. Existing critical tests already encode replay and cancellation-race invariants, making behavior-preserving extraction testable.

### Exact current Prisma ownership and transaction propagation

| File | Current Prisma usage / responsibility |
|---|---|
| `src/modules/payments/application/use-cases/process-payment-webhook.use-case.ts` | Imports/injects `PrismaService` (lines 7, 56–57) and opens `$transaction` (99–186). Within it calls receipt claim/processed, payment lookup/update, order/order-items lookup/update, and commit/release stock. Signature verification and parsing happen before the transaction; audit and domain events publish after commit (192 onward). |
| `src/modules/webhooks/domain/repositories/webhook-receipt.repository.ts` | All receipt operations accept `PrismaTransactionClient` (12–28), including atomic `createIfAbsent` and `markProcessed`. |
| `src/modules/webhooks/infrastructure/repositories/prisma-webhook-receipt.repository.ts` | Adapter implements receipt claim using `createMany(skipDuplicates: true)` plus unique-key read (29–59), and marks processed through the supplied transaction (61–68). Unique key is `(gateway, externalEventId)`. |
| `src/modules/payments/domain/repositories/payment.repository.ts` | Payment lookup accepts optional transaction; create/update require `PrismaTransactionClient` (27–39). |
| `src/modules/orders/domain/repositories/order.repository.ts` | Order lookup accepts optional transaction; update status requires transaction (interface inspected in baseline source). |
| `src/modules/order-items/domain/repositories/order-item.repository.ts` | Order-item lookup accepts optional transaction; used with `tx` in this workflow. |
| `src/modules/inventory/application/use-cases/commit-stock.use-case.ts` | Direct `PrismaService` transaction fallback (45–46, 158–160); webhook supplies its transaction to lock inventory, enforce commit invariant, update quantities, and append a commit movement (68–160). |
| `src/modules/inventory/application/use-cases/release-stock.use-case.ts` | Direct `PrismaService` transaction fallback (45–46, 156–158); webhook supplies its transaction to lock inventory, enforce release invariant, update reserved quantities, and append a release movement (68–158). |
| `src/modules/inventory/domain/repositories/inventory.repository.ts` | Defines the `PrismaTransactionClient` type currently shared across domain repository contracts; this is an existing Prisma type leak, not a reason to broaden this seam. |

### Proposed boundary (analysis only)

Introduce a narrow application-facing transaction runner for payment webhook finalization, e.g. `PAYMENT_WEBHOOK_UNIT_OF_WORK` with `run<T>(work: (tx: PaymentWebhookTransaction) => Promise<T>): Promise<T>`, and a Prisma infrastructure adapter that owns `$transaction` and its existing `maxWait: 15000` / `timeout: 30000` options. Bind it in `PaymentsModule` or a shared persistence module according to existing provider ownership.

Keep the current transaction callback ordering and pass exactly one transaction context through receipt claim, payment/order reads and writes, order-item read, and inventory commit/release. The application use case should no longer inject `PrismaService` or call `$transaction` directly. Avoid changing state policy, transaction isolation, retries, receipt schema, event transport, or audit/event timing in this seam. The transaction context may initially wrap the current Prisma transaction-client type to minimize behavior change; replacing that shared type is a separate architectural decision.

Likely implementation files, subject to orchestrator scope approval:

- Modify `src/modules/payments/application/use-cases/process-payment-webhook.use-case.ts`.
- Add a payment-application transaction port under `src/modules/payments/application/ports/` (or use an already-approved shared unit-of-work port if one exists at implementation time).
- Add a Prisma adapter under `src/modules/payments/infrastructure/` that owns transaction creation/options.
- Modify `src/modules/payments/payments.module.ts` for DI binding.
- Add focused unit coverage under `tests/unit/` for delegation, result propagation, and rollback/error propagation.
- Extend existing critical integration suites only if a seam-level assertion is missing; do not relax current assertions.

No file outside the chosen seam should change absent evidence that a required invariant cannot be tested otherwise.

## Behavioral invariants to preserve

1. Verify webhook signature before parsing or writing a receipt; invalid signatures return unauthorized and persist no receipt.
2. Claim `(gateway, externalEventId)` atomically. Exactly one concurrent delivery is non-idempotent; duplicate deliveries return idempotent success and cause no second state or stock effect.
3. Receipt claim, payment transition, order transition, stock movement/quantity changes, and `processedAt` commit or roll back together.
4. Only a pending payment can finalize. A failed validation or any transactional write failure leaves no receipt marked processed and no partial payment/order/inventory mutation.
5. Approved status commits reserved stock once and transitions payment to approved/order to paid.
6. Rejected/expired status releases reserved stock once, transitions payment to rejected/expired respectively, and order to cancelled, preserving current semantics.
7. Stock locking, non-negative/reservation invariants, movement references, and commit/release idempotency remain unchanged.
8. Preserve current transaction `maxWait`/`timeout`; do not add retries or weaken the webhook’s fail-closed signature behavior.
9. Audit and domain-event publication remain post-commit in this seam. Their existing failure/replay semantics are a separate EX-04/outbox concern and must be documented, not silently changed here.

## Tests and evidence to require for a future implementation

Existing tests provide direct acceptance anchors:

- `tests/critical/inventory-orders-payments.e2e.test.ts:389–458`: approved webhook commits stock exactly once; replay returns `idempotent: true`; payment/order/stock persisted values are verified.
- `tests/critical/inventory-orders-payments.e2e.test.ts:460–470`: invalid signature is rejected.
- `tests/critical/inventory-orders-payments.e2e.test.ts:473–528`: rejected payment releases stock and cancels order.
- `tests/critical/concurrency-stress.e2e.test.ts:199–255`: ten concurrent duplicate deliveries yield one applied result, nine idempotent results, and one commit movement.
- `tests/critical/concurrency-stress.e2e.test.ts:257–299`: order cancellation racing approved webhook ends in an allowed terminal state.

Future boundary tests should prove: transaction runner called once; callback receives one context; success result propagates; callback rejection propagates and causes rollback; configured Prisma transaction options are retained. Run focused payment/webhook tests, the full critical suite (14 files / 83 tests at current baseline), unit/security tests, and normal static/build gates after implementation. Do not represent these tests as run for this analysis artifact.

## Why this is next; alternatives deferred

- **Why webhook finalization:** it is a cross-module, externally triggered write with deduplication and inventory side effects. The direct `$transaction` call owns a correctness boundary, not merely persistence convenience. The current race and replay tests make regressions observable.
- **Why not `CreateOrderUseCase` first:** it is also high risk (reservation + order + items atomicity) and remains a strong subsequent seam. Webhook finalization additionally includes external-event identity and payment terminal transitions, so duplicate or partial processing has broader financial and stock impact.
- **Why not `CancelOrderUseCase` first:** it coordinates cancellation and reservation release and has a race test, but narrower consequences and less external replay complexity than payment webhook finalization.
- **Why not another inventory-only use case:** reserve/release/commit are important, but their transaction lifecycle is already invoked as a composable operation with optional `tx`; next priority should exercise a distinct cross-domain boundary rather than repeat the same manual-adjustment shape.

## Risks and hard stops

- The transaction-client type currently originates from the inventory domain and is consumed by payment and webhook contracts. Do not expand this seam into broad type relocation without a separately approved boundary plan.
- Unique receipt insertion relies on database uniqueness and `skipDuplicates`; preserve concurrent behavior and verify it against isolated PostgreSQL, not an in-memory substitute.
- Post-commit audit/event failure can leave a processed receipt without successful downstream publication; this is existing observed control flow (192 onward), not addressed by this transaction extraction. Track separately with EX-04/outbox scope.
- The test gateway is `mock`; no real payment provider call is part of implementation or validation.
- Stop if preserving atomicity requires schema/data migration, changing externally visible responses, changing payment state rules, introducing provider calls, or weakening replay/race tests.

## Rollback

This is analysis only; rollback is removal of this single run-record file. A future implementation should be limited to the transaction port, adapter, DI binding, use-case injection, and tests; rollback would restore the direct Prisma transaction call and remove those additions. No schema or data rollback is expected if the proposed no-migration boundary is maintained.

## Commands and verification evidence

- `git fetch origin` — **PASS**; `origin/main` resolved to `292a37912248c1ea08c2a04e3410978fec2380b5`.
- `git worktree add /home/wundah/distritoolsjl-ex03-nextseam -b analysis/ex03-next-seam-2026-10 origin/main` — **PASS**.
- `git status --short --branch` at baseline — **PASS**, clean analysis branch tracking `origin/main`.
- Targeted source review: `rg -n "PrismaService|prisma\\.(...)|\\$transaction" src/modules/{inventory,orders,payments}` and numbered reads of webhook use case, receipt/payment/order repositories, inventory commit/release use cases, and critical tests — **PASS**; exact evidence is referenced above.
- Prior EX-03 context read from `/home/wundah/distritoolsjl-ex03/docs/orchestration/runs/EX-03-architecture-first-seam.md`; that worktree remained clean and unchanged.
- `git diff --check` — to be run after this artifact is written.
- No tests/build/security gates were run; no source implementation was in scope (**NOT_TESTED**).
