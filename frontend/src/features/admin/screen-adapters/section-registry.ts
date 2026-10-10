import type { AdminModuleKey } from '@/lib/admin/operations';
import { catalogSectionAdapters } from './catalog/SectionScreens';
import { inventorySectionAdapters } from './inventory/SectionScreens';
import { salesSectionAdapters } from './sales/SectionScreens';
import { crmSectionAdapters } from './crm/SectionScreens';
import { logisticsSectionAdapters } from './logistics/SectionScreens';
import { contentSectionAdapters } from './content/SectionScreens';
import { iamSectionAdapters } from './iam/SectionScreens';
import { controlSectionAdapters } from './control/SectionScreens';
import { CompatibilityFallback } from './shared/CompatibilityFallback';
import type { SectionScreenAdapter } from './shared/types';

const fallback: SectionScreenAdapter = { Screen: CompatibilityFallback };
const sectionAdapters = {
  dashboard: fallback,
  ...catalogSectionAdapters,
  ...inventorySectionAdapters,
  ...salesSectionAdapters,
  ...crmSectionAdapters,
  ...logisticsSectionAdapters,
  ...contentSectionAdapters,
  ...iamSectionAdapters,
  ...controlSectionAdapters,
} satisfies Record<AdminModuleKey, SectionScreenAdapter>;

export function getSectionScreenAdapter(
  moduleKey: AdminModuleKey,
): SectionScreenAdapter {
  return sectionAdapters[moduleKey] ?? fallback;
}
