import {
  cancelPayloadSchema,
  saleProxyWrite,
} from "@/features/admin/orders/proxy-write";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params;
  return saleProxyWrite(
    request,
    `/admin/orders/${encodeURIComponent(orderNumber)}/cancel`,
    cancelPayloadSchema,
    { kind: "cancel", orderNumber },
  );
}
