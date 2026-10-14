import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/config/env";
import type { z } from "zod";
import { adminFailure } from "@/lib/admin/transport/result";
import {
  mutationSchema,
  parseIamMutationConfirmation,
  settingsMutationSchema,
  parseIamSettingsConfirmation,
} from "./contracts";
export async function iamProxy<T>(
  request: Request,
  path: string,
  method: "GET" | "POST" | "PATCH" | "PUT",
  output: z.ZodType<T>,
  input?: z.ZodType,
  transform?: (value: T) => unknown,
) {
  const fail = (status: number, message?: string) =>
    NextResponse.json(
      { error: message ?? adminFailure(status).error },
      {
        status: status || 502,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  const token = (await cookies()).get("dt_admin_access")?.value;
  if (!token) return fail(401);
  let payload: unknown;
  if (method !== "GET") {
    const origin = request.headers.get("origin");
    if (
      request.headers.get("sec-fetch-site") === "cross-site" ||
      (origin && origin !== new URL(env.siteUrl).origin)
    )
      return fail(403);
    if (!request.headers.get("content-type")?.includes("application/json"))
      return fail(400, "Se requiere un cuerpo JSON.");
    try {
      payload = await request.json();
    } catch {
      return fail(400, "JSON inválido.");
    }
    const parsed = input?.safeParse(payload);
    if (!parsed?.success)
      return fail(400, "Revise los campos requeridos y sus formatos.");
    payload = parsed.data;
  }
  const target = new URL(`${env.apiBaseUrl}/api/v1${path}`);
  if (method === "GET") {
    for (const key of ["action", "entityType", "entityId", "limit"]) {
      const value = new URL(request.url).searchParams.get(key);
      if (value) target.searchParams.set(key, value);
    }
  }
  let response: Response;
  try {
    response = await fetch(target, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
  } catch {
    return fail(0);
  }
  if (!response.ok) return fail(response.status);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return fail(502, "El servicio devolvió una respuesta inválida.");
  }
  const parsed = output.safeParse(data);
  if (!parsed.success)
    return fail(502, "El servicio devolvió una respuesta inválida.");
  const confirmationOutput: z.ZodTypeAny = output;
  if (confirmationOutput === mutationSchema) {
    const confirmation = parseIamMutationConfirmation(
      path,
      method,
      payload,
      data,
    );
    if (!confirmation.success)
      return fail(502, "El servicio devolvió una respuesta inválida.");
    return NextResponse.json(confirmation.data, {
      status: response.status,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
  if (
    confirmationOutput === settingsMutationSchema &&
    !parseIamSettingsConfirmation(payload, data).success
  )
    return fail(502, "El servicio devolvió una respuesta inválida.");
  return NextResponse.json(transform ? transform(parsed.data) : parsed.data, {
    status: response.status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
