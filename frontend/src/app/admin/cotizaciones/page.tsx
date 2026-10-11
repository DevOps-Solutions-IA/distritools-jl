import type { SectionSearchParams } from '@/features/admin/platform/query';
import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cotizaciones admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminQuotesPage({ searchParams }: { searchParams?: Promise<SectionSearchParams> } = {}) {
  return AdminSectionPage({ moduleKey: "cotizaciones", readQuery: await searchParams ?? {} });
}
