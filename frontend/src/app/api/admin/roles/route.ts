import { iamProxy } from "@/features/admin/system/proxy";
import {
  rolesSchema,
  roleCreateSchema,
  mutationSchema,
} from "@/features/admin/system/contracts";
export function GET(request: Request) {
  return iamProxy(request, "/admin/roles", "GET", rolesSchema);
}
export function POST(request: Request) {
  return iamProxy(
    request,
    "/admin/roles",
    "POST",
    mutationSchema,
    roleCreateSchema,
  );
}
