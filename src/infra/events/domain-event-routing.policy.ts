import {
  DOMAIN_EVENT_CONTRACTS,
  DOMAIN_EVENT_NAMES,
  DomainEventName,
} from 'src/common/events/domain-event.contracts';
import { requiredConsumerKeys } from 'src/infra/events/domain-event-replay-policy';

export type DomainEventRoute = 'legacy_hold' | 'durable';
export type DomainEventRouteReason =
  | 'DEFAULT_LEGACY_HOLD'
  | 'TEST_ONLY_DURABLE'
  | 'REQUIRED_CONSUMER_GAP'
  | 'NO_REQUIRED_CONSUMERS'
  | 'REGISTERED_CONSUMER_MISSING'
  | 'PRODUCER_MISSING';

export interface DomainEventRoutingDecision {
  route: DomainEventRoute;
  reason: DomainEventRouteReason;
  policyVersion: 'ex045.v1';
}

export type ConsumerDisposition = 'SUPPORTED_DURABLE' | 'BLOCKED_GAP' | 'NOT_APPLICABLE';

export interface DomainEventConsumerDisposition {
  eventName: DomainEventName;
  consumerKey: string | null;
  disposition: ConsumerDisposition;
  evidence: string;
}

export interface DomainEventDispositionEvaluation {
  eventName: DomainEventName;
  producerStatus: 'present' | 'missing';
  eligible: boolean;
  reason: string;
  consumers: DomainEventConsumerDisposition[];
}

const POLICY_VERSION = 'ex045.v1' as const;

function isTestOnlyDurableRouteRequested(): boolean {
  return process.env.APP_ENV === 'test' && process.env.NODE_ENV === 'test' &&
    process.env.EX045_TEST_DURABLE_ROUTING === 'true';
}

export function evaluateDomainEventDisposition(
  eventName: DomainEventName,
  registeredConsumers: readonly string[],
): DomainEventDispositionEvaluation {
  const contract = DOMAIN_EVENT_CONTRACTS[eventName];
  const required = requiredConsumerKeys(contract.inMemoryConsumers);
  const consumers: DomainEventConsumerDisposition[] = [];

  if (required.length === 0) {
    if (contract.disposition === 'no_consumer') {
      consumers.push({
        eventName, consumerKey: null, disposition: 'NOT_APPLICABLE',
        evidence: 'Existing event contract explicitly declares no consumer.',
      });
    } else {
      consumers.push({
        eventName, consumerKey: null, disposition: 'BLOCKED_GAP',
        evidence: `Contract disposition is ${contract.disposition}; no required consumer is established.`,
      });
    }
  } else {
    for (const [index, consumer] of contract.inMemoryConsumers.entries()) {
      const consumerKey = required[index];
      let disposition: ConsumerDisposition = 'SUPPORTED_DURABLE';
      let evidence = 'Contract declares a consumer and its stable registered handler is present.';
      if (contract.producerStatus === 'missing') {
        disposition = 'BLOCKED_GAP';
        evidence = 'The event contract has no current producer.';
      } else if (contract.disposition !== 'in_memory_consumed') {
        disposition = 'BLOCKED_GAP';
        evidence = `Contract records ${contract.disposition}; no durable-safe disposition is established.`;
      } else if (!registeredConsumers.includes(consumerKey)) {
        disposition = 'BLOCKED_GAP';
        evidence = 'The required stable consumer identity is not registered.';
      }
      consumers.push({ eventName, consumerKey, disposition, evidence });
    }
  }

  const eligible = contract.producerStatus === 'present' && required.length > 0 &&
    consumers.every((consumer) => consumer.disposition === 'SUPPORTED_DURABLE');
  const reason = eligible
    ? 'ALL_REQUIRED_CONSUMERS_SUPPORTED'
    : contract.producerStatus === 'missing'
      ? 'PRODUCER_MISSING'
      : required.length === 0
        ? 'NO_REQUIRED_CONSUMERS'
        : consumers.find((consumer) => consumer.disposition === 'BLOCKED_GAP')?.evidence ?? 'REQUIRED_CONSUMER_GAP';

  return { eventName, producerStatus: contract.producerStatus, eligible, reason, consumers };
}

export function buildDomainEventDispositionMatrix(
  registeredByEvent: Partial<Record<DomainEventName, readonly string[]>>,
): DomainEventDispositionEvaluation[] {
  return DOMAIN_EVENT_NAMES.map((eventName) => evaluateDomainEventDisposition(
    eventName,
    registeredByEvent[eventName] ?? [],
  ));
}

export function resolveDomainEventRoute(
  eventName: DomainEventName,
  registeredConsumers: readonly string[],
): DomainEventRoutingDecision {
  if (!isTestOnlyDurableRouteRequested()) {
    return { route: 'legacy_hold', reason: 'DEFAULT_LEGACY_HOLD', policyVersion: POLICY_VERSION };
  }
  const contract = DOMAIN_EVENT_CONTRACTS[eventName];
  if (contract.producerStatus === 'missing') {
    return { route: 'legacy_hold', reason: 'PRODUCER_MISSING', policyVersion: POLICY_VERSION };
  }
  if (contract.inMemoryConsumers.length === 0) {
    return { route: 'legacy_hold', reason: 'NO_REQUIRED_CONSUMERS', policyVersion: POLICY_VERSION };
  }
  if (contract.disposition !== 'in_memory_consumed') {
    return { route: 'legacy_hold', reason: 'REQUIRED_CONSUMER_GAP', policyVersion: POLICY_VERSION };
  }
  const evaluation = evaluateDomainEventDisposition(eventName, registeredConsumers);
  if (!evaluation.eligible) {
    return { route: 'legacy_hold', reason: 'REGISTERED_CONSUMER_MISSING', policyVersion: POLICY_VERSION };
  }
  return { route: 'durable', reason: 'TEST_ONLY_DURABLE', policyVersion: POLICY_VERSION };
}

export function declaredConsumerKeys(eventName: DomainEventName): string[] {
  const contract = DOMAIN_EVENT_CONTRACTS[eventName];
  return requiredConsumerKeys(contract.inMemoryConsumers);
}
