import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactRequestForm } from '@/components/contact/ContactRequestForm';
import { Card, CardBody } from '@/components/ui/Card';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { StorefrontLinkButton } from '@/components/storefront/StorefrontButton';
import { siteConfig } from '@/config/site';
import { storefrontContactConfig } from '@/config/storefront-contact';

export const metadata: Metadata = {
  title: 'Contacto | DistriTools JL',
  description: 'Canales de contacto comercial para compra, disponibilidad, pedidos y soporte.',
};

export default function ContactPage() {
  const quickHelp = [
    { label: 'Comprar', href: '/productos', mark: '01' },
    { label: 'Pedido', href: '/rastreo-de-pedido', mark: '02' },
    { label: 'Garantías', href: '/cambios-devoluciones-y-garantias', mark: '03' },
    { label: 'Asesoría', href: siteConfig.whatsappUrl, external: true, mark: '04' },
  ];

  return (
    <StorefrontShell>
    <div className="mx-auto max-w-6xl space-y-4 sm:space-y-8">
      <section className="rounded-[1.35rem] border border-[var(--color-border)] bg-[radial-gradient(circle_at_top_left,rgba(245,183,0,0.18),transparent_30%),linear-gradient(145deg,#111_0%,#070707_100%)] p-4 shadow-soft sm:rounded-[2rem] sm:p-8 sm:shadow-elevated">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
          Atención comercial
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-off-white)] sm:text-5xl">
          Contacto
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
          Estamos listos para ayudarte con compra, disponibilidad, pedidos y asesoría técnica.
        </p>
        <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
          <a href={siteConfig.whatsappUrl} target="_blank" rel="noreferrer" className="focus-ring inline-flex h-11 w-full items-center justify-center rounded-full bg-[var(--color-industrial-yellow)] px-5 text-sm font-semibold text-[#111111] transition hover:bg-[var(--color-action-primary-hover)] sm:w-auto">
            Escribir por WhatsApp
          </a>
          <StorefrontLinkButton href="/rastreo-de-pedido" storefrontVariant="secondary" className="w-full sm:w-auto">
            Rastrear pedido
          </StorefrontLinkButton>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <Card variant="elevated">
            <CardBody className="space-y-4 p-4 sm:p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                  Canales
                </p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--color-off-white)]">
                  Atención profesional
                </h2>
              </div>
              <div className="grid gap-3 text-sm">
                <a href={siteConfig.whatsappUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 p-3 text-[var(--color-off-white)]">
                  WhatsApp: {storefrontContactConfig.whatsappDisplay}
                </a>
                <div className="rounded-xl border border-white/10 p-3 text-[var(--color-text-secondary)]">
                  Correo: {storefrontContactConfig.email}
                </div>
                <div className="rounded-xl border border-white/10 p-3 text-[var(--color-text-secondary)]">
                  Base operativa: {storefrontContactConfig.base}
                </div>
                <div className="rounded-xl border border-white/10 p-3 text-[var(--color-text-secondary)]">
                  Atención: {storefrontContactConfig.supportLabel}
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3 p-4 sm:p-5">
              <h2 className="text-lg font-semibold text-[var(--color-off-white)]">
                Ayuda rápida
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {quickHelp.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noreferrer' : undefined}
                    className="grid min-h-16 place-items-center rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-3 text-center text-sm font-semibold text-[var(--color-off-white)] transition hover:border-[var(--color-industrial-yellow)] hover:bg-white/[0.06]"
                  >
                    <span className="text-[10px] text-[var(--color-industrial-yellow)]">{item.mark}</span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            </CardBody>
          </Card>

          <p className="rounded-[1rem] border border-dashed border-white/12 p-3 text-xs leading-5 text-[var(--color-text-secondary)]">
            Responderemos por el canal registrado. Los datos fiscales definitivos serán actualizados por el negocio.
          </p>
        </div>

        <ContactRequestForm />
      </div>
    </div>
    </StorefrontShell>
  );
}
