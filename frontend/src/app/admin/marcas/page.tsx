import { AdminBrandsScreen } from '@/components/admin/AdminCatalogScreens';
import { AdminShell } from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marcas admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminBrandsPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string }> }) {
  const params = await searchParams;
  const brands = await AdminBrandsScreen({ search: params.search ?? '', status: params.status ?? 'all' });
  return (
    <AdminShell>
      {brands}
    </AdminShell>
  );
}
