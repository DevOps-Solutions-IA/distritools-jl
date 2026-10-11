import { proxyAdminRequest } from "@/lib/admin/proxy";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return proxyAdminRequest(
    request,
    `/admin/products/${encodeURIComponent(id)}/image-approval`,
    "POST",
  );
}
