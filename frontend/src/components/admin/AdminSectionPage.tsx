import { AdminShell } from '@/components/layout/AdminShell';
import {
  getAdminCatalogSnapshot,
  getAdminModule,
  type AdminModuleKey,
} from '@/lib/admin/operations';
import { getAdminOperationalSnapshot } from '@/lib/admin/server-data';
import { getSectionScreenAdapter } from '@/features/admin/screen-adapters/section-registry';
import { SectionHeader } from '@/features/admin/screen-adapters/shared/SectionHeader';
import { CatalogSnapshotSummary } from '@/features/admin/screen-adapters/control/CatalogSnapshotSummary';

interface AdminSectionPageProps {
  moduleKey: AdminModuleKey;
}

export async function AdminSectionPage({ moduleKey }: AdminSectionPageProps) {
  const adminModule = getAdminModule(moduleKey);
  const [snapshot, operations] = await Promise.all([
    getAdminCatalogSnapshot(),
    getAdminOperationalSnapshot(),
  ]);
  const { Screen, actions } = getSectionScreenAdapter(moduleKey);

  return (
    <AdminShell>
      <div className="space-y-6">
        <SectionHeader adminModule={adminModule} actions={actions} />
        <Screen
          moduleKey={moduleKey}
          adminModule={adminModule}
          snapshot={snapshot}
          operations={operations}
        />
        <CatalogSnapshotSummary snapshot={snapshot} />
      </div>
    </AdminShell>
  );
}
