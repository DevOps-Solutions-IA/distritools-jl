import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pedidos admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminOrdersPage() {
  return AdminSectionPage({ moduleKey: "pedidos" });
}
