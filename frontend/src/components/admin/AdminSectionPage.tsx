import { AdminShell } from '@/components/layout/AdminShell';
import { getAdminModule, type AdminModuleKey } from '@/lib/admin/operations';
import {
  filterSectionQuery,
  type SectionSearchParams,
} from '@/features/admin/platform/query';
import { AdminReadError } from '@/lib/admin/server-data';
import { getSectionScreenAdapter } from '@/features/admin/screen-adapters/section-registry';
import { SectionContextHeader } from '@/features/admin/platform/SectionContextHeader';
import { renderAdminSection } from '@/features/admin/platform/section-data';
import { AdminReadFailure } from '@/features/admin/platform/ReadFailure';
interface AdminSectionPageProps {
  moduleKey: AdminModuleKey;
  readQuery?: SectionSearchParams;
}
export async function AdminSectionPage({
  moduleKey,
  readQuery = {},
}: AdminSectionPageProps) {
  const adminModule = getAdminModule(moduleKey);
  const { actions } = getSectionScreenAdapter(moduleKey);
  let content;
  try {
    content = await renderAdminSection({
      moduleKey,
      adminModule,
      query: filterSectionQuery(moduleKey, readQuery),
    });
  } catch (error) {
    if (!(error instanceof AdminReadError)) throw error;
    content = <AdminReadFailure result={error.result} />;
  }
  return (
    <AdminShell>
      <div className="space-y-6">
        <SectionContextHeader adminModule={adminModule} actions={actions} />
        {content}
      </div>
    </AdminShell>
  );
}
