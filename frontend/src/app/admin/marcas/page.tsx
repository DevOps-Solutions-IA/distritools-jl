import { AdminCatalog } from '@/components/admin/AdminCatalog';
import { AdminShell } from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marcas admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminBrandsPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string }> }) {
  const params = await searchParams;
  const catalog = await AdminCatalog({ mode: 'brands', search: params.search ?? '', status: params.status ?? 'all' });
  return (
    <AdminShell>
      {catalog}
    </AdminShell>
  );
}
