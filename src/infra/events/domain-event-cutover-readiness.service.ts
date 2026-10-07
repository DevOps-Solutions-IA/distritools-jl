import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { DOMAIN_EVENT_CONTRACTS, DOMAIN_EVENT_NAMES, DomainEventName } from 'src/common/events/domain-event.contracts';
import { buildDomainEventDispositionMatrix, declaredConsumerKeys, EX045_DURABLE_PENDING_ELIGIBILITY } from 'src/infra/events/domain-event-routing.policy';
import { DomainEventHandlerRegistry } from 'src/infra/events/domain-event-handler.registry';

const MAX_LIMIT = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class DomainEventCutoverReadinessService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(DomainEventHandlerRegistry) private readonly registry: DomainEventHandlerRegistry,
  ) {}

  async evaluate(input: { limit?: number; cursor?: string }) {
    const limit = input.limit ?? 25;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new BadRequestException(`Limit must be between 1 and ${MAX_LIMIT}`);
    }
    const after = input.cursor === undefined ? undefined : this.parseCursor(input.cursor);
    const rows = await this.prisma.domainEventOutbox.findMany({
      where: after ? { OR: [
        { createdAt: { gt: after.createdAt } },
        { createdAt: after.createdAt, eventId: { gt: after.eventId } },
      ] } : {},
      orderBy: [{ createdAt: 'asc' }, { eventId: 'asc' }],
      take: limit,
      select: {
        eventId: true, eventName: true, eventVersion: true, eligibility: true, holdReason: true,
        state: true, createdAt: true,
        routingDecision: { select: { route: true, reason: true, policyVersion: true } },
      },
    });
    const ids = rows.map((row) => row.eventId);
    const [receipts, parking, notifications] = ids.length ? await Promise.all([
      this.prisma.domainEventInbox.findMany({
        where: { eventId: { in: ids } }, select: { eventId: true, consumerKey: true, status: true },
      }),
      this.prisma.domainEventParking.findMany({
        where: { eventId: { in: ids } }, select: { eventId: true, consumerKey: true, status: true, failureClass: true, errorCategory: true },
      }),
      this.prisma.notification.groupBy({
        by: ['eventId', 'status'], where: { eventId: { in: ids } }, _count: { _all: true },
      }),
    ]) : [[], [], []];

    const receiptMap = this.groupByEvent(receipts);
    const parkingMap = this.groupByEvent(parking);
    const notificationMap = new Map<string, Record<string, number>>();
    for (const row of notifications) {
      const counts = notificationMap.get(row.eventId) ?? {};
      counts[row.status] = row._count._all;
      notificationMap.set(row.eventId, counts);
    }
    const matrix = buildDomainEventDispositionMatrix(Object.fromEntries(
      DOMAIN_EVENT_NAMES.map((name) => [name, this.registry.consumerKeys(name)]),
    ));
    const dispositionByName = new Map(matrix.map((item) => [item.eventName, item]));

    const items = rows.map((row) => {
      const eventName = row.eventName as DomainEventName;
      const contract = DOMAIN_EVENT_CONTRACTS[eventName];
      const required = contract ? declaredConsumerKeys(eventName) : [];
      const completed = (receiptMap.get(row.eventId) ?? [])
        .filter((receipt) => receipt.status === 'completed' && required.includes(receipt.consumerKey))
        .map((receipt) => receipt.consumerKey);
      const pending = required.filter((consumer) => !completed.includes(consumer));
      const disposition = dispositionByName.get(eventName);
      const parkingRows = parkingMap.get(row.eventId) ?? [];
      const notificationCounts = notificationMap.get(row.eventId) ?? {};
      const hasUnsafeParking = parkingRows.some((entry) => ['parked', 'replay_requested'].includes(entry.status) || entry.failureClass === 'ambiguous');
      const hasUncertainNotification = (notificationCounts.uncertain ?? 0) > 0 || (notificationCounts.sending ?? 0) > 0;
      const route = row.routingDecision?.route ?? 'legacy_hold';
      const reasons: string[] = [];
      if (route !== 'durable') reasons.push('PERSISTED_ROUTE_IS_LEGACY_HOLD');
      if (row.eligibility === EX045_DURABLE_PENDING_ELIGIBILITY) reasons.push('MIXED_VERSION_FENCE_NOT_ACTIVATED');
      else if (row.eligibility !== 'eligible') reasons.push('OUTBOX_INTENT_IS_HELD');
      if (!disposition?.eligible) reasons.push(disposition?.reason ?? 'EVENT_CONTRACT_UNAVAILABLE');
      if (hasUnsafeParking) reasons.push('PARKING_OR_UNCERTAIN_DELIVERY_REQUIRES_OPERATOR_REVIEW');
      if (hasUncertainNotification) reasons.push('NOTIFICATION_OUTCOME_UNCERTAIN');
      const cutoverEligible = route === 'durable' && row.eligibility === 'eligible' &&
        disposition?.eligible === true && !hasUnsafeParking && !hasUncertainNotification;
      return {
        eventName: row.eventName,
        eventVersion: row.eventVersion,
        eventId: row.eventId,
        createdAt: row.createdAt,
        persistedRoute: route,
        routeReason: row.routingDecision?.reason ?? row.holdReason ?? 'NO_PERSISTED_ROUTING_DECISION',
        routePolicyVersion: row.routingDecision?.policyVersion ?? null,
        state: row.state,
        requiredConsumers: required.map((consumerKey) => ({
          consumerKey,
          disposition: disposition?.consumers.find((consumer) => consumer.consumerKey === consumerKey)?.disposition ?? 'BLOCKED_GAP',
        })),
        completedConsumers: [...new Set(completed)],
        pendingConsumers: pending,
        parking: parkingRows.map((entry) => ({
          consumerKey: entry.consumerKey, status: entry.status,
          failureClass: entry.failureClass, errorCategory: entry.errorCategory,
        })),
        notificationStates: notificationCounts,
        held: route !== 'durable' || row.eligibility === 'held' || row.eligibility === EX045_DURABLE_PENDING_ELIGIBILITY,
        cutoverEligible,
        ineligibilityReasons: cutoverEligible ? [] : [...new Set(reasons)],
        requiredConsumerGap: !contract || contract.disposition === 'known_consumer_gap' || contract.disposition === 'producer_missing',
      };
    });
    const last = rows.at(-1);
    return {
      readOnly: true,
      bounded: true,
      limit,
      consumerDispositionMatrix: matrix,
      items,
      nextCursor: rows.length === limit && last ? `${last.createdAt.toISOString()}|${last.eventId}` : null,
    };
  }

  private groupByEvent<T extends { eventId: string }>(rows: T[]): Map<string, T[]> {
    const result = new Map<string, T[]>();
    for (const row of rows) result.set(row.eventId, [...(result.get(row.eventId) ?? []), row]);
    return result;
  }

  private parseCursor(cursor: string): { createdAt: Date; eventId: string } {
    const separator = cursor.indexOf('|');
    if (separator < 1) throw new BadRequestException('Invalid cursor');
    const timestamp = cursor.slice(0, separator);
    const eventId = cursor.slice(separator + 1);
    const createdAt = new Date(timestamp);
    if (!UUID.test(eventId) || Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== timestamp) {
      throw new BadRequestException('Invalid cursor');
    }
    return { createdAt, eventId };
  }
}
