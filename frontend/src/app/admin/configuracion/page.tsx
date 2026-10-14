import { AdminShell } from "@/components/layout/AdminShell";
import { AdminReadFailure } from "@/features/admin/platform/ReadFailure";
import { iamRead, iamSession, iamLoad } from "@/features/admin/system/server";
import {
  settingsSchema,
  providersSchema,
} from "@/features/admin/system/contracts";
import { SettingsWorkspace } from "@/features/admin/system/Workspaces";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Configuración admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const result = await iamLoad(async () => {
    const user = await iamSession("settings.read");
    const [settings, providers] = await Promise.all([
      iamRead("/admin/settings", settingsSchema),
      iamRead("/admin/settings/providers", providersSchema),
    ]);
    return { settings, providers, user };
  });
  return (
    <AdminShell>
      {result.ok ? (
        <SettingsWorkspace
          settings={result.data.settings}
          providers={result.data.providers}
          permissions={result.data.user.permissions}
        />
      ) : (
        <AdminReadFailure result={result.result} />
      )}
    </AdminShell>
  );
}
