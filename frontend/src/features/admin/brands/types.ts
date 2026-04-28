import type { CatalogBrand } from '@/features/catalog/types';

export interface AdminBrandCatalogRecord extends CatalogBrand {
  canEditVisualMetadata: boolean;
  visualAdministrationPhase: 'phase-4';
}
