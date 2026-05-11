import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Marcas admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminBrandsPage() {
  return AdminSectionPage({ moduleKey: "marcas" });
}
