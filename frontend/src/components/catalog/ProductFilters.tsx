import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import type { CatalogBrand, CatalogCategory } from '@/features/catalog/types';
import { ProductSortSelect } from '@/components/catalog/ProductSortSelect';

interface ProductFiltersProps {
  brands: CatalogBrand[];
  categories: CatalogCategory[];
  selectedBrandSlug?: string;
  selectedCategorySlug?: string;
  selectedSort?: string;
}

export function ProductFilters({
  brands,
  categories,
  selectedBrandSlug,
  selectedCategorySlug,
  selectedSort,
}: ProductFiltersProps) {
  return (
    <form className="grid gap-4 rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-soft md:grid-cols-[1fr_1fr_220px_auto]">
      <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-off-white)]">
        Categoría
        <select
          name="category"
          defaultValue={selectedCategorySlug ?? ''}
          className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]"
        >
          <option value="">Todas</option>
          {categories.map((category) => (
            <option key={category.id} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-[var(--color-off-white)]">
        Marca
        <select
          name="brand"
          defaultValue={selectedBrandSlug ?? ''}
          className="focus-ring h-11 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 text-sm text-[var(--color-off-white)]"
        >
          <option value="">Todas</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.slug}>
              {brand.name}
            </option>
          ))}
        </select>
      </label>

      <ProductSortSelect defaultValue={selectedSort} />

      <div className="flex items-end gap-3">
        <div className="grid w-full gap-2 md:w-auto">
          <Button type="submit" className="w-full md:w-auto">
            Aplicar
          </Button>
          <Link href="/storefront/marcas" className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
            Ver marcas
          </Link>
        </div>
      </div>
    </form>
  );
}
