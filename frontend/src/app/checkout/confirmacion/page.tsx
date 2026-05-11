import type { Metadata } from 'next';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { StorefrontLinkButton } from '@/components/storefront/StorefrontButton';
import { Card, CardBody } from '@/components/ui/Card';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: `Confirmación | ${siteConfig.name}`,
  description: 'Confirmación de solicitud de compra o cotización en DistriTools JL.',
  robots: { index: false, follow: false },
};

type SearchParamsValue = string | string[] | undefined;

function getSingleValue(value: SearchParamsValue) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const order = getSingleValue(resolvedSearchParams.order);
  const type = getSingleValue(resolvedSearchParams.type);
  const method = getSingleValue(resolvedSearchParams.method);
  const isQuote = type === 'quote';
  const paymentCopy =
    method === 'cash_on_delivery'
      ? {
          title: 'Pago contra entrega seleccionado',
          status: 'Pago pendiente contra entrega',
          detail: 'Confirmaremos cobertura, disponibilidad y valor final antes del despacho.',
        }
      : method === 'pse'
        ? {
            title: 'Pago en proceso',
            status: 'Pendiente de autorización bancaria',
            detail: 'El estado final dependerá de la respuesta segura del proveedor.',
          }
        : {
            title: 'Pago por coordinar',
            status: 'Pendiente de confirmación',
            detail: 'Te contactaremos para definir el método de pago después de revisar la solicitud.',
          };

  return (
    <StorefrontShell>
      <section className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        <Card variant="elevated" className="overflow-hidden rounded-[1.35rem] sm:rounded-[2rem]">
          <CardBody className="space-y-5 p-4 sm:space-y-6 sm:p-8">
            <div className="space-y-2 sm:space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                Confirmación
              </p>
              <h1 className="text-2xl font-semibold text-[var(--color-off-white)] sm:text-4xl">
                {isQuote ? 'Solicitud recibida' : 'Pedido recibido'}
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
                {isQuote
                  ? 'Confirmaremos precio y disponibilidad antes de finalizar.'
                  : paymentCopy.detail}
              </p>
              {order ? (
                <p className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--color-off-white)]">
                  Número de pedido: {order}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                isQuote ? 'Solicitud por cotizar.' : paymentCopy.title,
                paymentCopy.status,
                'Envío pendiente de confirmación.',
              ].map((step) => (
                <div
                  key={step}
                  className="rounded-2xl border border-[var(--color-border)] bg-white/[0.035] p-3 text-sm leading-6 text-[var(--color-text-secondary)] sm:p-4"
                >
                  {step}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <StorefrontLinkButton href="/">Volver al inicio</StorefrontLinkButton>
              <StorefrontLinkButton href="/productos" storefrontVariant="secondary">
                Seguir comprando
              </StorefrontLinkButton>
              <a href={siteConfig.whatsappUrl} target="_blank" rel="noreferrer">
                <span className="focus-ring inline-flex h-11 items-center justify-center rounded-full border border-white/15 bg-white/[0.055] px-5 text-sm font-semibold text-[var(--color-off-white)] transition hover:border-[var(--color-industrial-yellow)] hover:bg-white/10">
                  Contactar
                </span>
              </a>
            </div>
          </CardBody>
        </Card>
      </section>
    </StorefrontShell>
  );
}
