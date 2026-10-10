import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { AdminTable } from '../shared/AdminTable';
import type { SectionScreenAdapter, SectionScreenProps } from '../shared/types';

export function PedidosScreen({ operations }: SectionScreenProps<'orders'>) {
  return (
    <AdminTable
      title="Pedidos"
      description="Listado real de pedidos con cliente enmascarado, pago asociado y total confirmado."
      rows={operations.orders.data}
      columns={[
        {
          key: 'order',
          label: 'Pedido',
          render: (order) => (
            <span className="font-semibold text-[var(--color-off-white)]">
              {order.orderNumber}
            </span>
          ),
        },
        {
          key: 'status',
          label: 'Estado',
          render: (order) => <Badge variant="info">{order.status}</Badge>,
        },
        {
          key: 'customer',
          label: 'Cliente',
          render: (order) => (
            <div>
              <p>{order.customerName}</p>
              <p className="text-xs">{order.customerEmail}</p>
            </div>
          ),
        },
        {
          key: 'payment',
          label: 'Pago',
          render: (order) =>
            order.paymentStatus ? (
              <Badge variant="warning">{order.paymentStatus}</Badge>
            ) : (
              'Sin pago'
            ),
        },
        {
          key: 'total',
          label: 'Total',
          render: (order) =>
            `$ ${Number(order.grandTotal).toLocaleString('es-CO')}`,
        },
        {
          key: 'actions',
          label: 'Acciones',
          render: (order) => (
            <Link
              className="text-[var(--color-industrial-yellow)] hover:underline"
              href={`/admin/pedidos/${order.id}`}
            >
              Detalle
            </Link>
          ),
        },
      ]}
    />
  );
}

export function PagosScreen({ operations }: SectionScreenProps<'payments'>) {
  return (
    <AdminTable
      title="Pagos"
      description="Pagos reales asociados a pedidos. PSE permanece cerrado si no hay provider configurado."
      rows={operations.payments.data}
      columns={[
        {
          key: 'order',
          label: 'Pedido',
          render: (payment) => payment.orderNumber,
        },
        {
          key: 'gateway',
          label: 'Método',
          render: (payment) => <Badge variant="info">{payment.gateway}</Badge>,
        },
        {
          key: 'status',
          label: 'Estado',
          render: (payment) => (
            <Badge
              variant={payment.status === 'approved' ? 'success' : 'warning'}
            >
              {payment.status}
            </Badge>
          ),
        },
        {
          key: 'amount',
          label: 'Monto',
          render: (payment) =>
            `$ ${Number(payment.amount).toLocaleString('es-CO')}`,
        },
        {
          key: 'reference',
          label: 'Referencia',
          render: (payment) =>
            payment.providerReference ?? 'Sin referencia externa',
        },
        {
          key: 'actions',
          label: 'Acciones',
          render: (payment) => (
            <Link
              className="text-[var(--color-industrial-yellow)] hover:underline"
              href={`/admin/pagos/${payment.id}`}
            >
              Detalle
            </Link>
          ),
        },
      ]}
    />
  );
}

export const salesSectionAdapters = {
  pedidos: { Screen: PedidosScreen },
  pagos: { Screen: PagosScreen },
} satisfies Record<'pedidos' | 'pagos', SectionScreenAdapter>;
