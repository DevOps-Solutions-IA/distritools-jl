import { AdminDetailPage } from '@/components/admin/AdminDetailPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Detalle pago admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminPaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return AdminDetailPage({
    title: 'Detalle de pago',
    backHref: '/admin/pagos',
    backLabel: 'Volver a pagos',
    backendPath: `/admin/payments/${id}`,
  });
}
