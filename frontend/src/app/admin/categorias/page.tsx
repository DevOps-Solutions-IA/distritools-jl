import { AdminCatalog } from '@/components/admin/AdminCatalog';
import { AdminShell } from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Categorías admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminCategoriesPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string }> }) {
  const params = await searchParams;
  const catalog = await AdminCatalog({ mode: 'categories', search: params.search ?? '', status: params.status ?? 'all' });
  return (
    <AdminShell>
      {catalog}
    </AdminShell>
  );
}
