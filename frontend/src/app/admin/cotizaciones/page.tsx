import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cotizaciones admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminQuotesPage() {
  return AdminSectionPage({ moduleKey: "cotizaciones" });
}
