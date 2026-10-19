export const shipmentStatuses = [
  "pending_provider",
  "pending_address",
  "pending_quote",
  "quoted",
  "pending_dispatch",
  "shipment_created",
  "guide_generated",
  "pickup_scheduled",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "delivery_failed",
  "returned",
  "cancelled",
] as const;
export const shipmentLabels: Record<string, string> = {
  pending_provider: "Proveedor pendiente",
  pending_address: "Dirección pendiente",
  pending_quote: "Cotización pendiente",
  quoted: "Cotizado",
  pending_dispatch: "Despacho pendiente",
  shipment_created: "Envío preparado",
  guide_generated: "Guía registrada",
  pickup_scheduled: "Recolección programada",
  in_transit: "En tránsito",
  out_for_delivery: "En reparto",
  delivered: "Entregado",
  delivery_failed: "Entrega fallida",
  returned: "Devuelto",
  cancelled: "Cancelado",
};
export const notificationLabels: Record<string, string> = {
  queued: "En cola",
  sending: "En proceso",
  sent: "Entregado al proveedor",
  failed: "Fallido",
  uncertain: "Resultado incierto",
};
export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
export function uuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
export interface ShipmentEvent {
  id: string;
  status: string;
  occurredAt: string;
}
export interface Shipment {
  id: string;
  orderId: string;
  orderNumber: string;
  provider: string;
  status: string;
  trackingNumber: string | null;
  routeNumber: string | null;
  quotedAmount: string | null;
  events: ShipmentEvent[];
  createdAt: string;
  guideSource: string | null;
  guideNotice: string | null;
  lastSyncAt: string | null;
}
export function events(value: unknown): ShipmentEvent[] {
  if (!Array.isArray(value)) throw new Error("Invalid event collection");
  return value.map((item) => {
    const r = record(item);
    if (
      !uuid(r.id) ||
      typeof r.status !== "string" ||
      typeof r.occurredAt !== "string"
    )
      throw new Error("Invalid shipment event");
    return { id: r.id, status: r.status, occurredAt: r.occurredAt };
  });
}
export function shipment(value: unknown): Shipment {
  const r = record(value);
  if (
    !uuid(r.id) ||
    !uuid(r.orderId) ||
    typeof r.orderNumber !== "string" ||
    typeof r.provider !== "string" ||
    typeof r.status !== "string" ||
    !shipmentStatuses.includes(r.status as (typeof shipmentStatuses)[number]) ||
    typeof r.createdAt !== "string"
  )
    throw new Error("Invalid shipment");
  return {
    id: r.id,
    orderId: r.orderId,
    orderNumber: r.orderNumber,
    provider: r.provider,
    status: r.status,
    trackingNumber: text(r.trackingNumber),
    routeNumber: text(r.routeNumber),
    quotedAmount: text(r.quotedAmount),
    events: events(r.events ?? []),
    createdAt: r.createdAt,
    guideSource: text(r.guideSource),
    guideNotice: text(r.guideNotice),
    lastSyncAt: text(r.lastSyncAt),
  };
}
export function guideLabel(row: Shipment) {
  if (
    row.provider === "mock_99envios" ||
    row.trackingNumber?.startsWith("MOCK99-") ||
    row.guideSource === "mock_99envios"
  )
    return "Mock local/test";
  if (
    row.provider === "none" ||
    row.provider === "internal" ||
    !row.trackingNumber
  )
    return "Tracking interno";
  return "Guía externa registrada";
}
export interface NotificationRow {
  id: string;
  eventName: string;
  channel: string;
  recipient: string;
  provider: string;
  status: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  failedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}
function maskedRecipient(value: unknown) {
  if (typeof value !== "string") return "[redacted]";
  if (
    /^[^@\s*]{0,2}\*{3}@[^@\s*]+$/.test(value) ||
    /^\d{3}\*{3}\d{2}$/.test(value) ||
    value === "[redacted]"
  )
    return value;
  return "[redacted]";
}
export function notification(value: unknown): NotificationRow {
  const r = record(value);
  if (
    !uuid(r.id) ||
    typeof r.eventName !== "string" ||
    typeof r.channel !== "string" ||
    typeof r.provider !== "string" ||
    typeof r.status !== "string" ||
    !Object.hasOwn(notificationLabels, r.status) ||
    !Number.isInteger(r.attempts) ||
    Number(r.attempts) < 0 ||
    typeof r.createdAt !== "string"
  )
    throw new Error("Invalid notification");
  return {
    id: r.id,
    eventName: r.eventName,
    channel: r.channel,
    recipient: maskedRecipient(r.recipient),
    provider: r.provider,
    status: r.status,
    attempts: Number(r.attempts),
    lastError:
      typeof r.lastError === "string" &&
      /^[A-Z][A-Z0-9_-]{0,79}$/.test(r.lastError)
        ? r.lastError
        : r.lastError
          ? "[DETAILS_REDACTED]"
          : null,
    sentAt: text(r.sentAt),
    failedAt: text(r.failedAt),
    createdAt: r.createdAt,
    updatedAt: text(r.updatedAt),
  };
}
export function date(value: string | null) {
  return value && !Number.isNaN(Date.parse(value))
    ? new Date(value).toLocaleString("es-CO")
    : "Sin registro";
}
