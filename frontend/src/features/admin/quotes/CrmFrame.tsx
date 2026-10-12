import { paginationMeta } from "@/features/admin/platform/query";
import { AdminReadFailure } from "@/features/admin/platform/ReadFailure";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { adminFetch, AdminReadError } from "@/lib/admin/server-data";
import { getAdminSessionContext } from "@/lib/admin/transport/session";
import { adminContractFailure } from "@/lib/admin/transport/result";
export async function crmSession() {
  const result = await getAdminSessionContext();
  if (!result.ok) throw new AdminReadError(result);
  return result.data.user.permissions;
}
export async function crmRead(path: string): Promise<Record<string, unknown>> {
  const result = await adminFetch<unknown>(path);
  if (!result.ok) throw new AdminReadError(result);
  if (
    !result.data ||
    typeof result.data !== "object" ||
    Array.isArray(result.data)
  )
    throw new AdminReadError(adminContractFailure(result.status));
  const data = result.data as Record<string, unknown>;
  const relation = /\/(orders|quotes)\?/.test(path);
  const valid = relation
    ? Array.isArray(data.data) && paginationMeta(data) !== null
    : path.startsWith("/admin/quotes/")
      ? typeof data.id === "string" &&
        typeof data.quoteNumber === "string" &&
        typeof data.status === "string" &&
        Array.isArray(data.items) &&
        Array.isArray(data.timeline) &&
        data.customer !== null &&
        typeof data.customer === "object"
      : typeof data.id === "string" &&
        typeof data.fullName === "string" &&
        Array.isArray(data.consents);
  if (!valid) throw new AdminReadError(adminContractFailure(result.status));
  if (!relation) {
    const detail = /^\/admin\/(quotes|customers)\/([^/?#]+)(?:\?[^#]*)?$/.exec(
      path,
    );
    let requestedId: string | null = null;
    try {
      if (detail) requestedId = decodeURIComponent(detail[2]);
    } catch {
      throw new AdminReadError(adminContractFailure(result.status));
    }
    if (requestedId === null || data.id !== requestedId)
      throw new AdminReadError(adminContractFailure(result.status));
  }
  return data;
}
export function CrmFrame({
  title,
  children,
  backHref,
}: {
  title: string;
  children: ReactNode;
  backHref: string;
}) {
  return (
    <AdminShell>
      <div className="space-y-6">
        <header className="rounded-2xl border border-white/15 p-5">
          <p className="text-sm text-[var(--color-industrial-yellow)]">
            DistriTools JL · Relación comercial
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
          <Link href={backHref} className="mt-3 inline-block underline">
            Volver al listado
          </Link>
        </header>
        {children}
      </div>
    </AdminShell>
  );
}

export function crmError(error: unknown, title: string, backHref: string) {
  if (!(error instanceof AdminReadError)) throw error;
  return (
    <CrmFrame title={title} backHref={backHref}>
      <AdminReadFailure result={error.result} />
    </CrmFrame>
  );
}

export async function crmLoad<T>(
  load: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: AdminReadError }> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    if (!(error instanceof AdminReadError)) throw error;
    return { ok: false, error };
  }
}
