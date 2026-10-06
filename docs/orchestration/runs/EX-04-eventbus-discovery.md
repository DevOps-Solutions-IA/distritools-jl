# EX-04 — Event Bus / BullMQ Discovery

**Status:** `EX04_ANALYSIS_READY` (discovery only; no runtime implementation)
**Branch:** `analysis/ex04-eventbus-2026-10`
**Worktree:** `/home/wundah/distritoolsjl-ex04-analysis`
**Base:** `origin/main` at `292a37912248c1ea08c2a04e3410978fec2380b5` (`ci: enforce enterprise release gates (#13)`)
**Impact:** `NONE_EXPECTED` — documentation only. No provider calls or credentials used.

## Executive findings

1. `DOMAIN_EVENT_PUBLISHER` resolves to `InMemoryDomainEventPublisher`, not BullMQ. `BullMqDomainEventPublisher` and `DomainEventsWorker` are registered but are not the runtime publisher path.
2. The in-memory publisher synchronously invokes listeners with `Promise.all`; it is process-local, non-durable, and listener errors propagate to the caller.
3. `DomainEventsWorker` has an empty handler map in the inspected tree. No `registerHandler()` call exists. A BullMQ `domain-events` job therefore logs a warning and returns successfully, losing the event from the consumer's perspective.
4. Notifications are the only subscriber path that hands work to a BullMQ queue. Search reindexing runs inline from in-memory subscriptions. The notification event consumer persists a notification row and then separately enqueues a job; these writes are not atomic.
5. Business writes/transactions, audit writes, and domain-event publication are separate operations. There is no generic event outbox/inbox model or migration in the inspected schema. Failures can produce committed business state with missing events, or a failed request after the mutation already committed.
6. Current tests prove notification happy/failure behavior and search reindexing, but do not exercise the BullMQ domain-event worker, Redis outage/recovery, queue retry/dead-letter policy, duplicate domain-event delivery, or transaction-to-publish failure windows.

## Topology and injection

| Concern | Observed implementation | Evidence | Assessment |
|---|---|---|---|
| Event contract | `DomainEvent` carries optional `eventId`, `eventName`, `eventVersion`, `payload`, `occurredAt`, optional `correlationId`; publisher has only `publish()` | `src/common/events/domain-event.publisher.ts` | No typed event-name registry, aggregate sequence, or consumer contract. |
| Runtime token binding | `DOMAIN_EVENT_PUBLISHER` uses existing `InMemoryDomainEventPublisher` | `src/infra/events/in-memory-domain-event.publisher.ts` (`DomainEventsModule`) | In-memory is active for all injected use cases, including production configuration. |
| In-memory publisher | EventEmitter; creates UUIDv7 when no ID supplied; logs safe envelope metadata; awaits all matching listeners | same file | At-most-process-lifetime delivery; no persistence/replay. Listener rejection rejects publish. |
| BullMQ domain publisher | Adds `eventName` job to `domain-events`, job ID = event ID (new UUIDv7 if absent), attempts 3, exponential backoff 2s, retains last 100 completed/50 failed | `src/infra/events/bullmq-domain-event.publisher.ts` | Adapter exists, but no default DI binding/use was found. No explicit DLQ. |
| Domain worker | `@Processor('domain-events')`, dispatches through an in-memory map; absent handler logs warning and returns | `src/infra/events/domain-events.worker.ts` | No `registerHandler()` callers found: events on this queue are silently acknowledged without processing. |
| Queue bootstrap | BullMQ root connection uses `REDIS_URL` or `redis://localhost:6379`; registers `auth` and `domain-events` | `src/infra/queue/bullmq.module.ts` | No explicit connection retry, readiness, limiter, prefix, or stalled-job policy in app config. |
| App bootstrap | Imports DomainEventsModule and BullQueueModule unconditionally | `src/app/app.module.ts` | Worker/queue construction can make app startup dependent on Redis availability; startup/outage behavior is not explicitly tested. |
| Notification queue | `notifications` queue registered by `NotificationsModule`; queue job has `jobId=notification.id`, attempts 3, no explicit backoff, retains 50 complete/failed | `src/modules/notifications/application/use-cases/queue-notifications-from-event.use-case.ts` | Persisted notification key helps queue idempotency only after the notification record exists. No DLQ/alert policy is explicit. |
| Notification worker | `NotificationsProcessor` executes `SendNotificationUseCase` for `send-notification` | `src/modules/notifications/infrastructure/queue/notifications.processor.ts` | Real email/WhatsApp providers are not part of this discovery; module currently binds mocks. |
| Subscribers | `NotificationsEventSubscriber` and `SearchEventSubscriber` subscribe directly to in-memory publisher on module init | `src/modules/notifications/infrastructure/queue/notifications-event.subscriber.ts`; `src/modules/search/infrastructure/jobs/search-event.subscriber.ts` | Subscribers do not consume BullMQ `domain-events`. |
| Redis provider | Separate `RedisModule` creates a plain ioredis client from `REDIS_URL` and exposes it | `src/infra/cache/redis.module.ts` | No health signal or explicit failure/readiness semantics are defined there. BullMQ also configures its own connection. |
| Outbox/inbox | No generic outbox/inbox Prisma model/migration found. `Notification` has unique `(eventId, channel, recipient)`; `NotificationEvent` is operational notification/provider history, not a domain outbox. | `prisma/schema.prisma` (`Notification`, `NotificationEvent`) | No durable source-of-truth event record for generic consumers. |

## Producer → event → queue → consumer matrix

“Active route” is the actual current in-process route. “Bull route” describes what a job would do if manually added to `domain-events`.

| Producer | Event | Active route / consumer | Bull route / current consumer | Observed notes |
|---|---|---|---|---|
| `CreateOrderUseCase` | `order.created` | In-memory → Notifications subscriber → template → Notification row → `notifications` queue → `NotificationsProcessor` | `domain-events` worker has no registered handler | Payload includes email/phone, line items and totals; event is published after order transaction and audit. |
| `CreateGuestCheckoutOrderUseCase` | `checkout.guest_order_created` | In-memory; no matching notification/search subscriber | No handler | Separate from `order.created`, which is also emitted by delegated `CreateOrderUseCase`; no direct consumer for this event. |
| `CancelOrderUseCase` | `order.cancelled` | In-memory → Notifications subscriber → notification queue if email exists | No handler | DB transaction releases stock and updates order; audit/publish are afterward. |
| `ProcessPaymentWebhookUseCase` | `payment.approved`, `payment.rejected`, or `payment.expired` | In-memory → Notifications subscriber → notification queue for available email/phone templates | No handler | Payment/order/webhook receipt commit first; audit and event publication follow. |
| `ProcessPaymentWebhookUseCase` | `order.paid` | In-memory → Notifications subscriber, but template resolver has no `order.paid` case (no notification produced) | No handler | Published only on approved payment; subscriber registration alone does not create output. |
| `CreatePaymentIntentUseCase` | `payment.intent_created` | In-memory; no subscriber | No handler | No current consumer. |
| Product create/update/status/archive use cases | `product.created`, `product.updated`, `product.status_changed`, `product.archived` | Search subscriber reindexes created/updated/status; archive has no subscription | No handler | Indexing is synchronous; product archive does not trigger the listed search consumer. |
| Brand create/update/status use cases | `brand.created`, `brand.updated`, `brand.status_changed` | Search subscriber → reindex all variants | No handler | Broad synchronous full reindex for each event. |
| Category create/update/tree use cases | `category.created`, `category.updated`, `category.tree_updated` | Search subscriber → reindex all variants | No handler | Tree update publishes two events (`category.tree_updated`, then `category.updated`). |
| Variant create/update/status use cases | `variant.created`, `variant.updated`, `variant.status_changed` | Search subscriber → reindex single variant when `variantId` exists, otherwise all variants | No handler | Missing/invalid variant ID falls back to global reindex. |
| Content create/publish use cases | `content.published`, `content.unpublished` | Search subscriber → reindex content ID | No handler | `create-content-block` emits `content.published` even though creation defaults may not represent an explicit publish action; verify semantic contract in implementation phase. |
| Promotion create/status use cases | `promotion.activated`, `promotion.deactivated` | In-memory; no subscriber | No handler | No current consumer. |
| Auto-shipping service | `shipment.quote_created`, `shipment.carrier_selected`, `shipment.guide_created`, `shipment.auto_shipping_failed` | In-memory → Notifications subscriber → internal notification record + notifications queue | No handler | Failure stages emit from the service; no generic durable event record. |
| Inventory | `inventory.low_stock_detected` | Notifications subscriber has a registration and internal template | No producer of this exact event found in `src` | Currently a registered-but-unreachable path based on repository search. |

### Consumer event coverage

| Consumer | Subscribed event names | Effective behavior | Gaps |
|---|---|---|---|
| Notifications subscriber | `order.created`, `order.cancelled`, `order.paid`, `payment.approved`, `payment.rejected`, `payment.expired`, four `shipment.*` auto-shipping events, `inventory.low_stock_detected` | Resolve templates, create notification with unique event/channel/recipient, enqueue send job | `order.paid` resolves to no templates; `checkout.guest_order_created` is not subscribed; low-stock event has no producer; no domain event consumer in Bull worker. |
| Search subscriber | content published/unpublished; brand created/updated/status_changed; category created/updated/tree_updated; product created/updated/status_changed; variant created/updated/status_changed | Inline search-document reindex | Product archived unhandled; synchronous operation increases request latency and couples write success to indexing availability. |
| Bull domain worker | No handler registrations | Warn and return success for any event | All domain-event jobs are effectively dropped/acknowledged. |
| Notification processor | Queue job `send-notification` | Loads notification by ID and dispatches provider; marks sent/failed and writes audit | Retry re-executes dispatch. No provider-level idempotency key is passed by the port, so an ambiguous external-send timeout can duplicate delivery if a real provider is later bound. |

## Transaction boundary and dual-write map

| Flow | Database boundary | Audit boundary | Publish/enqueue boundary | Loss / partial-success window |
|---|---|---|---|---|
| Create order | Stock reservation + order + items are one Prisma transaction (`CreateOrderUseCase`) | Separate awaited audit write after transaction | Separate awaited in-memory publish after audit | Crash after transaction: order exists, event absent. Audit failure: committed order but no publish and request failure. Listener/Redis queue failure: committed order and audit but API can fail; checkout caller may not receive confirmation. |
| Guest checkout | Delegates to committed `CreateOrderUseCase`; later writes checkout audit | Separate | Publishes `checkout.guest_order_created`, then invokes auto-shipping | Failure on the second audit/event can reject response after order creation; failure publishing checkout event prevents subsequent auto-shipping call. |
| Cancel order | Release stock + order status update in one transaction | Separate after commit | Separate publish after audit | Commit can persist cancellation while event/notifications are absent; handler failure yields failed request after cancellation. |
| Payment webhook | Webhook receipt, payment state, order state, stock commit/release are one transaction; receipt key provides gateway + external-event id dedupe | Separate after commit | Payment event then possibly `order.paid`, sequential separate publishes | Crash after transaction can permanently suppress event on provider webhook replay because receipt is already processed; first event may publish and second fail. |
| Product/brand/category/variant/promotion/content mutations | Repository mutation(s), generally before publish and outside a shared outbox transaction | Separate audit writes where implemented | Separate event publish | DB mutation may commit before audit or event; retries may repeat effects. Category tree mutation publishes two separately awaited events. |
| Auto-shipping | Shipment/order changes handled in service/repository operations; event not in same DB transaction | `AutoShippingInfraService.audit()` separate call | `publish()` separate call | Existing shipment status can advance without event; event listener failures can surface after shipping state persisted. |
| Create notification from domain event | `Notification.createMany(skipDuplicates)` then lookup; unique `(eventId,channel,recipient)` | Separate audit after queue add | `notificationsQueue.add()` after DB insert | DB row can persist with no queue job if Redis fails; queue add can succeed and audit fail; retry may see `inserted=false` and skip enqueue, leaving queued row stranded. |
| Send notification | Provider call then DB mark sent; on thrown error mark failed | Separate audit | BullMQ retries whole processor | Provider can accept send but timeout before local mark; retry can send duplicate. Failed audit can itself turn processing into retry. |
| Search reindex | Reindex use case called inline after source mutation | Not coupled transactionally | No durable queue | Search failure propagates through in-memory `publish()` after source mutation; caller may see failure though catalog mutation persisted. |

## IDs, dedupe and delivery semantics

| Mechanism | Current behavior | Limitation |
|---|---|---|
| Domain `eventId` | Optional in contract. All inspected producers omit it. Each publisher generates UUIDv7 at publish time. | A retry/replay of the same business event gets a new ID; it is not a stable aggregate event identity. |
| Bull domain `jobId` | Equals `eventId` | Prevents duplicate enqueue only when the caller reuses the same ID and the prior job remains retained; generated IDs do not dedupe semantic retries. Completed jobs are retained only 100; failed 50. |
| Notification DB uniqueness | `(eventId, channel, recipient)` | Dedupe is tied to generated event ID, not order/payment/business key. Same logical event republished with a new UUID creates duplicate notification records. |
| Notification queue `jobId` | Notification row UUID | Avoids duplicate queue job for that row while BullMQ retains the ID, but a stranded existing DB row is not re-enqueued because `inserted=false` short-circuits. |
| Webhook idempotency | Unique gateway + external event ID receipt; side effect and receipt processing occur in one DB transaction | Stronger than general domain events, but emitted domain events are outside that transaction and are not recovered by webhook replay once receipt is processed. |
| Shipping idempotency | Auto-shipping logic has existing order/guide checks and provider idempotency key based on order (`auto-shipping:<orderId>`) | This protects that use case/provider path, not generic event consumers or notifications. |
| Consumer idempotency | Search reindex appears repeatable by design; notifications use DB uniqueness above | No generic consumer inbox/delivery ledger; no event-consumer processing status or replay cursor. |

## Redis outage and failure semantics

- Domain events currently dispatch in-process, so the generic `publish()` path itself does not require Redis. This does **not** make checkout independent of Redis: the notification subscriber synchronously writes a notification and calls the BullMQ `notifications` queue before in-memory `publish()` resolves.
- If Redis/queue add fails during `order.created`, the order transaction and audit have already committed. The queue subscriber rejects; `Promise.all` rejects; the order request can return an error after persistence. Guest checkout may not reach its later auto-shipping step.
- If Redis is unavailable during app bootstrap, BullMQ connections are still initialized unconditionally. No application-specific degraded-start/readiness behavior is defined or tested. Exact startup/reconnect behavior is not asserted in this repository and must be verified against the pinned BullMQ/ioredis runtime in EX-04 implementation tests, not assumed.
- `RedisModule` creates another independent ioredis connection. No health/readiness endpoint, queue-specific connectivity alert, or explicit bounded reconnect policy was found in these modules.
- In-memory events emitted while an instance is down are irrecoverably lost to its subscribers. There is no replay mechanism.
- Notification job add has 3 attempts configured, but an outage before the queue record is added leaves a durable Notification row and no job; retrying the same event does not repair it because duplicate insert returns `inserted=false` and skips enqueue.

## P0 failure modes (ranked)

| Priority | Failure mode | Evidence / impact | Required containment |
|---|---|---|---|
| P0 | Order/payment/catalog transaction commits but event is not persisted or delivered | Writes and publish separated; payment webhook receipt suppresses repeated event emission after commit | Transactional outbox for critical domain events, written in same DB transaction as aggregate mutation; relay retries independently. |
| P0 | Checkout/order request fails after order is already committed when synchronous subscriber or Redis enqueue fails | In-memory publisher awaits subscribers; order event subscriber hits notification DB + Redis queue | Decouple request path from downstream consumers. A persisted outbox acceptance should be the boundary; subscriber/queue outages must not erase order confirmation after commit. |
| P0 | Bull `domain-events` acknowledges events without consumer execution | Empty handler map, no registration callers, missing handler returns normally | Do not route production traffic to this queue until handlers are registered and missing handlers fail/retry/park rather than ack. |
| P0 | Duplicate notifications or external sends on retries/ambiguous timeouts | Fresh event UUIDs; provider send and markSent are separate; no external idempotency token | Stable event identity + consumer inbox; pass provider idempotency key where supported; reconcile uncertain sends rather than blind retry. |
| P1 | Notification record can be stranded with queued status | DB insert precedes Bull add; duplicate callback does not re-enqueue existing row | Outbox/queue dispatcher or repair scanner that safely enqueues eligible rows by stable notification ID. |
| P1 | Search indexing outage changes outcome of catalog mutation request and blocks user response | Reindex work is inline listener under `Promise.all` | Move search projection to retryable consumer; expose lag and dead-letter monitoring. |
| P1 | Unbounded/unclear Redis degraded mode and operational visibility | no custom health/retry/readiness policy in queue/cache modules | Define startup vs runtime outage policy, health, alerts, bounded retry and recovery behavior. |

## Retry, backoff, dead-letter proposal

This is a proposal, not implemented behavior:

1. Treat delivery as **at least once**. Use durable outbox rows with bounded lease/claim and retry metadata; never hold a database transaction open while calling Redis or a provider.
2. Use capped exponential backoff with jitter and classify retryable infrastructure/transient failures separately from terminal validation/contract errors. Keep attempts, next-attempt timestamp, last safe error code, and correlation ID.
3. After the bounded attempt policy, park the message in an explicit dead-letter state/queue with alerting and operator replay. Replay must preserve the original event ID and pass consumer dedupe.
4. Unknown event name or missing handler must not be silently acknowledged. Route to a contract-error/DLQ path (or fail processing with bounded retries then DLQ); alert on it.
5. Keep queue retention long enough for incident diagnosis/replay policy; current Bull retention of 100 completed/50 failed is not an operationally defined retention contract.
6. Notification provider retries need channel policy and provider idempotency support. Until a real provider and its semantics are approved, no real provider calls should be used to validate this proposal.

## Idempotency proposal

- Persist `eventId` in the outbox at the aggregate transaction boundary. Generate once per domain transition, not once per transport attempt.
- Add aggregate identity/version (or a unique event key such as aggregate type + ID + version + event name) to prevent accidental duplicate logical emission; do not use entity ID alone because entities can legitimately emit the same event type more than once.
- Use the same persisted event ID as BullMQ `jobId` and preserve it across relay retries/replays.
- Add consumer inbox/delivery record unique on `(consumerName, eventId)` with status/attempt timestamps; claim and completion must be concurrency-safe. Consumer side effects and inbox completion should share a DB transaction when both are DB-local.
- For notifications, derive record uniqueness from stable event ID + channel + normalized recipient; queue dispatch must be recoverable when row insertion succeeded but queue add did not. Provider send remains effectively at-least-once unless provider idempotency or reconciliation exists.
- For search projection, use deterministic document IDs and idempotent upsert/delete operations; include `product.archived` handling and track projection lag.

## Outbox decision

**Recommendation: adopt a transactional outbox for domain events that affect checkout/order/payment/shipping correctness and durable notifications.** Evidence: no generic outbox exists; order, cancellation and payment state commit before publish; payment webhook receipt can suppress a replay after the event publication window; notifications have a DB-row/queue dual-write gap. A plain switch from in-memory to BullMQ would remove synchronous coupling but would not close DB→queue loss windows.

Suggested bounded design: outbox row inserted in the same Prisma transaction as aggregate changes; a separate relay claims rows, enqueues to BullMQ with stable `eventId`, then marks dispatched; relay crash between enqueue and mark can redeliver, so consumer inbox/idempotency remains mandatory. If introducing an outbox table/migration is not accepted in a first sub-run, explicitly limit that sub-run to low-risk projections and retain checkout/payment events on the current path until atomicity is delivered. No schema/runtime change was made in this discovery.

## Missing-handler matrix

| Event(s) | Producer exists? | Subscriber/handler exists? | Current status / next decision |
|---|---:|---:|---|
| `checkout.guest_order_created` | Yes | No | `DEBT_DETECTED`; decide whether redundant audit-only event should be removed or receive explicit consumer. |
| `payment.intent_created` | Yes | No | `DEBT_DETECTED`; no notification/template or operational consumer exists. Define required consumer or stop emitting. |
| `order.paid` | Yes | Registered notification subscriber, but template resolver has no case | `DEBT_DETECTED`; define payment-confirmation notification contract or remove subscription/event if redundant. |
| `product.archived` | Yes | No search subscription | `DEBT_DETECTED`; archived product may remain indexed unless a separate reindex path removes it. |
| `promotion.activated`, `promotion.deactivated` | Yes | No | `DEBT_DETECTED`; no consumer currently required/identified. |
| `inventory.low_stock_detected` | No producer found | Notification subscriber/template exists | `DEBT_DETECTED`; connect to authoritative inventory transition or remove dead subscription after owner decision. |
| All events manually placed on `domain-events` | N/A | No registered handlers | `DEBT_DETECTED` / P0; queue is not safe for production dispatch. |

All producer events do not need consumers by default. Each event requires an explicit owner and disposition: consumed, intentionally audit-only, deprecated, or removed. Do not create empty handlers just to make the map non-empty.

## Existing tests and failure-injection gaps

| Area | Existing evidence | Missing tests before EX-04 can exit |
|---|---|---|
| Notification event → row → send | `tests/critical/platform-closure.e2e.test.ts`: order notification success, provider failure/retry count, notification history | Redis down before notification enqueue; DB row-without-job repair; duplicate event ID; duplicate logical event with new delivery attempt; provider accepts send then client times out. |
| Search event consumer | Same critical test covers publishing content and public/search visibility; search unit ranking test exists | Reindex failure after source write; retries/replay; product archive removal; duplicate delivery and concurrent reindex. |
| BullMQ domain event publisher/worker | No direct publisher/worker tests found | Queue add failure/reconnect; serialization/schema validation; stable job ID dedupe; missing handler not acked; registered handler success/retry/fail; worker shutdown/drain. |
| Outbox | No model/migration/relay/inbox tests found | Same-transaction persistence, relay crash before/after enqueue, lock/lease expiry, duplicate dispatch, replay after dead-letter. |
| Redis behavior | No Redis outage/recovery/fault-injection test found | App bootstrap with Redis unavailable; runtime disconnect while publishing; recovery; health/readiness state; no checkout response loss after order commit. |
| Transactions and event publication | Critical suites cover order/payment/webhook business paths and webhook idempotency | Inject publish/audit failure after committed order/payment, assert durable intent and stable event recovery; two-event payment approval partial failure. |
| Event contracts | No event-schema/version compatibility test found | Runtime payload validation, event version evolution, unknown event policy, producer/consumer contract coverage. |

Search inventory used: `rg` over `src`, `tests`, and `prisma/schema.prisma` for publisher tokens, `publish`, `@Processor`, `registerHandler`, queue/Redis/outbox/idempotency terms. No external services were contacted. Existing `platform-closure.e2e.test.ts` uses the repository test stack; this discovery did not run tests because no runtime code changed and the requested deliverable is analysis-only.

## Bounded EX-04 sub-runs

Each sub-run must use its own branch/worktree from a fresh canonical base and stay behind orchestrator sequencing. No sub-run should silently combine transport migration with domain redesign.

| Sub-run | Bounded objective | Allowed scope | Exit gate |
|---|---|---|---|
| EX-04.1 — Event contracts and handler coverage | Define typed event names/payload versions and explicit consumer ownership; ensure every dispatched Bull event has a registered handler or explicit terminal disposition | Contract types/registry, handler registration, missing-handler policy, contract tests; no outbox/schema yet | Producer/consumer matrix encoded in tests; every supported event has a handler; unknown event cannot be acked as success; no API behavior change. |
| EX-04.2 — Durable domain-event outbox | Persist critical events atomically with order/payment/catalog mutations and implement safe relay | Prisma outbox schema/migration, repository, relay, stable IDs, observability; start with critical order/payment flows if bounded | Transaction rollback leaves neither business write nor outbox; committed mutation always has durable event; relay crash cases recover with same ID; migration rollback/forward plan. |
| EX-04.3 — Consumer idempotency and notification recovery | Prevent logical duplicate side effects and repair DB→queue dual write | Inbox/delivery records, notification job recovery, event-to-notification deterministic keys, search consumer idempotency | Concurrent duplicate delivery produces one logical DB effect; stranded notifications are enqueued; provider-send ambiguity is explicitly handled/blocked by provider capability. |
| EX-04.4 — Retry/DLQ and Redis outage operations | Define and implement bounded retries, dead-letter, readiness, startup/runtime outage policy | BullMQ options, health/readiness, safe error categories, DLQ alert/replay admin/runbook | Redis startup/runtime fault tests pass; bounded backoff/retry observable; exhausted jobs parked/alerted; replay preserves event ID; no order loss or false checkout failure. |

## Exact acceptance tests for EX-04

1. Domain event schema validates event name/version/payload; unknown names and unsupported versions fail closed and are observable.
2. A producer transaction writes aggregate mutation and outbox record atomically; forced DB rollback leaves neither; process termination after commit does not lose publish intent.
3. Relay publishes stable event ID as queue job ID; forced crash after queue add but before outbox acknowledgment safely redelivers and consumer processes once logically.
4. Two concurrent deliveries of one event to each DB-mutating consumer yield one logical side effect and one completed inbox record.
5. Missing handler does not log-and-ack; it is classified, retried only by the defined policy, then dead-lettered/alerted.
6. Retry policy verifies attempt count, exponential backoff bounds/jitter category, terminal-vs-transient behavior, retention, DLQ metadata, and operator replay without new event ID.
7. Redis unavailable at startup and disconnected during runtime produce the documented readiness state; recovery resumes relay; no event is silently lost.
8. `order.created`: committed order remains confirmable even if notification/search downstream is unavailable; durable outbox later delivers it once logically.
9. Payment approval: payment/order/stock commit and payment event intent are atomic; duplicate webhook does not suppress a still-pending outbox event; each intended event is delivered once logically.
10. Notification: failure between notification-row insert and queue add is repaired; repeated event delivery does not create duplicate rows/jobs; provider accept-then-timeout behavior is tested with a deterministic fake transport and does not claim exactly-once external delivery.
11. Search projections handle all catalog lifecycle events including archive; duplicate delivery is idempotent; projection failure retries without changing the already committed catalog API outcome.
12. Shutdown/drain test confirms worker stops accepting new work, finishes or safely releases in-flight jobs, and outbox lease can recover after termination.
13. Privacy test confirms event logs contain envelope identifiers only and never recipient PII, provider payloads, tokens, or secrets.
14. Full relevant critical integration suite and unit/security suite remain green; no provider credentials or real external calls are used.

## Files and evidence reviewed

- `src/common/events/domain-event.publisher.ts`
- `src/infra/events/in-memory-domain-event.publisher.ts`
- `src/infra/events/bullmq-domain-event.publisher.ts`
- `src/infra/events/domain-events.worker.ts`
- `src/infra/queue/bullmq.module.ts`
- `src/infra/cache/redis.module.ts`
- `src/app/app.module.ts`
- `src/modules/notifications/{application,domain,infrastructure}/...`
- `src/modules/search/infrastructure/jobs/search-event.subscriber.ts`
- producer use cases in orders, payments, products, brands, categories, variants, promotions, content, and shipping
- `prisma/schema.prisma` and migrations
- `tests/critical/platform-closure.e2e.test.ts` and event/idempotency-related critical tests

No source file, schema, migration, dependency, test, `STATE.json`, or `USER_IMPACT_LOG.md` was changed. Only this discovery document is created. No commit, push, merge, provider call, or runtime test was performed.
