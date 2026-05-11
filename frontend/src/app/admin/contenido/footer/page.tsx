import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Footer admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminFooterContentPage() {
  return AdminSectionPage({ moduleKey: "contenido-footer" });
}
