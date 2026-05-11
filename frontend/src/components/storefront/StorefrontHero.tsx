import Link from 'next/link';
import { StorefrontLinkButton } from '@/components/storefront/StorefrontButton';

interface StorefrontHeroProps {
  featuredFamilies?: string[];
}

export function StorefrontHero({ featuredFamilies = [] }: StorefrontHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-[1.35rem] border border-[var(--color-border)] bg-[radial-gradient(circle_at_top_left,rgba(245,183,0,0.14),transparent_26%),linear-gradient(140deg,#0b0b0b_0%,#070707_100%)] p-4 text-[var(--color-off-white)] shadow-soft sm:p-6 lg:rounded-2xl lg:p-8">
      <div className="grid gap-4 lg:grid-cols-[1fr_0.85fr] lg:items-center">
        <div className="space-y-4">
          <p className="w-fit rounded-full bg-[rgba(245,183,0,0.12)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">
            Herramientas que construyen resultados
          </p>
          <div className="space-y-2">
            <h1 className="font-display text-[2rem] font-semibold leading-[1.02] tracking-tight sm:text-5xl">
              Compra herramientas en segundos.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base">
              Herramientas, compresores, fijación y soldadura para obra, taller e industria.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <StorefrontLinkButton href="/productos" storefrontSize="large" className="w-full sm:w-auto">
              Ver productos
            </StorefrontLinkButton>
            <StorefrontLinkButton href="/rastreo-de-pedido" storefrontVariant="secondary" storefrontSize="large" className="w-full sm:w-auto">
              Rastreo
            </StorefrontLinkButton>
          </div>
        </div>

        <div className="hidden grid-cols-2 gap-2 sm:grid sm:grid-cols-3 lg:grid-cols-2">
          {featuredFamilies.slice(0, 4).map((family) => (
            <Link
              key={family}
              href={`/productos?q=${encodeURIComponent(family)}`}
              className="rounded-2xl border border-white/8 bg-[rgba(255,255,255,0.04)] px-3 py-3 text-sm font-semibold text-[rgba(249,249,249,0.92)] transition hover:border-[var(--color-industrial-yellow)]"
            >
              {family}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
