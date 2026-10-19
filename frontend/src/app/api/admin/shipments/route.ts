import { logisticsProxy, listShipments } from "@/features/admin/logistics/bff";
export function GET(request: Request) {
  return logisticsProxy(request, "/admin/shipments", listShipments);
}
