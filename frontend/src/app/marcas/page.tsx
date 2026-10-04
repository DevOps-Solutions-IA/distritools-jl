import type { Metadata } from 'next';
import { BrandStrip } from '@/components/catalog/BrandStrip';
import { CatalogHeader } from '@/components/catalog/CatalogHeader';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { ErrorState } from '@/components/ui/ErrorState';
import { getBrandDirectoryData } from '@/features/catalog/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Marcas industriales | DistriTools JL',
  description:
    'Explora marcas de herramientas, compresores, fijación, soldadura y soluciones industriales en DistriTools JL.',
};

export default async function BrandsPage() {
  async function loadPageData() {
    const { data } = await getBrandDirectoryData();

    return { data };
  }

  let pageData: Awaited<ReturnType<typeof loadPageData>>;
  try {
    pageData = await loadPageData();
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible cargar marcas"
          description={error instanceof Error ? error.message : 'No pudimos cargar las marcas.'}
        />
      </StorefrontShell>
    );
  }

  const { data } = pageData;

  return (
    <StorefrontShell>
      <section className="space-y-8">
        <CatalogHeader
          eyebrow="Marcas"
          title="Compra por fabricante"
          description="Encuentra líneas por marca y entra directo a productos disponibles con precio y stock."
          stats={[`${data.brands.length} marcas`, 'Compra directa']}
          primaryHref="/productos"
          primaryLabel="Ver productos"
        />
        <BrandStrip brands={data.brands} />
      </section>
    </StorefrontShell>
  );

}
