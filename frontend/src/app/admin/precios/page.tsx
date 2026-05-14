import { AdminPricesScreen } from '@/components/admin/AdminCatalogScreens';
import { AdminShell } from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Precios admin | DistriTools JL', robots: { index: false, follow: false } };

interface PageProps {
  searchParams?: Promise<{ search?: string; status?: string }>;
}

export default async function AdminPricesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const prices = await AdminPricesScreen({ search: params?.search ?? '', status: params?.status ?? 'all' });
  return (
    <AdminShell>
      {prices}
    </AdminShell>
  );
}
