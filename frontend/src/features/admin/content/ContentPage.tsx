import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { AdminReadFailure } from "@/features/admin/platform/ReadFailure";
import { adminFetch } from "@/lib/admin/server-data";
import { getAdminSessionContext } from "@/lib/admin/transport/session";
import { adminContractFailure } from "@/lib/admin/transport/result";
import { footerSnapshotSchema, legalListSchema } from "./contracts";
import { FooterWorkspace } from "./FooterWorkspace";
import { LegalWorkspace } from "./LegalWorkspace";

export async function ContentPage({ domain }: { domain: "legal" | "footer" }) {
  const session = await getAdminSessionContext();
  if (!session.ok)
    return (
      <AdminShell>
        <AdminReadFailure result={session} />
      </AdminShell>
    );
  const result = await adminFetch<unknown>(`/admin/content/${domain}`);
  let content;
  if (!result.ok) content = <AdminReadFailure result={result} />;
  else if (domain === "legal") {
    const parsed = legalListSchema.safeParse(result.data);
    content = parsed.success ? (
      <LegalWorkspace
        initial={parsed.data.data}
        permissions={session.data.user.permissions}
      />
    ) : (
      <AdminReadFailure result={adminContractFailure(result.status)} />
    );
  } else {
    const parsed = footerSnapshotSchema.safeParse(result.data);
    content = parsed.success ? (
      <FooterWorkspace
        initial={parsed.data}
        permissions={session.data.user.permissions}
      />
    ) : (
      <AdminReadFailure result={adminContractFailure(result.status)} />
    );
  }
  return (
    <AdminShell>
      <div className="min-w-0 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--color-industrial-yellow)]">
              DistriTools JL · Contenido
            </p>
            <h1 className="text-2xl font-semibold">
              {domain === "legal" ? "Versiones legales" : "Footer de la tienda"}
            </h1>
          </div>
          {domain === "footer" ? (
            <Link href="/" className="focus-ring underline">
              Ver tienda
            </Link>
          ) : null}
        </header>
        {content}
      </div>
    </AdminShell>
  );
}
