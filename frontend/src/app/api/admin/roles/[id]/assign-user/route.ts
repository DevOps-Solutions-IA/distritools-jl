import { iamProxy } from "@/features/admin/system/proxy";
import {
  mutationSchema,
  assignUserSchema,
} from "@/features/admin/system/contracts";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return iamProxy(
    request,
    `/admin/roles/${encodeURIComponent(id)}/assign-user`,
    "POST",
    mutationSchema,
    assignUserSchema,
  );
}
