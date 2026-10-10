import Link from 'next/link';
import type { SectionScreenAdapter, SectionScreenProps } from '../shared/types';

export function ReportesScreen({
  operations,
}: SectionScreenProps<'orders' | 'payments' | 'customers' | 'quotes'>) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {[
        ['Pedidos', operations.orders.meta?.total ?? 0, '/admin/pedidos'],
        ['Pagos', operations.payments.meta?.total ?? 0, '/admin/pagos'],
        ['Clientes', operations.customers.meta?.total ?? 0, '/admin/clientes'],
        [
          'Cotizaciones',
          operations.quotes.meta?.total ?? 0,
          '/admin/cotizaciones',
        ],
      ].map(([label, value, href]) => (
        <Link
          key={label}
          href={String(href)}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-[var(--color-industrial-yellow)]"
        >
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
            {label}
          </p>
          <p className="mt-3 text-3xl font-semibold text-[var(--color-off-white)]">
            {value}
          </p>
        </Link>
      ))}
    </section>
  );
}

export const controlSectionAdapters = {
  reportes: {
    Screen: ReportesScreen,
    actions: [{ label: 'Productos incompletos', href: '/admin/productos' }],
  },
} satisfies Record<'reportes', SectionScreenAdapter>;
