import { AdminDetailPage } from '@/components/admin/AdminDetailPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Detalle pedido admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return AdminDetailPage({
    title: 'Detalle de pedido',
    backHref: '/admin/pedidos',
    backLabel: 'Volver a pedidos',
    backendPath: `/admin/orders/${id}`,
  });
}
