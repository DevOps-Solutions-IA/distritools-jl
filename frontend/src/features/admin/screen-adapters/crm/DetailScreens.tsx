import { LegacyDetailBody } from '../shared/LegacyDetailValue';
import type {
  DetailAdapterRegistration,
  DetailScreenProps,
} from '../shared/types';

export function QuoteDetailScreen({ value }: DetailScreenProps) {
  return <LegacyDetailBody value={value} />;
}

export function CustomerDetailScreen({ value }: DetailScreenProps) {
  return <LegacyDetailBody value={value} />;
}

export const crmDetailAdapters = [
  { prefix: '/admin/quotes/', Screen: QuoteDetailScreen },
  { prefix: '/admin/customers/', Screen: CustomerDetailScreen },
] satisfies ReadonlyArray<DetailAdapterRegistration>;
