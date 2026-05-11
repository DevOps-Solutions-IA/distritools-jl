import type { Metadata } from 'next';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminShell } from '@/components/layout/AdminShell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin | DistriTools JL',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  return <AdminShell>{await AdminDashboard()}</AdminShell>;
}
