import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Roles admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminRolesPage() {
  return AdminSectionPage({ moduleKey: "roles" });
}
