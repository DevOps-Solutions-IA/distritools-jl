import { adminFetch, AdminReadError } from "@/lib/admin/server-data";
import {
  adminContractFailure,
  adminFailure,
} from "@/lib/admin/transport/result";
import { record, shipmentStatuses } from "./contract";
export async function logisticsRead<T>(path: string): Promise<T> {
  const r = await adminFetch<T>(path);
  if (!r.ok) throw new AdminReadError(r);
  return r.data;
}
export async function logisticsPermissions(
  required: string,
): Promise<string[]> {
  const s = record(await logisticsRead("/admin/session"));
  const user = record(s.user);
  if (
    !Array.isArray(user.permissions) ||
    !user.permissions.every((p) => typeof p === "string")
  )
    throw new AdminReadError(adminContractFailure(200));
  if (!user.permissions.includes(required))
    throw new AdminReadError(adminFailure(403));
  return user.permissions as string[];
}
export function checked<T>(parse: () => T): T {
  try {
    return parse();
  } catch {
    throw new AdminReadError(adminContractFailure(200));
  }
}
export function validateShipmentQuery(
  query: Readonly<Record<string, string | undefined>>,
) {
  for (const [key, max] of [
    ["page", 10000],
    ["limit", 100],
  ] as const) {
    const v = query[key];
    if (
      v !== undefined &&
      (!/^\d+$/.test(v) ||
        !Number.isSafeInteger(Number(v)) ||
        Number(v) < 1 ||
        Number(v) > max)
    )
      throw new AdminReadError(adminFailure(400));
  }
  if (
    (query.search && query.search.length > 200) ||
    (query.direction && !["asc", "desc"].includes(query.direction)) ||
    (query.status &&
      !shipmentStatuses.includes(
        query.status as (typeof shipmentStatuses)[number],
      ))
  )
    throw new AdminReadError(adminFailure(400));
  return query;
}
