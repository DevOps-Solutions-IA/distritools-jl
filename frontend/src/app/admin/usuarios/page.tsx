import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Usuarios admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminUsersPage() {
  return AdminSectionPage({ moduleKey: "usuarios" });
}
