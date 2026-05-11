import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Envíos admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminShipmentsPage() {
  return AdminSectionPage({ moduleKey: "envios" });
}
