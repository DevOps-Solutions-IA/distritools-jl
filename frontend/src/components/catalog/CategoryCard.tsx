import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';
import type { CatalogCategory } from '@/features/catalog/types';

interface CategoryCardProps {
  category: CatalogCategory;
}

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link href={`/storefront/categorias/${category.slug}`} className="group block h-full">
      <Card
        variant="elevated"
        className="h-full overflow-hidden border-[var(--color-border)] bg-[linear-gradient(180deg,#121212_0%,#0c0c0c_100%)] transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-medium"
      >
        <CardBody className="flex h-full flex-col gap-4 p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgba(245,183,0,0.12)] text-lg font-semibold text-[var(--color-industrial-yellow)]">
            {category.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[var(--color-off-white)]">
              {category.name}
            </h3>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              {category.description ?? 'Explora esta familia con una navegación enfocada en compra técnica y salida comercial clara.'}
            </p>
          </div>
          <span className="text-sm font-semibold text-[var(--color-industrial-yellow)]">
            Ver productos
          </span>
        </CardBody>
      </Card>
    </Link>
  );
}
