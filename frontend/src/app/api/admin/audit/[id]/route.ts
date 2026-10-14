import { iamProxy } from "@/features/admin/system/proxy";
import { auditSchema, sanitizeAudit } from "@/features/admin/system/contracts";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return iamProxy(
    request,
    `/admin/audit/${encodeURIComponent(id)}`,
    "GET",
    auditSchema,
    undefined,
    (value) => ({
      ...value,
      beforeData: sanitizeAudit(value.beforeData),
      afterData: sanitizeAudit(value.afterData),
    }),
  );
}
