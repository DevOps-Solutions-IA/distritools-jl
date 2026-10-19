import Link from "next/link";
import type { SectionSearchParams } from "@/features/admin/platform/query";
import { paginationMeta } from "@/features/admin/platform/query";
import {
  shipmentLabels,
  shipmentStatuses,
  guideLabel,
  date,
  type Shipment,
} from "./contract";
import { fieldClass, linkClass } from "./ui";
export function ShipmentList({
  rows,
  meta,
  query = {},
  tracking = false,
}: {
  rows: Shipment[];
  meta: ReturnType<typeof paginationMeta>;
  query?: SectionSearchParams;
  tracking?: boolean;
}) {
  const current = (key: string) =>
    typeof query[key] === "string" ? (query[key] as string) : "";
  const pathname = tracking ? "/admin/rastreo" : "/admin/envios";
  const pageLink = (page: number) => {
    const p = new URLSearchParams();
    for (const k of ["search", "status", "limit", "direction"])
      if (current(k)) p.set(k, current(k));
    p.set("page", String(page));
    return pathname + "?" + p;
  };
  return (
    <section className="min-w-0 space-y-4">
      <form
        aria-label="Filtrar envíos"
        method="get"
        action={pathname}
        className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <label className="min-w-0 text-sm">
          Pedido o guía
          <input
            name="search"
            defaultValue={current("search")}
            maxLength={200}
            className={fieldClass}
          />
        </label>
        <label className="text-sm">
          Estado del envío
          <select
            name="status"
            defaultValue={current("status")}
            className={fieldClass}
          >
            <option value="">Todos los estados</option>
            {shipmentStatuses.map((s) => (
              <option key={s} value={s}>
                {shipmentLabels[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Envíos por página
          <select
            name="limit"
            defaultValue={current("limit") || "20"}
            className={fieldClass}
          >
            {[10, 20, 50, 100].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Orden de creación
          <select
            name="direction"
            defaultValue={current("direction") || "desc"}
            className={fieldClass}
          >
            <option value="desc">Más recientes primero</option>
            <option value="asc">Más antiguos primero</option>
          </select>
        </label>
        <button type="submit" className={linkClass}>
          Filtrar envíos
        </button>
        <Link href={pathname} className={linkClass}>
          Limpiar filtros
        </Link>
      </form>
      <div
        className="max-w-full overflow-x-auto rounded-xl border border-white/10"
        role="region"
        aria-label="Listado de envíos"
        tabIndex={0}
      >
        <table className="w-full text-left text-sm">
          <caption className="p-3 text-left">
            {meta
              ? `${meta.total} envíos · página ${meta.page}`
              : "Envíos persistidos"}
          </caption>
          <thead>
            <tr>
              {[
                "Pedido",
                "Estado",
                "Origen de guía",
                "Número de guía",
                "Registrado",
                "Detalle",
              ].map((s) => (
                <th key={s} className="whitespace-nowrap p-3">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/10">
                <td className="whitespace-nowrap p-3">{row.orderNumber}</td>
                <td className="p-3">
                  {shipmentLabels[row.status] ?? row.status}
                </td>
                <td className="p-3">
                  {guideLabel(row)}
                  {guideLabel(row) === "Mock local/test" ? (
                    <p className="mt-1 min-w-40 text-xs text-amber-200">
                      No existe en panel real 99 Envíos.
                    </p>
                  ) : null}
                </td>
                <td className="break-all p-3">
                  {row.trackingNumber ?? "Sin guía externa"}
                </td>
                <td className="whitespace-nowrap p-3">{date(row.createdAt)}</td>
                <td className="p-3">
                  <Link
                    className={linkClass}
                    href={"/admin/envios/" + row.id}
                    aria-label={"Ver envío " + row.orderNumber}
                  >
                    Ver envío
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? (
          <p className="p-4" data-state="EMPTY_SUCCESS">
            No hay envíos para estos filtros.
          </p>
        ) : null}
      </div>
      {meta ? (
        <nav
          aria-label="Paginación de envíos"
          className="flex flex-wrap items-center gap-3"
        >
          {meta.page > 1 ? (
            <Link className={linkClass} href={pageLink(meta.page - 1)}>
              Página anterior
            </Link>
          ) : null}
          <span>
            Página {meta.page} · {meta.limit} por página
          </span>
          {meta.page * meta.limit < meta.total ? (
            <Link className={linkClass} href={pageLink(meta.page + 1)}>
              Página siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
