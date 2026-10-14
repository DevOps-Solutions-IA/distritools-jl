import { adminFetch, AdminReadError } from "@/lib/admin/server-data";
import { adminContractFailure } from "@/lib/admin/transport/result";
import { getAdminSessionContext } from "@/lib/admin/transport/session";
import type { z } from "zod";
export async function iamRead<S extends z.ZodTypeAny>(
  path: string,
  schema: S,
): Promise<z.output<S>> {
  const response = await adminFetch<unknown>(path);
  if (!response.ok) throw new AdminReadError(response);
  const result = schema.safeParse(response.data);
  if (!result.success)
    throw new AdminReadError(adminContractFailure(response.status));
  return result.data;
}
export async function iamSession(required: string) {
  const result = await getAdminSessionContext();
  if (!result.ok) throw new AdminReadError(result);
  if (!result.data.user.permissions.includes(required))
    throw new AdminReadError({
      ok: false,
      kind: "forbidden",
      status: 403,
      data: null,
      error: "No tiene permiso para leer este módulo.",
    });
  return result.data.user;
}

export async function iamLoad<T>(load: () => Promise<T>) {
  try {
    return { ok: true as const, data: await load() };
  } catch (error) {
    if (!(error instanceof AdminReadError)) throw error;
    return { ok: false as const, result: error.result };
  }
}
