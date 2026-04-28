import type { Metadata } from 'next';
import { BrandStrip } from '@/components/catalog/BrandStrip';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { Badge } from '@/components/ui/Badge';
import { ErrorState } from '@/components/ui/ErrorState';
import { getBrandDirectoryData } from '@/features/catalog/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'DistriTools JL | Marcas industriales',
  description:
    'Explora las marcas industriales y familias de producto que estructuran el catálogo de DistriTools JL.',
};

export default async function BrandsPage() {
  try {
    const { data } = await getBrandDirectoryData();

    return (
      <StorefrontShell>
        <section className="grid gap-6 rounded-[2rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#121212_0%,#0b0b0b_100%)] p-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            <Badge variant="warning">Marcas estratégicas</Badge>
            <div className="space-y-3">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-[var(--color-off-white)] sm:text-5xl">
                Fabricantes y líneas técnicas para construcción, mantenimiento e industria.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[var(--color-text-secondary)]">
                Explora las marcas que estructuran el portafolio de DistriTools JL y navega por sus familias principales.
              </p>
            </div>
          </div>
          <div className="grid gap-3">
            {[
              'Selección enfocada en líneas industriales reales',
              'Familias organizadas para consulta y navegación',
              'Acceso directo a cada marca y su portafolio visible',
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-5 py-4 text-sm text-[var(--color-off-white)]"
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 space-y-5">
          <div className="space-y-2">
            <Badge variant="info">Directorio de marcas</Badge>
            <h2 className="text-3xl font-semibold text-[var(--color-off-white)]">
              Navega por marca y entra directo a su línea principal
            </h2>
          </div>
          <BrandStrip brands={data.brands} />
        </section>
      </StorefrontShell>
    );
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible cargar las marcas"
          description={error instanceof Error ? error.message : 'El backend no respondió como se esperaba.'}
        />
      </StorefrontShell>
    );
  }
}
