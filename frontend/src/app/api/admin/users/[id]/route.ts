import { iamProxy } from "@/features/admin/system/proxy";
import {
  mutationSchema,
  userUpdateSchema,
} from "@/features/admin/system/contracts";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return iamProxy(
    request,
    `/admin/users/${encodeURIComponent(id)}`,
    "PATCH",
    mutationSchema,
    userUpdateSchema,
  );
}
