import { OrderPayments } from "./OrderPayments";
import { MutationForm } from "./MutationForm";
import Link from "next/link";
import { z } from "zod";
import { AdminShell } from "@/components/layout/AdminShell";
import { AdminReadFailure } from "@/features/admin/platform/ReadFailure";
import { getAdminSessionContext } from "@/lib/admin/transport/session";
import { saleRead } from "./reads";
import { orderSchema, formatMoney } from "./contracts";
import { SaleAuditTrail } from "./AuditTrail";
export async function OrderPage({ id }: { id: string }) {
  const [session, result] = await Promise.all([
    getAdminSessionContext(),
    saleRead(`/admin/orders/${encodeURIComponent(id)}`, orderSchema),
  ]);
  const permissions = session.ok ? session.data.user.permissions : [];
  const shipment =
    result.ok && permissions.includes("shipping.read")
      ? await saleRead(
          `/admin/orders/${encodeURIComponent(id)}/shipment`,
          z.object({
            id: z.string().uuid(),
            status: z.string(),
            provider: z.string(),
            trackingNumber: z.string().nullable(),
            routeNumber: z.string().nullable(),
          }),
        )
      : null;
  return (
    <AdminShell>
      <div className="space-y-5">
        <Link href="/admin/pedidos" className="underline">
          Volver a pedidos
        </Link>
        <h2 id="sale-page-title" className="text-2xl font-semibold">
          {result.ok ? result.data.orderNumber : "Detalle de pedido"}
        </h2>
        {!result.ok ? (
          <AdminReadFailure result={result} />
        ) : (
          <>
            <p>
              Estado: <strong>{result.data.status}</strong> · actualizado{" "}
              {result.data.updatedAt}
            </p>
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-xl border border-white/20 p-4">
                <h2 className="text-lg font-semibold">Cliente y entrega</h2>
                <p>{result.data.customer.name}</p>
                <p>{result.data.customer.email}</p>
                <p>{result.data.customer.phone}</p>
                <p>
                  {result.data.shipping.address} · {result.data.shipping.city}
                </p>
                <p className="whitespace-pre-wrap break-words">
                  {result.data.shipping.notes}
                </p>
              </section>
              <section className="rounded-xl border border-white/20 p-4">
                <h2 className="text-lg font-semibold">Importes</h2>
                <dl>
                  {Object.entries(result.data.totals).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-3">
                      <dt>
                        {
                          {
                            subtotal: "Subtotal",
                            discountTotal: "Descuento",
                            taxTotal: "Impuestos",
                            shippingTotal: "Envío",
                            grandTotal: "Total",
                          }[key]
                        }
                      </dt>
                      <dd>{formatMoney(value)}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
            <section className="rounded-xl border border-white/20 p-4">
              <h2 className="text-lg font-semibold">
                Artículos · {result.data.items.length}
              </h2>
              <ul className="mt-3 space-y-3">
                {result.data.items.map((item) => (
                  <li
                    key={item.id}
                    className="break-words border-b border-white/15 pb-3"
                  >
                    <strong>{item.variantNameSnapshot}</strong>
                    <p>
                      SKU {item.skuSnapshot} · cantidad {item.quantity}
                    </p>
                    <p>
                      Unidad {formatMoney(item.unitPrice)} · total{" "}
                      {formatMoney(item.lineGrandTotal)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-xl border border-white/20 p-4">
              <h2 className="text-lg font-semibold">Pago y envío</h2>
              <OrderPayments
                id={result.data.id}
                allowed={permissions.includes("payments.read")}
              />
              {shipment ? (
                !shipment.ok ? (
                  shipment.kind === "not_found" ? (
                    <p>Sin envío registrado.</p>
                  ) : (
                    <AdminReadFailure result={shipment} />
                  )
                ) : (
                  <p>
                    Envío {shipment.data.status} · {shipment.data.provider} ·
                    guía {shipment.data.trackingNumber ?? "Sin guía externa"} ·
                    ruta {shipment.data.routeNumber ?? "Sin ruta"}
                  </p>
                )
              ) : (
                <p data-state="forbidden">
                  Se requiere permiso de lectura de envíos.
                </p>
              )}
            </section>
            {result.data.status === "pending_payment" ? (
              permissions.includes("orders.cancel") &&
              permissions.includes("inventory.release") ? (
                <MutationForm
                  kind="cancel"
                  id={result.data.orderNumber}
                  expectedId={result.data.id}
                />
              ) : (
                <p data-state="forbidden">
                  La cancelación requiere permisos para cancelar pedidos y
                  liberar reservas.
                </p>
              )
            ) : (
              <p>
                La política vigente permite cancelar únicamente pedidos
                pendientes de pago.
              </p>
            )}
            <SaleAuditTrail
              kind="order"
              id={result.data.id}
              allowed={permissions.includes("audit.read")}
            />
          </>
        )}
        {!session.ok ? <AdminReadFailure result={session} /> : null}
      </div>
    </AdminShell>
  );
}
