import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Auditoría admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminAuditPage() {
  return AdminSectionPage({ moduleKey: "auditoria" });
}
