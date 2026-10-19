import { date, shipmentLabels, type ShipmentEvent } from "./contract";
export function Timeline({ items }: { items: ShipmentEvent[] }) {
  return (
    <section
      aria-label="Eventos del envío"
      className="rounded-xl border border-white/10 p-4"
    >
      <h2 className="text-lg font-semibold">Eventos del envío</h2>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
        Últimos 100 eventos persistidos. Se omiten descripciones y datos crudos
        del proveedor.
      </p>
      {items.length ? (
        <ol className="mt-4 space-y-3">
          {items.map((e) => (
            <li
              key={e.id}
              className="border-l-2 border-[var(--color-industrial-yellow)] pl-3"
            >
              <p>{shipmentLabels[e.status] ?? e.status}</p>
              <time
                dateTime={e.occurredAt}
                className="text-xs text-[var(--color-text-secondary)]"
              >
                {date(e.occurredAt)}
              </time>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4" data-state="EMPTY_SUCCESS">
          Todavía no hay eventos persistidos.
        </p>
      )}
    </section>
  );
}
