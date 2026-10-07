import { ServiceUnavailableException } from '@nestjs/common';
import type { EventDisposition, InMemoryConsumer } from 'src/common/events/domain-event.contracts';

const CONSUMER_KEYS: Record<InMemoryConsumer, string> = {
  notifications: 'notifications.v1',
  search: 'search-projection.v1',
};

export type ReplayEligibilityReason =
  | 'HISTORICAL_HELD'
  | 'REQUIRED_CONSUMER_GAP'
  | 'NO_REQUIRED_CONSUMERS'
  | 'REGISTERED_CONSUMER_MISSING'
  | 'CONSUMERS_ALREADY_COMPLETED'
  | 'SAFE_INCOMPLETE_DELIVERY';

export function assessDomainEventReplayEligibility(input: {
  eligibility: string;
  disposition: EventDisposition;
  requiredConsumers: readonly InMemoryConsumer[];
  registeredConsumers: readonly string[];
  completedConsumers: readonly string[];
}): { eligible: boolean; reason: ReplayEligibilityReason } {
  if (input.eligibility === 'held') return { eligible: false, reason: 'HISTORICAL_HELD' };
  if (input.disposition !== 'in_memory_consumed') return { eligible: false, reason: 'REQUIRED_CONSUMER_GAP' };
  if (input.requiredConsumers.length === 0) return { eligible: false, reason: 'NO_REQUIRED_CONSUMERS' };

  const requiredKeys = input.requiredConsumers.map((consumer) => CONSUMER_KEYS[consumer]);
  if (requiredKeys.some((key) => !input.registeredConsumers.includes(key))) {
    return { eligible: false, reason: 'REGISTERED_CONSUMER_MISSING' };
  }
  if (requiredKeys.every((key) => input.completedConsumers.includes(key))) {
    return { eligible: false, reason: 'CONSUMERS_ALREADY_COMPLETED' };
  }
  return { eligible: true, reason: 'SAFE_INCOMPLETE_DELIVERY' };
}

export function requiredConsumerKeys(consumers: readonly InMemoryConsumer[]): string[] {
  return consumers.map((consumer) => CONSUMER_KEYS[consumer]);
}

export function isIsolatedDomainEventRuntime(): boolean {
  return process.env.APP_ENV === 'test' && process.env.NODE_ENV === 'test';
}

export function assertDomainEventQueueMutationEnabled(): void {
  if (!isIsolatedDomainEventRuntime()) {
    throw new ServiceUnavailableException('Domain event queue mutation is disabled outside isolated tests');
  }
}
