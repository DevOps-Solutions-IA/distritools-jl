import { iamProxy } from "@/features/admin/system/proxy";
import {
  providerValidationSchema,
  emptyInputSchema,
} from "@/features/admin/system/contracts";
export async function POST(request: Request) {
  return iamProxy(
    request,
    `/admin/settings/providers/validate`,
    "POST",
    providerValidationSchema,
    emptyInputSchema,
  );
}
