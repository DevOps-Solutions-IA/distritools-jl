import { proxyAdminRequest } from "@/lib/admin/proxy";
import { paymentStatuses } from "@/features/admin/orders/contracts";
import { NextResponse } from "next/server";
import { z } from "zod";

// This endpoint currently reports a blocked provider; it does not refresh a payment.
const blockedMessage =
  "No se consultó proveedor externo porque PSE no está configurado.";
const confirmationSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(paymentStatuses),
  refreshed: z.literal(false),
  operationalState: z
    .object({
      status: z.literal("provider_not_configured"),
      message: z.literal(blockedMessage),
    })
    .strict(),
});
const headers = { "Cache-Control": "private, no-store" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: unknown;
  try {
    const text = await request.clone().text();
    body = text.trim()
      ? request.headers.get("content-type")?.includes("application/json")
        ? JSON.parse(text)
        : undefined
      : {};
  } catch {
    body = undefined;
  }
  if (!z.string().uuid().safeParse(id).success || !z.object({}).strict().safeParse(body).success)
    return NextResponse.json(
      { kind: "validation_error", message: "La solicitud de consulta no es válida." },
      { status: 400, headers },
    );
  const response = await proxyAdminRequest(
    request,
    `/admin/payments/${encodeURIComponent(id)}/refresh-status`,
    "POST",
  );
  if (!response.ok) return response;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  const parsed = confirmationSchema.safeParse(payload);
  if (!parsed.success || parsed.data.id !== id)
    return NextResponse.json(
      { kind: "contract_error", message: "No se pudo verificar la respuesta del proveedor." },
      { status: 502, headers },
    );
  return NextResponse.json(parsed.data, { status: response.status, headers });
}
