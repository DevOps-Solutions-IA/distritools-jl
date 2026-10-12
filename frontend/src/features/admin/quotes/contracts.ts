import {
  adminContractFailure,
  adminFailure,
  type AdminApiResult,
} from "@/lib/admin/transport/result";
type ConfirmationContext = { status?: string };
const quoteStatuses = [
  "requested",
  "in_review",
  "quoted",
  "sent",
  "accepted",
  "rejected",
  "expired",
  "converted_to_order",
  "cancelled",
];
function objectRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function matchesResource(id: unknown, encodedId: string) {
  try {
    return typeof id === "string" && id === decodeURIComponent(encodedId);
  } catch {
    return false;
  }
}
function matchesCreatedItems(returned: unknown[], requested: unknown[]) {
  if (returned.length !== requested.length) return false;
  const remaining = returned.map(objectRecord);
  return requested.every((item) => {
    const request = objectRecord(item);
    if (!request || typeof request.productId !== "string") return false;
    const index = remaining.findIndex(
      (candidate) =>
        candidate !== null &&
        candidate.productId === request.productId &&
        candidate.quantity === Number(request.quantity),
    );
    if (index < 0) return false;
    remaining.splice(index, 1);
    return true;
  });
}
function validConfirmation(
  path: string,
  method: "POST" | "PATCH",
  record: Record<string, unknown>,
  body?: object,
  context?: ConfirmationContext,
) {
  const operation = objectRecord(record.operationalState);
  if (path === "/customers/export")
    return (
      method === "POST" &&
      record.exported === false &&
      operation?.status === "blocked"
    );
  const customerPath = /^\/customers\/([^/?#]+)(\/view-sensitive)?$/.exec(path);
  if (customerPath)
    return (
      method === (customerPath[2] ? "POST" : "PATCH") &&
      matchesResource(record.id, customerPath[1]) &&
      typeof record.fullName === "string"
    );
  if (
    typeof record.id !== "string" ||
    typeof record.quoteNumber !== "string" ||
    typeof record.status !== "string" ||
    !quoteStatuses.includes(record.status) ||
    !Array.isArray(record.items)
  )
    return false;
  const request = objectRecord(body);
  if (path === "/quotes") {
    const customer = objectRecord(record.customer);
    const items = Array.isArray(request?.items) ? request.items : [];
    const expectedStatus = items.some(
      (item) => objectRecord(item)?.unitPrice !== undefined,
    )
      ? "quoted"
      : "requested";
    return (
      method === "POST" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        record.id,
      ) &&
      matchesCreatedItems(record.items, items) &&
      record.status === expectedStatus &&
      (typeof request?.customerId !== "string" ||
        customer?.id === request.customerId) &&
      record.operationalState === undefined
    );
  }
  const quotePath = /^\/quotes\/([^/?#]+)(\/[^/?#]+)?$/.exec(path);
  if (!quotePath || !matchesResource(record.id, quotePath[1])) return false;
  const action = quotePath[2] ?? "";
  if (method !== (action ? "POST" : "PATCH")) return false;
  if (action === "/send")
    return (
      record.status === "quoted" &&
      operation?.status === "pending_manual_send" &&
      typeof operation.message === "string"
    );
  if (action === "/convert-to-order") {
    const order = objectRecord(record.order);
    if (record.alreadyConverted === true)
      return (
        order !== null &&
        typeof order.id === "string" &&
        typeof order.orderNumber === "string" &&
        typeof order.status === "string" &&
        record.operationalState === undefined
      );
    return (
      record.status === "converted_to_order" &&
      record.order == null &&
      operation?.status === "manual_order_creation_required" &&
      typeof operation.message === "string"
    );
  }
  if (record.operationalState !== undefined) return false;
  if (action === "") {
    const expectedStatus =
      typeof request?.status === "string" ? request.status : context?.status;
    return expectedStatus === undefined || record.status === expectedStatus;
  }
  const expectedStatuses: Record<string, string> = {
    "/price-items": "quoted",
    "/submit-review": "in_review",
    "/accept": "accepted",
    "/reject": "rejected",
    "/cancel": "cancelled",
  };
  return (
    expectedStatuses[action] !== undefined &&
    record.status === expectedStatuses[action]
  );
}
export async function crmRequest(
  path: string,
  method: "POST" | "PATCH",
  body?: object,
  context?: ConfirmationContext,
): Promise<AdminApiResult<Record<string, unknown>>> {
  try {
    const response = await fetch(`/api/admin${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      ...(body
        ? {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return {
        ...adminContractFailure(response.status),
        error:
          "Respuesta inválida. El resultado es incierto; consulte el estado antes de repetir.",
      };
    }
    if (!response.ok) {
      const failure = adminFailure(response.status, data);
      return {
        ...failure,
        error:
          response.status === 403
            ? "No tiene permiso para esta operación."
            : response.status >= 500 && failure.kind !== "provider_blocked"
              ? "No se confirmó la operación. Consulte el estado antes de repetir."
              : failure.error,
      };
    }
    if (!data || typeof data !== "object" || Array.isArray(data))
      return {
        ...adminContractFailure(response.status),
        error:
          "Respuesta inválida. El resultado es incierto; consulte el estado antes de repetir.",
      };
    const record = data as Record<string, unknown>;
    const valid = validConfirmation(path, method, record, body, context);
    if (!valid)
      return {
        ...adminContractFailure(response.status),
        error:
          "Respuesta inválida. El resultado es incierto; consulte el estado antes de repetir.",
      };
    return {
      ok: true,
      kind: "success",
      status: response.status,
      data: data as Record<string, unknown>,
      error: null,
    };
  } catch {
    return {
      ...adminFailure(0),
      error:
        "Resultado incierto: no se confirmó la operación. Consulte el estado antes de repetir.",
    };
  }
}
export function priceItemsPayload(
  owned: readonly { id: string; quantity: number }[],
  edits: readonly { id: string; quantity: string; unitPrice: string }[],
) {
  if (!edits.length) throw new Error("No hay líneas para asignar precio.");
  const ids = new Set(owned.map((item) => item.id));
  return {
    items: edits.map((edit) => {
      const quantity = Number(edit.quantity);
      const price = Number(edit.unitPrice);
      if (
        !ids.has(edit.id) ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        !edit.unitPrice.trim() ||
        !Number.isFinite(price) ||
        price < 0
      )
        throw new Error(
          "Revise las líneas propias, cantidades enteras y precios no negativos.",
        );
      return { id: edit.id, quantity, unitPrice: edit.unitPrice.trim() };
    }),
  };
}
export function customerChanges(values: Record<string, string>) {
  const changes: Record<string, string> = {};
  for (const key of [
    "fullName",
    "email",
    "phone",
    "defaultAddress",
    "city",
    "department",
    "country",
  ]) {
    const value = values[key]?.trim();
    if (!value) continue;
    if (value.includes("*") || value === "[PROTECTED]")
      throw new Error(
        "Introduzca el dato real nuevo; no guarde valores enmascarados.",
      );
    changes[key] = value;
  }
  if (changes.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.email))
    throw new Error("Revise el correo nuevo.");
  return changes;
}
