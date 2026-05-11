import Link from 'next/link';
import { Card, CardBody } from '@/components/ui/Card';
import type { CatalogCategory } from '@/features/catalog/types';

interface CategoryCardProps {
  category: CatalogCategory;
}

const mobileCategoryNames: Record<string, string> = {
  herramientas: 'Herramientas',
  manuales: 'Manuales',
  electricas: 'Eléctricas',
  'herramientas-electricas': 'Eléctricas',
  neumaticas: 'Neumáticas',
  'herramientas-neumaticas': 'Neumáticas',
  'aire-comprimido': 'Aire comprimido',
  compresores: 'Compresores',
};

function getCompactCategoryName(category: CatalogCategory) {
  const direct = mobileCategoryNames[category.slug];
  if (direct) {
    return direct;
  }

  return category.name
    .replace(/^Herramientas\s+/i, '')
    .replace(/\s+industriales?$/i, '')
    .trim();
}

function CategoryIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 40 40"
      className="h-5 w-5 text-[var(--color-industrial-yellow)] sm:h-8 sm:w-8"
      fill="none"
    >
      <path
        d="M9 24h11l11-11 4 4-11 11v5H9v-9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M13 28h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 10l2-2 4 4-2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function CategoryCard({ category }: CategoryCardProps) {
  const compactName = getCompactCategoryName(category);

  return (
    <Link
      href={`/categorias/${category.slug}`}
      aria-label={`Ver productos de ${category.name}`}
      title={category.name}
      className="group block h-full"
    >
      <Card
        variant="elevated"
        className="h-full overflow-hidden rounded-[1rem] border-[var(--color-border)] bg-[linear-gradient(135deg,#121212_0%,#0b0b0b_58%,rgba(245,183,0,0.08)_100%)] transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-medium sm:rounded-xl"
      >
        <CardBody className="grid min-h-[4rem] grid-cols-[2.35rem_1fr] items-center gap-2.5 p-2.5 sm:min-h-0 sm:grid-cols-[3.5rem_1fr] sm:gap-4 sm:p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-[rgba(245,183,0,0.10)] sm:h-14 sm:w-14">
            <CategoryIcon />
          </div>
          <div className="min-w-0">
            <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-[var(--color-off-white)] sm:text-lg">
              <span className="sm:hidden">{compactName}</span>
              <span className="hidden sm:inline">{category.name}</span>
            </h3>
            <p className="hidden text-sm leading-6 text-[var(--color-text-secondary)] sm:line-clamp-2 sm:block">
              {category.description ?? 'Explora productos disponibles para compra y asesoría especializada.'}
            </p>
            <span className="sr-only sm:not-sr-only sm:text-sm sm:font-semibold sm:text-[var(--color-industrial-yellow)]">
              Ver productos
            </span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
