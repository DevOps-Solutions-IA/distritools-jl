import { LegacyDetailBody } from '../shared/LegacyDetailValue';
import type {
  DetailAdapterRegistration,
  DetailScreenProps,
} from '../shared/types';

export function OrderDetailScreen({ value }: DetailScreenProps) {
  return <LegacyDetailBody value={value} />;
}

export function PaymentDetailScreen({ value }: DetailScreenProps) {
  return <LegacyDetailBody value={value} />;
}

export const salesDetailAdapters = [
  { prefix: '/admin/orders/', Screen: OrderDetailScreen },
  { prefix: '/admin/payments/', Screen: PaymentDetailScreen },
] satisfies ReadonlyArray<DetailAdapterRegistration>;
