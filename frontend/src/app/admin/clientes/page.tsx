import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Clientes admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminCustomersPage() {
  return AdminSectionPage({ moduleKey: "clientes" });
}
