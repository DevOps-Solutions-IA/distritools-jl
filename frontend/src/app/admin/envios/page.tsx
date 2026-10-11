import type { SectionSearchParams } from '@/features/admin/platform/query';
import { AdminSectionPage } from '@/components/admin/AdminSectionPage';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Envíos admin | DistriTools JL', robots: { index: false, follow: false } };

export default async function AdminShipmentsPage({ searchParams }: { searchParams?: Promise<SectionSearchParams> } = {}) {
  return AdminSectionPage({ moduleKey: "envios", readQuery: await searchParams ?? {} });
}
