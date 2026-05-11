import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pagos admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminPaymentsPage() {
  return AdminSectionPage({ moduleKey: "pagos" });
}
