import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Notificaciones admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminNotificationsPage() {
  return AdminSectionPage({ moduleKey: 'notificaciones' });
}
