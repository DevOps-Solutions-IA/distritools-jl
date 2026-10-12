import { AdminReadFailure } from "@/features/admin/platform/ReadFailure";
import { saleRead } from "./reads";
import { auditSchema } from "./contracts";
export async function SaleAuditTrail({
  kind,
  id,
  allowed,
}: {
  kind: "order" | "payment";
  id: string;
  allowed: boolean;
}) {
  if (!allowed)
    return (
      <section>
        <h2 className="text-lg font-semibold">Auditoría</h2>
        <p data-state="forbidden">
          Se requiere permiso de lectura de auditoría.
        </p>
      </section>
    );
  const result = await saleRead(
    `/admin/audit?entityType=${kind}&entityId=${encodeURIComponent(id)}&limit=100`,
    auditSchema,
  );
  return (
    <section className="rounded-xl border border-white/20 p-4">
      <h2 className="text-lg font-semibold">
        Auditoría · últimos 100 registros
      </h2>
      {!result.ok ? (
        <AdminReadFailure result={result} />
      ) : result.data.data.length ? (
        <ol className="mt-3 space-y-3">
          {result.data.data.map((event) => (
            <li
              key={event.id}
              className="break-words border-l border-white/30 pl-3"
            >
              <p>{event.action}</p>
              <p className="text-sm">
                {event.createdAt} · actor {event.actorUserId ?? "Sistema"}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p>No hay registros de auditoría para esta entidad.</p>
      )}
    </section>
  );
}
