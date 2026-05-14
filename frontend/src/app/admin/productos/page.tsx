import { AdminCatalog } from '@/components/admin/AdminCatalog';
import { AdminShell } from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Productos admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string; tab?: string }> }) {
  const params = await searchParams;
  const catalog = await AdminCatalog({
    mode: params.tab === 'products' ? 'products' : 'overview',
    search: params.search ?? '',
    status: params.status ?? 'all',
  });
  return (
    <AdminShell>
      {catalog}
    </AdminShell>
  );
}
