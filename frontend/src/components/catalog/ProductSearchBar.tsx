import { Input } from '@/components/ui/Input';
import { LiveCatalogSearch } from '@/components/catalog/LiveCatalogSearch';
import { StorefrontButton } from '@/components/storefront/StorefrontButton';
import type { CatalogBrand, CatalogCategory, CatalogProduct } from '@/features/catalog/types';

interface ProductSearchBarProps {
  defaultValue?: string;
  action?: string;
  helperText?: string;
  products?: CatalogProduct[];
  brands?: CatalogBrand[];
  categories?: CatalogCategory[];
}

export function ProductSearchBar({
  defaultValue,
  action = '/buscar',
  helperText = 'Busca por nombre, marca, categoría o SKU.',
  products,
  brands = [],
  categories = [],
}: ProductSearchBarProps) {
  if (products) {
    return (
      <LiveCatalogSearch
        products={products}
        brands={brands}
        categories={categories}
        action={action}
        defaultValue={defaultValue}
        placeholder="Ej. taladro, esmeril, compresor"
      />
    );
  }

  return (
    <form action={action} className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
      <Input
        name="q"
        defaultValue={defaultValue}
        aria-label="Buscar en catálogo"
        placeholder="Ej. taladro, soldadora, SKU o marca"
        helperText={helperText}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoCapitalize="none"
        inputMode="search"
        type="search"
      />
      <StorefrontButton type="submit" storefrontSize="large">
        Buscar
      </StorefrontButton>
    </form>
  );
}
