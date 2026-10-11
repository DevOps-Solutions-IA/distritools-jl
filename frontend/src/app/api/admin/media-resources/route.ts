import { proxyAdminRequest } from "@/lib/admin/proxy";
export async function GET(request: Request) {
  return proxyAdminRequest(request, "/admin/media-resources", "GET");
}
