import { LegacyDetailBody } from '../shared/LegacyDetailValue';
import type {
  DetailAdapterRegistration,
  DetailScreenProps,
} from '../shared/types';

export function ShipmentDetailScreen({ value }: DetailScreenProps) {
  return <LegacyDetailBody value={value} />;
}

export const logisticsDetailAdapters = [
  { prefix: '/admin/shipments/', Screen: ShipmentDetailScreen },
] satisfies ReadonlyArray<DetailAdapterRegistration>;
