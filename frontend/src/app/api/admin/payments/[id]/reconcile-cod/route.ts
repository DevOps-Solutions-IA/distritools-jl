import {
  codPayloadSchema,
  saleProxyWrite,
} from "@/features/admin/orders/proxy-write";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return saleProxyWrite(
    request,
    `/admin/payments/${encodeURIComponent(id)}/reconcile-cod`,
    codPayloadSchema,
    { kind: "cod", id },
  );
}
