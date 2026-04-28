import type { Metadata } from 'next';
import Link from 'next/link';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonVariants } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/ErrorState';
import { getPublicOrder } from '@/lib/api/orders';
import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils/cn';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}): Promise<Metadata> {
  const { orderNumber } = await params;

  return {
    title: `${siteConfig.name} | Orden ${orderNumber}`,
    description: `Consulta pública informativa de la orden ${orderNumber} en DistriTools JL.`,
  };
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;

  try {
    const order = await getPublicOrder(orderNumber);

    return (
      <StorefrontShell>
        <section className="space-y-8">
          <div className="space-y-4">
            <Badge variant="info">Estado público de orden</Badge>
            <h1 className="text-4xl font-semibold text-[var(--color-graphite-black)]">
              Orden {order.orderNumber}
            </h1>
            <p className="max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">
              Esta pantalla es informativa. El estado final del pago y la conciliación operativa dependen del backend y sus webhooks.
            </p>
          </div>

          <Card variant="elevated">
            <CardBody className="grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-steel-gray)]">
                  Cliente
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--color-graphite-black)]">
                  {order.customerName}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-steel-gray)]">
                  Estado
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--color-graphite-black)]">
                  {order.status}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-steel-gray)]">
                  Total informado
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--color-graphite-black)]">
                  {order.grandTotal}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-steel-gray)]">
                  Creada
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--color-graphite-black)]">
                  {new Date(order.createdAt).toLocaleString('es-CO')}
                </p>
              </div>
            </CardBody>
          </Card>

          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={siteConfig.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
            >
              Contactar por WhatsApp
            </a>
            <Link href="/storefront/productos">
              <Button size="lg">Volver a la tienda</Button>
            </Link>
          </div>
        </section>
      </StorefrontShell>
    );
  } catch (error) {
    return (
      <StorefrontShell>
        <ErrorState
          title="No fue posible consultar la orden"
          description={
            error instanceof Error
              ? error.message
              : 'El backend no devolvió información pública de la orden.'
          }
          retryLabel="Reintentar"
        />
      </StorefrontShell>
    );
  }
}
