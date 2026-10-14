import { iamProxy } from "@/features/admin/system/proxy";
import {
  mutationSchema,
  assignPermissionsSchema,
} from "@/features/admin/system/contracts";
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return iamProxy(
    request,
    `/admin/roles/${encodeURIComponent(id)}/permissions`,
    "PUT",
    mutationSchema,
    assignPermissionsSchema,
  );
}
