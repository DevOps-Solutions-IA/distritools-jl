import type { Metadata } from 'next';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminShell } from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Dashboard admin | DistriTools JL',
  robots: { index: false, follow: false },
};

interface AdminDashboardPageProps {
  searchParams?: Promise<{ range?: string }>;
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const resolvedSearchParams = await searchParams;
  return (
    <AdminShell>
      {await AdminDashboard({ range: resolvedSearchParams?.range ?? '30d' })}
    </AdminShell>
  );
}
