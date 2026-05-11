import Link from 'next/link';
import { BrandFamilyList } from '@/components/catalog/BrandFamilyList';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardFooter } from '@/components/ui/Card';
import type { CatalogBrand } from '@/features/catalog/types';

interface BrandCardProps {
  brand: CatalogBrand;
}

function getBrandMonogram(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function BrandCard({ brand }: BrandCardProps) {
  const families = brand.metadata?.productFamilies ?? [];
  const industrialFocus = brand.metadata?.industrialFocus ?? [];

  return (
    <Card
      variant="elevated"
      className="flex h-full flex-col overflow-hidden border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(22,22,22,0.98),rgba(8,8,8,0.98))] transition-transform duration-300 hover:-translate-y-1 hover:shadow-elevated"
    >
      <CardBody className="flex flex-1 flex-col gap-7 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">Marca activa</Badge>
              <Badge variant="neutral">Taxonomía validada</Badge>
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold text-[var(--color-off-white)]">{brand.name}</h3>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                {brand.metadata?.shortDescription ?? brand.description ?? 'Portafolio técnico para trabajo industrial y comercial.'}
              </p>
            </div>
          </div>
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[rgba(245,183,0,0.08)] text-lg font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)] shadow-[0_0_40px_rgba(245,183,0,0.12)]">
            {getBrandMonogram(brand.name)}
          </div>
        </div>

        {industrialFocus.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {industrialFocus.slice(0, 4).map((focus) => (
              <div
                key={focus}
                className="rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3 text-sm text-[var(--color-off-white)]"
              >
                {focus}
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-3 border-t border-white/8 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-industrial-yellow)]">
            Familias principales
          </p>
          <BrandFamilyList families={families} />
        </div>
      </CardBody>

      <CardFooter className="flex flex-col gap-3 border-t border-[var(--color-border)] p-6 sm:flex-row">
        <Link href={`/marcas/${brand.slug}`} className="w-full">
          <Button className="w-full">Ver marca</Button>
        </Link>
        <Link href={`/productos?brand=${brand.slug}`} className="w-full">
          <Button variant="outline" className="w-full">
            Filtrar catálogo
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
