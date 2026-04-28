import type { Metadata } from 'next';
import Link from 'next/link';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = {
  title: `${siteConfig.name} | Retorno de pago`,
  description:
    'Pantalla informativa de retorno de pago. La confirmación definitiva depende del backend y sus webhooks.',
};

type SearchParamsValue = string | string[] | undefined;

function getSingleValue(value: SearchParamsValue) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const orderNumber = getSingleValue(resolvedSearchParams.orderNumber);
  const gateway = getSingleValue(resolvedSearchParams.gateway);
  const status = getSingleValue(resolvedSearchParams.status);

  return (
    <StorefrontShell>
      <section className="space-y-8">
        <div className="space-y-4">
          <Badge variant="warning">Retorno informativo</Badge>
          <h1 className="text-4xl font-semibold text-[var(--color-graphite-black)]">
            El pago no se confirma desde frontend
          </h1>
          <p className="max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">
            Esta vista solo informa parámetros de retorno. La aprobación o rechazo real del pago se define en backend mediante webhook firmado.
          </p>
        </div>

        <Card variant="elevated">
          <CardBody className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-steel-gray)]">
                Orden
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-graphite-black)]">
                {orderNumber ?? 'No informada'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-steel-gray)]">
                Pasarela
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-graphite-black)]">
                {gateway ?? 'No informada'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-steel-gray)]">
                Estado retornado
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-graphite-black)]">
                {status ?? 'Informativo'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-steel-gray)]">
                Fuente de verdad
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-graphite-black)]">
                Backend + webhook
              </p>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row">
          {orderNumber ? (
            <Link href={`/storefront/orden/${orderNumber}`}>
              <Button size="lg">Ver estado de orden</Button>
            </Link>
          ) : null}
          <a
            href={siteConfig.whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
          >
            Pedir ayuda por WhatsApp
          </a>
        </div>
      </section>
    </StorefrontShell>
  );
}
