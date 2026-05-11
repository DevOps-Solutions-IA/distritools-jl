import Link from 'next/link';
import type { CatalogCategory } from '@/features/catalog/types';

interface CategoryRailProps {
  categories: CatalogCategory[];
}

export function CategoryRail({ categories }: CategoryRailProps) {
  return (
    <div className="flex snap-x gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/categorias/${category.slug}`}
          aria-label={`Ver productos de ${category.name}`}
          className="min-w-[9.5rem] snap-start rounded-[1.1rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-soft transition hover:-translate-y-1 hover:shadow-medium sm:min-w-[220px] sm:rounded-[1.5rem] sm:p-5"
        >
          <div className="space-y-1 sm:space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-industrial-orange)] sm:text-xs sm:tracking-[0.18em]">
              Categoría
            </p>
            <h3 className="truncate text-sm font-semibold text-[var(--color-off-white)] sm:text-lg">
              {category.name}
            </h3>
            <p className="hidden text-sm leading-6 text-[var(--color-steel-gray)] sm:line-clamp-2 sm:block">
              {category.description ?? 'Explora esta línea y navega referencias relacionadas.'}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
