import { salesDetailAdapters } from './sales/DetailScreens';
import { crmDetailAdapters } from './crm/DetailScreens';
import { logisticsDetailAdapters } from './logistics/DetailScreens';
import { LegacyDetailBody } from './shared/LegacyDetailValue';
import type {
  DetailAdapterRegistration,
  DetailScreenAdapter,
} from './shared/types';

// Resolve existing backend paths without rewriting them or changing navigation.
const detailAdapters: ReadonlyArray<DetailAdapterRegistration> = [
  ...salesDetailAdapters,
  ...crmDetailAdapters,
  ...logisticsDetailAdapters,
];

export function getDetailScreenAdapter(
  backendPath: string,
): DetailScreenAdapter {
  return (
    detailAdapters.find(({ prefix }) => backendPath.startsWith(prefix))
      ?.Screen ?? LegacyDetailBody
  );
}
