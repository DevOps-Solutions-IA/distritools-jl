import { adminFetch, getAdminReportsData, type AdminReportsData, AdminReadError } from '@/lib/admin/server-data';
import { assertReports } from './contracts';
import { reportParams, type ReportFilters } from './presentation';
export async function readReports(range: string, filters: ReportFilters): Promise<AdminReportsData> {
  if (!Object.values(filters).some(Boolean)) { const data = await getAdminReportsData(range); assertReports(data); return data; }
  const result = await adminFetch<AdminReportsData>(`/admin/reports/summary?${reportParams(range, filters)}`);
  if (!result.ok) throw new AdminReadError(result);
  assertReports(result.data);
  return { ...result.data, errors: {} };
}
