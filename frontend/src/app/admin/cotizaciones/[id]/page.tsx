import { AdminDetailPage } from '@/components/admin/AdminDetailPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Detalle cotización admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminQuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return AdminDetailPage({
    title: 'Detalle de cotización',
    backHref: '/admin/cotizaciones',
    backLabel: 'Volver a cotizaciones',
    backendPath: `/admin/quotes/${id}`,
  });
}
