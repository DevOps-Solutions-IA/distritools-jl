import { AdminReports } from '@/components/admin/AdminReports';
import { AdminShell } from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reportes admin | DistriTools JL', robots: { index: false, follow: false } };

interface AdminReportsPageProps {
  searchParams?: Promise<{ range?: string; tab?: string }>;
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const resolvedSearchParams = await searchParams;
  return (
    <AdminShell>
      {await AdminReports({
        range: resolvedSearchParams?.range ?? '30d',
        tab: resolvedSearchParams?.tab ?? 'sales',
      })}
    </AdminShell>
  );
}
