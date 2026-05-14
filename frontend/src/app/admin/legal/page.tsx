import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Legal admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminLegalAliasPage() {
  return AdminSectionPage({ moduleKey: 'contenido-legal' });
}
