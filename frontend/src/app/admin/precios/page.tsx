import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Precios admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminPricesPage() {
  return AdminSectionPage({ moduleKey: "precios" });
}
