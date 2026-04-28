import { BrandLogoSlider } from '@/components/catalog/BrandLogoSlider';
import type { CatalogBrand } from '@/features/catalog/types';

interface BrandStripProps {
  brands: CatalogBrand[];
}

export function BrandStrip({ brands }: BrandStripProps) {
  return <BrandLogoSlider brands={brands} />;
}
