import Link from 'next/link';
import { DistriToolsLogo } from '@/components/brand/DistriToolsLogo';
import { siteConfig } from '@/config/site';

interface FooterLinkItem {
  label: string;
  href: string;
  external?: boolean;
}

interface FooterLinkGroup {
  title: string;
  items: FooterLinkItem[];
}

const footerLinks: FooterLinkGroup[] = [
  {
    title: 'Catálogo',
    items: [
      { label: 'Productos', href: '/storefront/productos' },
      { label: 'Marcas', href: '/storefront/marcas' },
    ],
  },
  {
    title: 'Líneas clave',
    items: [
      { label: 'Compresores y aire', href: '/storefront/productos?category=compresores' },
      { label: 'Fijación industrial', href: '/storefront/productos?category=fijacion' },
      { label: 'Soldadura y corte', href: '/storefront/productos?category=soldadura' },
    ],
  },
  {
    title: 'Atención',
    items: [
      { label: 'Asesoría comercial', href: siteConfig.whatsappUrl, external: true },
      { label: 'WhatsApp', href: siteConfig.whatsappUrl, external: true },
    ],
  },
];

export function StorefrontFooter() {
  return (
    <footer className="mt-20 border-t border-[var(--color-border)] bg-[#050505]">
      <div className="enterprise-grid grid gap-10 py-12 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-4">
          <DistriToolsLogo
            size="lg"
            tone="dark"
            className="h-[5rem] w-[22rem] max-w-full"
          />
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-industrial-yellow)]">
            Herramientas que construyen resultados
          </p>
          <p className="max-w-xl text-sm leading-7 text-[var(--color-text-secondary)]">
            Soluciones para industria, mantenimiento, construcción y operación técnica.
          </p>
        </div>

        <div className="grid gap-8 sm:grid-cols-3">
          {footerLinks.map((group) => (
            <div key={group.title} className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                {group.title}
              </h3>
              <div className="grid gap-3">
                {group.items.map((item) =>
                  item.external ? (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-off-white)]"
                    >
                      {item.label}
                    </a>
                  ) : (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-off-white)]"
                    >
                      {item.label}
                    </Link>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="enterprise-grid border-t border-white/6 py-5 text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
        DistriTools JL
      </div>
    </footer>
  );
}
