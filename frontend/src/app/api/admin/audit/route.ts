import { iamProxy } from "@/features/admin/system/proxy";
import { auditsSchema, sanitizeAudit } from "@/features/admin/system/contracts";
export async function GET(request: Request) {
  return iamProxy(
    request,
    "/admin/audit",
    "GET",
    auditsSchema,
    undefined,
    (value) => ({
      data: value.data.map((row) => ({
        ...row,
        beforeData: sanitizeAudit(row.beforeData),
        afterData: sanitizeAudit(row.afterData),
      })),
    }),
  );
}
