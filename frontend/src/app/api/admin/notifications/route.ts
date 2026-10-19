import {
  logisticsProxy,
  listNotifications,
  logisticsInvalid,
} from "@/features/admin/logistics/bff";
export function GET(request: Request) {
  const p = new URL(request.url).searchParams;
  const l = p.get("limit");
  if (l !== null && (!/^\d+$/.test(l) || Number(l) < 1 || Number(l) > 100))
    return logisticsInvalid();
  return logisticsProxy(request, "/admin/notifications", listNotifications);
}
