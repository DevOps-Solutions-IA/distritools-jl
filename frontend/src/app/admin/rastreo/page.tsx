import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rastreo admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminTrackingPage() {
  return AdminSectionPage({ moduleKey: "rastreo" });
}
