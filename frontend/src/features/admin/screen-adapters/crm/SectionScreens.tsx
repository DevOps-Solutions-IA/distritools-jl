import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { AdminTable } from '../shared/AdminTable';
import { OperationalNotice } from '../shared/OperationalNotice';
import type { SectionScreenAdapter, SectionScreenProps } from '../shared/types';

export function CotizacionesScreen({
  operations,
}: SectionScreenProps<'quotes'>) {
  return (
    <section className="space-y-4">
      <OperationalNotice
        status={operations.quotes.operationalState?.status}
        message={operations.quotes.operationalState?.message}
      />
      <AdminTable
        title="Cotizaciones"
        description="Cotizaciones persistentes con cliente enmascarado, items reales y estados auditables."
        rows={operations.quotes.data}
        columns={[
          {
            key: 'quote',
            label: 'Cotización',
            render: (quote) => (
              <span className="font-semibold text-[var(--color-off-white)]">
                {quote.quoteNumber}
              </span>
            ),
          },
          {
            key: 'status',
            label: 'Estado',
            render: (quote) => (
              <Badge
                variant={
                  quote.status === 'converted_to_order' ? 'success' : 'warning'
                }
              >
                {quote.status}
              </Badge>
            ),
          },
          {
            key: 'customer',
            label: 'Cliente',
            render: (quote) => (
              <div>
                <p>{quote.customer.fullName}</p>
                <p className="text-xs">{quote.customer.email}</p>
              </div>
            ),
          },
          {
            key: 'items',
            label: 'Items',
            render: (quote) => quote.items.length,
          },
          {
            key: 'total',
            label: 'Subtotal',
            render: (quote) =>
              quote.subtotal
                ? `$ ${Number(quote.subtotal).toLocaleString('es-CO')}`
                : 'Sin precio',
          },
          {
            key: 'actions',
            label: 'Acciones',
            render: (quote) => (
              <Link
                className="text-[var(--color-industrial-yellow)] hover:underline"
                href={`/admin/cotizaciones/${quote.id}`}
              >
                Detalle
              </Link>
            ),
          },
        ]}
      />
    </section>
  );
}

export function ClientesScreen({
  operations,
}: SectionScreenProps<'customers'>) {
  return (
    <AdminTable
      title="Clientes"
      description="Clientes derivados de pedidos reales. PII enmascarada por defecto."
      rows={operations.customers.data}
      columns={[
        {
          key: 'name',
          label: 'Cliente',
          render: (customer) => (
            <span className="font-semibold text-[var(--color-off-white)]">
              {customer.fullName}
            </span>
          ),
        },
        {
          key: 'email',
          label: 'Email',
          render: (customer) => customer.email ?? 'No disponible',
        },
        {
          key: 'phone',
          label: 'Teléfono',
          render: (customer) => customer.phone ?? 'No disponible',
        },
        {
          key: 'orders',
          label: 'Pedidos',
          render: (customer) => customer.ordersCount,
        },
        {
          key: 'spent',
          label: 'Total',
          render: (customer) =>
            `$ ${Number(customer.totalSpent).toLocaleString('es-CO')}`,
        },
        {
          key: 'actions',
          label: 'Acciones',
          render: (customer) => (
            <Link
              className="text-[var(--color-industrial-yellow)] hover:underline"
              href={`/admin/clientes/${encodeURIComponent(customer.id)}`}
            >
              Detalle
            </Link>
          ),
        },
      ]}
    />
  );
}

export const crmSectionAdapters = {
  cotizaciones: { Screen: CotizacionesScreen },
  clientes: { Screen: ClientesScreen },
} satisfies Record<'cotizaciones' | 'clientes', SectionScreenAdapter>;
