import { NextResponse } from "next/server";
import { proxyAdminRequest } from "@/lib/admin/proxy";
import { record, shipment, events, notification, uuid } from "./contract";
export function logisticsInvalid(status = 400) {
  return NextResponse.json(
    {
      kind: status === 400 ? "validation_error" : "contract_error",
      message:
        status === 400
          ? "Parámetros de logística inválidos."
          : "El servicio devolvió una respuesta inválida.",
    },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function logisticsProxy(
  request: Request,
  path: string,
  parse: (value: unknown) => unknown,
) {
  const response = await proxyAdminRequest(request, path, "GET");
  if (!response.ok) return response;
  try {
    const parsed = parse(await response.json());
    return NextResponse.json(parsed, {
      status: response.status,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return logisticsInvalid(502);
  }
}
export function listNotifications(value: unknown) {
  const r = record(value);
  if (!Array.isArray(r.data))
    throw new Error("Invalid notification collection");
  return { data: r.data.map(notification) };
}
export function listEvents(value: unknown) {
  const r = record(value);
  return { data: events(r.data) };
}
export function listShipments(value: unknown) {
  const r = record(value);
  const m = record(r.meta);
  if (
    !Array.isArray(r.data) ||
    !Number.isSafeInteger(m.page) ||
    Number(m.page) < 1 ||
    !Number.isSafeInteger(m.limit) ||
    Number(m.limit) < 1 ||
    Number(m.limit) > 100 ||
    !Number.isSafeInteger(m.total) ||
    Number(m.total) < 0
  )
    throw new Error("Invalid shipment collection");
  return {
    data: r.data.map(shipment),
    meta: { page: m.page, limit: m.limit, total: m.total },
  };
}
export function loginDiagnostic(value: unknown) {
  const r = record(value);
  if (typeof r.ok !== "boolean" || typeof r.status !== "string")
    throw new Error("Invalid login diagnostic");
  return { ok: r.ok, status: r.status, tokenPresent: r.tokenPresent === true };
}
export async function shipmentRoute(
  request: Request,
  params: Promise<{ id: string }>,
  eventList = false,
) {
  const { id } = await params;
  if (!uuid(id)) return logisticsInvalid();
  return logisticsProxy(
    request,
    "/admin/shipments/" + id + (eventList ? "/events" : ""),
    eventList ? listEvents : shipment,
  );
}
