import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Productos admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminProductsPage() {
  return AdminSectionPage({ moduleKey: "productos" });
}
