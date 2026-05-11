import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Categorías admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminCategoriesPage() {
  return AdminSectionPage({ moduleKey: "categorias" });
}
