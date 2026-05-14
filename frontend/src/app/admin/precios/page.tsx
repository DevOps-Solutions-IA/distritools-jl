import { AdminCatalog } from '@/components/admin/AdminCatalog';
import { AdminShell } from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Precios admin | DistriTools JL', robots: { index: false, follow: false } };

interface PageProps {
  searchParams?: Promise<{ search?: string; status?: string }>;
}

export default async function AdminPricesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const catalog = await AdminCatalog({ mode: 'prices', search: params?.search ?? '', status: params?.status ?? 'all' });
  return (
    <AdminShell>
      {catalog}
    </AdminShell>
  );
}
