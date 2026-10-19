import type { SectionSearchParams } from "@/features/admin/platform/query";
import {
  getAdminOperationalSnapshot,
  AdminReadError,
} from "@/lib/admin/server-data";
import { adminFailure } from "@/lib/admin/transport/result";
import {
  logisticsPermissions,
  checked,
} from "@/features/admin/logistics/server";
import { logisticsView } from "@/features/admin/logistics/View";
import { notification } from "@/features/admin/logistics/contract";
import { NotificationExplorer } from "@/features/admin/logistics/NotificationExplorer";
import { LogReadFence } from "@/features/admin/logistics/LogReadFence";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Notificaciones admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function AdminNotificationsPage({
  searchParams,
}: { searchParams?: Promise<SectionSearchParams> } = {}) {
  return logisticsView(
    "Notificaciones",
    "Historial persistido de entrega y fallos; no habilita proveedores ni replay manual.",
    async () => {
      const permissions = await logisticsPermissions("notifications.read");
      const q = (await searchParams) ?? {};
      const value = typeof q.limit === "string" ? q.limit : "20";
      if (!/^(10|20|50|100)$/.test(value))
        throw new AdminReadError(adminFailure(400));
      const data = await getAdminOperationalSnapshot(["notifications"], {
        limit: value,
      });
      const rows = checked(() => data.notifications.data.map(notification));
      return (
        <LogReadFence permission="notifications.read">
          <NotificationExplorer
            rows={rows}
            limit={Number(value)}
            settingsRead={permissions.includes("settings.read")}
          />
        </LogReadFence>
      );
    },
  );
}
