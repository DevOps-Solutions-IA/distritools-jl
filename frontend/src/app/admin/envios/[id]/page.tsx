import { AdminDetailPage } from '@/components/admin/AdminDetailPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Detalle envío admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return AdminDetailPage({
    title: 'Detalle de envío',
    backHref: '/admin/envios',
    backLabel: 'Volver a envíos',
    backendPath: `/admin/shipments/${id}`,
  });
}
