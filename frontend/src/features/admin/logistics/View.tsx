import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/AdminShell";
import { AdminReadError } from "@/lib/admin/server-data";
import { AdminReadFailure } from "@/features/admin/platform/ReadFailure";
export async function logisticsView(
  title: string,
  description: string,
  load: () => Promise<ReactNode>,
) {
  let body;
  try {
    body = await load();
  } catch (e) {
    if (!(e instanceof AdminReadError)) throw e;
    body = <AdminReadFailure result={e.result} />;
  }
  return (
    <AdminShell>
      <div className="min-w-0 space-y-5">
        <header className="space-y-2">
          <p className="text-xs font-semibold tracking-widest text-[var(--color-industrial-yellow)]">
            OPERACIONES · DISTRITOOLS JL
          </p>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="max-w-3xl text-sm text-[var(--color-text-secondary)]">
            {description}
          </p>
        </header>
        {body}
      </div>
    </AdminShell>
  );
}
