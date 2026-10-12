import {
  cancelConfirmationSchema,
  mutationConfirmationSchema,
  type SaleProxyTarget,
} from "./contracts";
import { NextResponse } from "next/server";
import { z } from "zod";
import { proxyAdminRequest } from "@/lib/admin/proxy";
const text = (limit: number) => z.string().trim().min(1).max(limit);
export const cancelPayloadSchema = z.object({ reason: text(500) }).strict();
export const codPayloadSchema = z
  .object({ reference: text(200), note: text(500) })
  .strict();
export async function saleProxyWrite(
  request: Request,
  backendPath: string,
  schema: z.ZodType<Record<string, string>>,
  target: SaleProxyTarget,
) {
  let body: unknown;
  try {
    body = request.headers.get("content-type")?.includes("application/json")
      ? await request.json()
      : undefined;
  } catch {
    body = undefined;
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        kind: "validation_error",
        message: "Complete los campos requeridos con texto válido.",
      },
      { status: 400, headers: { "Cache-Control": "private, no-store" } },
    );
  const response = await proxyAdminRequest(
    new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(parsed.data),
    }),
    backendPath,
    "POST",
  );
  if (!response.ok) return response;
  let confirmation: unknown;
  try {
    confirmation = await response.json();
  } catch {
    confirmation = undefined;
  }
  const safe =
    target?.kind === "cancel"
      ? cancelConfirmationSchema.safeParse(confirmation)
      : mutationConfirmationSchema.safeParse(confirmation);
  const matches =
    safe.success &&
    (target?.kind === "cancel"
      ? safe.data.status === "cancelled" &&
        "orderNumber" in safe.data &&
        safe.data.orderNumber === target.orderNumber
      : target?.kind === "cod" &&
        safe.data.status === "approved" &&
        safe.data.id === target.id);
  if (!safe.success || !matches)
    return NextResponse.json(
      {
        kind: "contract_error",
        message: "No se pudo confirmar el resultado de la operación.",
      },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  return NextResponse.json(
    {
      id: safe.data.id,
      status: safe.data.status,
      ...(target.kind === "cod" && safe.data.alreadyReconciled !== undefined
        ? { alreadyReconciled: safe.data.alreadyReconciled }
        : {}),
    },
    {
      status: response.status,
      headers: { "Cache-Control": "private, no-store" },
    },
  );
}
