import { iamProxy } from "@/features/admin/system/proxy";
import { matrixSchema } from "@/features/admin/system/contracts";
export async function GET(request: Request) {
  return iamProxy(request, `/admin/permissions/matrix`, "GET", matrixSchema);
}
