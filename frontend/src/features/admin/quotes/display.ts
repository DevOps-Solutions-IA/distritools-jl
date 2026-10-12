export function money(value: unknown): string {
  if (value === "NO_PERMISSION") return "Sin permiso financiero";
  if (value === null || value === undefined) return "Sin precio";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? `$ ${amount.toLocaleString("es-CO")}`
    : "Importe no disponible";
}
export function quoteStatus(status: string, order?: unknown) {
  return status === "converted_to_order" && !order
    ? "Pendiente de crear pedido"
    : status;
}
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}
export function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "No disponible";
}
