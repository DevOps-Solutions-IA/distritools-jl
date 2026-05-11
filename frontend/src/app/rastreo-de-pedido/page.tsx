import type { Metadata } from 'next';
import Link from 'next/link';
import { trackPublicOrder } from '@/lib/api/orders';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { StorefrontButton, StorefrontLinkButton } from '@/components/storefront/StorefrontButton';
import { StorefrontInput } from '@/components/storefront/StorefrontFields';
import { siteConfig } from '@/config/site';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rastreo de pedido | DistriTools JL',
  description: 'Consulta el estado comercial de tu pedido sin exponer datos personales.',
};

interface TrackingPageProps {
  searchParams?: Promise<{ orden?: string }>;
}

function translateStatus(status: string) {
  const labels: Record<string, string> = {
    recibido: 'Pedido recibido',
    pendiente_confirmacion: 'Pendiente de confirmación',
    preparando: 'Preparando pedido',
    pendiente_guia: 'Guía pendiente de asignación',
    enviado: 'Enviado',
    en_camino: 'En camino',
    entregado: 'Entregado',
    no_encontrado: 'No encontrado',
    requiere_contacto: 'Requiere contacto',
  };
  return labels[status] ?? 'Seguimiento operativo interno';
}

export default async function OrderTrackingPage({ searchParams }: TrackingPageProps) {
  const params = await searchParams;
  const orderNumber = params?.orden?.trim();
  const tracking = orderNumber
    ? await trackPublicOrder(orderNumber).catch(() => null)
    : null;

  return (
    <StorefrontShell>
    <div className="mx-auto max-w-4xl space-y-6">
      <section className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-elevated sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
          Rastreo
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-off-white)] sm:text-4xl">
          Rastreo de pedido
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
          Consulta el estado comercial con tu número de pedido. No mostramos dirección, teléfono ni correo en esta vista pública.
        </p>
        <form className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
          <StorefrontInput
            name="orden"
            defaultValue={orderNumber}
            placeholder="Número de pedido o guía"
            aria-label="Número de pedido o guía"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            autoCapitalize="none"
            inputMode="search"
          />
          <StorefrontButton type="submit">Consultar</StorefrontButton>
        </form>
      </section>

      {orderNumber ? (
        tracking && tracking.publicStatus !== 'no_encontrado' ? (
          <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5">
            <p className="text-sm text-[var(--color-text-secondary)]">Pedido</p>
            <h2 className="mt-1 text-2xl font-semibold text-[var(--color-off-white)]">{tracking.orderNumber}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Estado</p>
                <p className="mt-2 font-semibold text-[var(--color-off-white)]">{translateStatus(tracking.publicStatus)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Pago</p>
                <p className="mt-2 font-semibold text-[var(--color-off-white)]">{translateStatus(tracking.paymentStatus ?? 'pendiente_confirmacion')}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">Envío</p>
                <p className="mt-2 font-semibold text-[var(--color-off-white)]">{translateStatus(tracking.shippingStatus)}</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl border border-dashed border-white/12 p-4 text-sm leading-6 text-[var(--color-text-secondary)]">
              <p>Transportadora: {tracking.carrier ?? 'Pendiente de proveedor real'}</p>
              <p>Guía: {tracking.trackingNumber ?? 'Guía pendiente de asignación'}</p>
              <p>Entrega estimada: {tracking.estimatedDeliveryDate ?? 'Pendiente de confirmación operativa'}</p>
            </div>
            <div className="mt-5 space-y-3">
              <h3 className="text-lg font-semibold text-[var(--color-off-white)]">Timeline</h3>
              {tracking.events.map((event) => (
                <div key={`${event.label}-${event.status}`} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="font-semibold text-[var(--color-off-white)]">{event.label}</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{event.description}</p>
                  {event.date ? (
                    <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{new Date(event.date).toLocaleString('es-CO')}</p>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-[var(--color-text-secondary)]">{tracking.nextStep}</p>
            <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
              <a
                href={siteConfig.whatsappUrl}
                target="_blank"
                rel="noreferrer"
                className="focus-ring inline-flex h-11 items-center justify-center rounded-full bg-[var(--color-industrial-yellow)] px-5 text-sm font-semibold text-[#111]"
              >
                Escribir por WhatsApp
              </a>
              <StorefrontLinkButton href="/contacto" storefrontVariant="secondary">
                Contactar soporte
              </StorefrontLinkButton>
            </div>
          </section>
        ) : (
          <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5">
            <h2 className="text-xl font-semibold text-[var(--color-off-white)]">No encontramos ese pedido</h2>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Revisa el número o solicita asesoría para validar el estado.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/contacto" className="text-sm font-semibold text-[var(--color-industrial-yellow)]">
                Contactar soporte
              </Link>
              <a href={siteConfig.whatsappUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-[var(--color-industrial-yellow)]">
                Escribir por WhatsApp
              </a>
            </div>
          </section>
        )
      ) : null}
    </div>
    </StorefrontShell>
  );
}
