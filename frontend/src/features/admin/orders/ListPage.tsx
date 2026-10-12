import { saleRead } from "./reads";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { AdminReadFailure } from "@/features/admin/platform/ReadFailure";
import {
  filterSectionQuery,
  type SectionSearchParams,
} from "@/features/admin/platform/query";
import {
  getAdminOperationalSnapshot,
  AdminReadError,
} from "@/lib/admin/server-data";
import {
  adminContractFailure,
  type AdminApiResult,
} from "@/lib/admin/transport/result";
import { z } from "zod";
import {
  ordersSchema,
  paymentsSchema,
  formatMoney,
  orderStatuses,
  paymentStatuses,
} from "./contracts";
export async function SalesListPage({
  kind,
  query,
}: {
  kind: "orders" | "payments";
  query: SectionSearchParams;
}) {
  const orders = kind === "orders";
  const base = orders ? "/admin/pedidos" : "/admin/pagos";
  const clean: Record<string, string | undefined> = {
    ...filterSectionQuery(orders ? "pedidos" : "pagos", query),
    ...(!orders && typeof query.orderId === "string" && query.orderId
      ? { orderId: query.orderId }
      : {}),
  };
  const params = new URLSearchParams(
    Object.entries(clean).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  let result: AdminApiResult<
    z.infer<typeof ordersSchema> | z.infer<typeof paymentsSchema>
  >;
  try {
    if (!orders && clean.orderId) {
      result = await saleRead(`/admin/payments?${params}`, paymentsSchema);
    } else {
      const snapshot = Object.keys(clean).length
        ? await getAdminOperationalSnapshot(
            orders ? ["orders"] : ["payments"],
            clean,
          )
        : await getAdminOperationalSnapshot(orders ? ["orders"] : ["payments"]);
      const parsed = orders
        ? ordersSchema.safeParse(snapshot.orders)
        : paymentsSchema.safeParse(snapshot.payments);
      result = parsed.success
        ? {
            ok: true,
            kind: "success",
            status: 200,
            data: parsed.data,
            error: null,
          }
        : adminContractFailure(502);
    }
  } catch (error) {
    if (!(error instanceof AdminReadError)) throw error;
    result = error.result;
  }
  const href = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    return `${base}?${next}`;
  };
  return (
    <AdminShell>
      <div className="space-y-5">
        <h2 id="sale-page-title" className="text-2xl font-semibold">
          {orders ? "Pedidos" : "Pagos"}
        </h2>
        {!orders && clean.orderId ? (
          <p className="break-words">
            Pagos del pedido{" "}
            <Link
              className="underline"
              href={`/admin/pedidos/${encodeURIComponent(clean.orderId)}`}
            >
              {clean.orderId}
            </Link>
          </p>
        ) : null}
        <form
          method="get"
          action={base}
          aria-label="Filtros"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-white/20 p-4"
        >
          {!orders && clean.orderId ? (
            <input type="hidden" name="orderId" value={clean.orderId} />
          ) : null}
          {orders ? (
            <label>
              Buscar pedido o cliente
              <input
                name="search"
                defaultValue={clean.search ?? ""}
                className="mt-1 block w-full rounded border border-white/30 bg-black p-2"
              />
            </label>
          ) : null}
          <label>
            Estado
            <select
              name="status"
              defaultValue={clean.status ?? ""}
              className="mt-1 block rounded border border-white/30 bg-black p-2"
            >
              <option value="">Todos</option>
              {(orders ? orderStatuses : paymentStatuses).map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
          {orders ? (
            <label>
              Estado del pago
              <select
                name="paymentStatus"
                defaultValue={clean.paymentStatus ?? ""}
                className="mt-1 block rounded border border-white/30 bg-black p-2"
              >
                <option value="">Todos</option>
                {paymentStatuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Método
              <select
                name="gateway"
                defaultValue={clean.gateway ?? ""}
                className="mt-1 block rounded border border-white/30 bg-black p-2"
              >
                <option value="">Todos</option>
                <option value="cash_on_delivery">Contra entrega</option>
                <option value="pse">PSE</option>
              </select>
            </label>
          )}
          <label>
            Por página
            <select
              name="limit"
              defaultValue={clean.limit ?? "20"}
              className="mt-1 block rounded border border-white/30 bg-black p-2"
            >
              {[10, 20, 50, 100].map((limit) => (
                <option key={limit}>{limit}</option>
              ))}
            </select>
          </label>
          <label>
            Orden
            <select
              name="direction"
              defaultValue={clean.direction ?? "desc"}
              className="mt-1 block rounded border border-white/30 bg-black p-2"
            >
              <option value="desc">Más recientes</option>
              <option value="asc">Más antiguos</option>
            </select>
          </label>
          <button className="rounded bg-[var(--color-industrial-yellow)] px-4 py-2 text-black">
            Aplicar filtros
          </button>
          <Link href={base} className="px-3 py-2 underline">
            Limpiar
          </Link>
        </form>
        {!result.ok ? (
          <AdminReadFailure result={result} />
        ) : (
          <>
            <p role="status">
              {result.data.meta.total} registros · página{" "}
              {result.data.meta.page} · {result.data.meta.limit} por página
            </p>
            {result.data.data.length === 0 ? (
              <p
                data-state="empty_success"
                className="rounded-xl border border-white/20 p-5"
              >
                No hay {orders ? "pedidos" : "pagos"} para estos filtros.
              </p>
            ) : (
              <div
                className="overflow-x-auto rounded-xl border border-white/20"
                tabIndex={0}
                aria-label="Tabla de resultados"
              >
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        "Pedido",
                        "Estado",
                        orders ? "Cliente / ciudad" : "Método",
                        orders ? "Pago" : "Referencia",
                        "Importe",
                        "Detalle",
                      ].map((label) => (
                        <th key={label} className="whitespace-nowrap px-4 py-3">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.data.map((row) => (
                      <tr key={row.id} className="border-t border-white/15">
                        <td className="whitespace-nowrap px-4 py-3">
                          {row.orderNumber}
                        </td>
                        <td className="px-4 py-3">{row.status}</td>
                        <td className="px-4 py-3">
                          {"customerName" in row ? (
                            <>
                              {row.customerName}
                              <br />
                              {row.customerEmail}
                              <br />
                              {row.shippingCity}
                            </>
                          ) : (
                            row.gateway
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {"paymentStatus" in row
                            ? (row.paymentStatus ?? "Sin pago")
                            : (row.providerReference ?? "Sin referencia")}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {"grandTotal" in row
                            ? formatMoney(row.grandTotal)
                            : formatMoney(row.amount, row.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            className="text-[var(--color-industrial-yellow)] underline"
                            href={`${base}/${row.id}`}
                          >
                            Ver {orders ? "pedido" : "pago"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <nav aria-label="Paginación" className="flex flex-wrap gap-4">
              {result.data.meta.page > 1 ? (
                <Link
                  href={href(result.data.meta.page - 1)}
                  className="underline"
                >
                  Anterior
                </Link>
              ) : null}
              {result.data.meta.page * result.data.meta.limit <
              result.data.meta.total ? (
                <Link
                  href={href(result.data.meta.page + 1)}
                  className="underline"
                >
                  Siguiente
                </Link>
              ) : null}
            </nav>
          </>
        )}
      </div>
    </AdminShell>
  );
}
