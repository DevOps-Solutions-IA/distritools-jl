import type { Metadata } from 'next';
import Link from 'next/link';
import { AvailabilityBadge } from '@/components/catalog/AvailabilityBadge';
import { ProductSearchBar } from '@/components/catalog/ProductSearchBar';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { Badge } from '@/components/ui/Badge';
import { buttonVariants } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { getSearchPageData } from '@/features/catalog/queries';
import { siteConfig } from '@/config/site';

export const dynamic = 'force-dynamic';

type SearchParamsValue = string | string[] | undefined;

function getSingleValue(value: SearchParamsValue) {
  return Array.isArray(value) ? value[0] : value;
}

export const metadata: Metadata = {
  title: `${siteConfig.name} | Buscar`,
  description:
    'Busca productos, marcas y categorías dentro del catálogo de DistriTools JL.',
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  try {
    const resolvedSearchParams = (await searchParams) ?? {};
    const query = getSingleValue(resolvedSearchParams.q) ?? '';
    const { data } = await getSearchPageData(query);

    return (
      <StorefrontShell>
        <section className="space-y-8">
          <div className="space-y-4">
            <Badge variant="default">Búsqueda</Badge>
            <h1 className="text-4xl font-semibold text-[var(--color-off-white)]">
              Buscar en catálogo
            </h1>
            <p className="max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">
              Encuentra productos, marcas y categorías desde un único punto de búsqueda.
            </p>
          </div>

          <ProductSearchBar defaultValue={data.query} />

          {!data.query ? (
            <EmptyState
              title="Escribe una búsqueda para continuar"
              description="Puedes buscar por nombre, referencia, marca o categoría."
            />
          ) : data.results.length ? (
            <div className="grid gap-5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {data.results.length} resultados para <strong>{data.query}</strong>
                </p>
                {data.suggestions.length ? (
                  <div className="flex flex-wrap gap-2">
                    {data.suggestions.map((suggestion) => (
                      <Link
                        key={suggestion}
                        href={`/storefront/buscar?q=${encodeURIComponent(suggestion)}`}
                        className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-off-white)]"
                      >
                        {suggestion}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4">
                {data.results.map((result) => (
                  <Link key={result.id} href={result.href} className="block">
                    <Card variant="elevated" className="transition hover:-translate-y-0.5 hover:shadow-medium">
                      <CardBody className="grid gap-4 p-5 lg:grid-cols-[1fr_260px] lg:items-start">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={result.documentType === 'content' ? 'info' : 'neutral'}>
                              {result.documentType === 'content' ? 'Contenido' : 'Referencia'}
                            </Badge>
                            {result.brandName ? <Badge variant="default">{result.brandName}</Badge> : null}
                            {result.categoryName ? <Badge variant="warning">{result.categoryName}</Badge> : null}
                          </div>
                          <div className="space-y-1">
                            <h2 className="text-xl font-semibold text-[var(--color-off-white)]">
                              {result.title}
                            </h2>
                            {result.subtitle ? (
                              <p className="text-sm text-[var(--color-text-secondary)]">{result.subtitle}</p>
                            ) : null}
                          </div>
                          {result.sku ? (
                            <p className="text-sm font-medium text-[var(--color-off-white)]">
                              SKU: {result.sku}
                            </p>
                          ) : null}
                        </div>
                        <AvailabilityBadge availability={result.availability} />
                      </CardBody>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <EmptyState
                title="Sin resultados para esta búsqueda"
                description="Usa otra palabra clave o solicita ayuda comercial por WhatsApp."
              />
              <a
                href={siteConfig.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: 'outline', size: 'lg' })}
              >
                Solicitar apoyo por WhatsApp
              </a>
            </div>
          )}
        </section>
      </StorefrontShell>
    );
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible ejecutar la búsqueda"
          description={
            error instanceof Error
              ? error.message
              : 'El endpoint público de búsqueda no respondió correctamente.'
          }
          retryLabel="Reintentar"
        />
      </StorefrontShell>
    );
  }
}
