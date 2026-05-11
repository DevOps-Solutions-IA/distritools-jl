import { ProductCard } from '@/components/catalog/ProductCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { isPubliclyPurchasable } from '@/features/catalog/live-search';
import type { CatalogProduct } from '@/features/catalog/types';

interface ProductGridProps {
  products: CatalogProduct[];
  emptyTitle?: string;
  emptyDescription?: string;
}

export function ProductGrid({
  products,
  emptyTitle = 'No encontramos productos con esos criterios.',
  emptyDescription = 'Prueba otra categoría, marca o usa la búsqueda para encontrar una opción disponible.',
}: ProductGridProps) {
  const publicProducts = products.filter(isPubliclyPurchasable);

  if (!publicProducts.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} actionLabel="Ver todo el catálogo" />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 md:gap-5 xl:grid-cols-3 2xl:grid-cols-4">
      {publicProducts.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
