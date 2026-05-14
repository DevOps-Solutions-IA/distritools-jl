import { AdminProductsScreen } from '@/components/admin/AdminCatalogScreens';
import { AdminShell } from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Productos admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string }> }) {
  const params = await searchParams;
  const products = await AdminProductsScreen(searchParamsObject(params));
  return (
    <AdminShell>
      {products}
    </AdminShell>
  );
}

function searchParamsObject(params: { search?: string; status?: string }) {
  return { search: params.search ?? '', status: params.status ?? 'all' };
}
