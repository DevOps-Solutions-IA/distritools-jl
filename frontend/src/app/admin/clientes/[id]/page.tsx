import { AdminDetailPage } from '@/components/admin/AdminDetailPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Detalle cliente admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return AdminDetailPage({
    title: 'Detalle de cliente',
    backHref: '/admin/clientes',
    backLabel: 'Volver a clientes',
    backendPath: `/admin/customers/${encodeURIComponent(id)}`,
  });
}
