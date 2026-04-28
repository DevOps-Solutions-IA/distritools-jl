import Link from 'next/link';
import type { CatalogCategory } from '@/features/catalog/types';

interface CategoryRailProps {
  categories: CatalogCategory[];
}

export function CategoryRail({ categories }: CategoryRailProps) {
  return (
    <div className="flex snap-x gap-4 overflow-x-auto pb-2">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/storefront/categorias/${category.slug}`}
          className="min-w-[220px] snap-start rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-soft transition hover:-translate-y-1 hover:shadow-medium"
        >
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-orange)]">
              Familia
            </p>
            <h3 className="text-lg font-semibold text-[var(--color-off-white)]">
              {category.name}
            </h3>
            <p className="text-sm leading-6 text-[var(--color-steel-gray)]">
              {category.description ?? 'Explora esta línea y navega referencias relacionadas.'}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
