import { AdminCategoriesScreen } from '@/components/admin/AdminCatalogScreens';
import { AdminShell } from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Categorías admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminCategoriesPage({ searchParams }: { searchParams: Promise<{ search?: string; status?: string }> }) {
  const params = await searchParams;
  const categories = await AdminCategoriesScreen({ search: params.search ?? '', status: params.status ?? 'all' });
  return (
    <AdminShell>
      {categories}
    </AdminShell>
  );
}
