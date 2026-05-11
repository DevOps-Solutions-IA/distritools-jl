import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Configuración admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminSettingsPage() {
  return AdminSectionPage({ moduleKey: "configuracion" });
}
