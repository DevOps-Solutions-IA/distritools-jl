import {
  mutationConfirmationSchema,
  type SaleMutationTarget,
} from "./contracts";
import {
  adminFailure,
  adminContractFailure,
  type AdminApiResult,
} from "@/lib/admin/transport/result";
export type SaleMutationResult =
  | AdminApiResult<{ id: string; status: string; alreadyReconciled?: boolean }>
  | { ok: false; kind: "uncertain"; status: number; data: null; error: string };
export async function mutateSale(
  url: string,
  payload: Record<string, string>,
  target: SaleMutationTarget,
): Promise<SaleMutationResult> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      kind: "uncertain",
      status: 0,
      data: null,
      error:
        "Resultado incierto: se perdió la conexión. Recargue y compruebe el estado y la auditoría antes de volver a operar.",
    };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const failure = adminFailure(response.status, body);
    if (
      response.status === 502 &&
      body &&
      typeof body === "object" &&
      "kind" in body &&
      (body.kind === "network_error" || body.kind === "contract_error")
    )
      return {
        ok: false,
        kind: "uncertain",
        status: response.status,
        data: null,
        error:
          "Resultado incierto: no se confirmó la respuesta del servicio. Recargue y compruebe el estado y la auditoría antes de volver a operar.",
      };
    if (response.status >= 500)
      return {
        ...failure,
        error:
          "El servicio devolvió un error. El resultado de la operación no está confirmado: recargue y compruebe el estado y la auditoría antes de operar otra vez.",
      };
    return failure;
  }
  const parsed = mutationConfirmationSchema.safeParse(body);
  if (
    !parsed.success ||
    parsed.data.id !== target?.id ||
    !(target.kind === "cancel"
      ? parsed.data.status === "cancelled"
      : target.kind === "cod" && parsed.data.status === "approved")
  )
    return {
      ...adminContractFailure(response.status),
      kind: "uncertain",
      error:
        "Resultado incierto: respuesta inválida. Recargue y compruebe el estado y la auditoría.",
    };
  return {
    ok: true,
    kind: "success",
    status: response.status,
    data: parsed.data,
    error: null,
  };
}
