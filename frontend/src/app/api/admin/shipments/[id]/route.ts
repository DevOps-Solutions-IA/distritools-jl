import { shipmentRoute } from "@/features/admin/logistics/bff";
export function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return shipmentRoute(request, params);
}
