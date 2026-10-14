import { iamProxy } from "@/features/admin/system/proxy";
import {
  usersSchema,
  userCreateSchema,
  mutationSchema,
} from "@/features/admin/system/contracts";
export function GET(request: Request) {
  return iamProxy(request, "/admin/users", "GET", usersSchema);
}
export function POST(request: Request) {
  return iamProxy(
    request,
    "/admin/users",
    "POST",
    mutationSchema,
    userCreateSchema,
  );
}
