import { AdminShell } from "@/components/layout/AdminShell";
import { AdminReadFailure } from "@/features/admin/platform/ReadFailure";
import { iamRead, iamSession, iamLoad } from "@/features/admin/system/server";
import { auditsSchema, sanitizeAudit } from "@/features/admin/system/contracts";
import { AuditWorkspace } from "@/features/admin/system/Workspaces";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Auditoría admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await iamLoad(async () => {
    await iamSession("audit.read");
    const query = await searchParams;
    const filters: Record<string, string> = {};
    for (const key of ["action", "entityType", "entityId", "limit"]) {
      const value = query[key];
      if (typeof value === "string" && value) filters[key] = value;
    }
    const result = await iamRead(
      `/admin/audit?${new URLSearchParams(filters)}`,
      auditsSchema,
    );
    const entries = result.data.map((v) => ({
      ...v,
      beforeData: sanitizeAudit(v.beforeData),
      afterData: sanitizeAudit(v.afterData),
    }));
    return { entries, filters };
  });
  return (
    <AdminShell>
      {result.ok ? (
        <AuditWorkspace
          entries={result.data.entries}
          filters={result.data.filters}
        />
      ) : (
        <AdminReadFailure result={result.result} />
      )}
    </AdminShell>
  );
}
