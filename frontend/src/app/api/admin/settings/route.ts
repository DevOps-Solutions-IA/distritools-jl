import { iamProxy } from "@/features/admin/system/proxy";
import {
  settingsSchema,
  settingsUpdateSchema,
  settingsMutationSchema,
} from "@/features/admin/system/contracts";
export function GET(request: Request) {
  return iamProxy(request, "/admin/settings", "GET", settingsSchema);
}
export function PATCH(request: Request) {
  return iamProxy(
    request,
    "/admin/settings",
    "PATCH",
    settingsMutationSchema,
    settingsUpdateSchema,
  );
}
