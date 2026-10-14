import { iamProxy } from "@/features/admin/system/proxy";
import { providersSchema } from "@/features/admin/system/contracts";
export async function GET(request: Request) {
  return iamProxy(request, `/admin/settings/providers`, "GET", providersSchema);
}
