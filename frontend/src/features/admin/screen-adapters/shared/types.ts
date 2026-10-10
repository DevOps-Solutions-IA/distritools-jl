import type { ComponentType } from 'react';
import type {
  AdminModuleConfig,
  AdminModuleKey,
  getAdminCatalogSnapshot,
} from '@/lib/admin/operations';
import type {
  AdminOperationalSnapshot,
  adminFetch,
} from '@/lib/admin/server-data';

export type CatalogSnapshot = Awaited<
  ReturnType<typeof getAdminCatalogSnapshot>
>;
export type SectionScreenProps<
  K extends keyof AdminOperationalSnapshot = keyof AdminOperationalSnapshot,
> = {
  moduleKey: AdminModuleKey;
  adminModule: AdminModuleConfig;
  snapshot: CatalogSnapshot;
  operations: Pick<AdminOperationalSnapshot, K>;
};
export interface SectionActionLink {
  label: string;
  href: string;
}
export interface SectionScreenAdapter {
  Screen: ComponentType<SectionScreenProps>;
  actions?: SectionActionLink[];
}
// Keep the existing result contract, including ok=false, status and error.
export type DetailData = Record<string, unknown>;
export type DetailResult = Awaited<ReturnType<typeof adminFetch<DetailData>>>;
export interface DetailScreenProps {
  value: DetailData | null;
}
export type DetailScreenAdapter = ComponentType<DetailScreenProps>;
export interface DetailAdapterRegistration {
  prefix: `/admin/${string}/`;
  Screen: DetailScreenAdapter;
}
export interface DetailPageProps {
  title: string;
  backHref: string;
  backLabel: string;
  backendPath: string;
}
