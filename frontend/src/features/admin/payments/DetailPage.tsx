import { ProviderReview } from "./ProviderReview";
import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { AdminReadFailure } from "@/features/admin/platform/ReadFailure";
import { getAdminSessionContext } from "@/lib/admin/transport/session";
import { saleRead } from "../orders/reads";
import { paymentSchema, eventsSchema, formatMoney } from "../orders/contracts";
import { MutationForm } from "../orders/MutationForm";
import { SaleAuditTrail } from "../orders/AuditTrail";
export async function PaymentPage({ id }: { id: string }) {
  const [session, result, events] = await Promise.all([
    getAdminSessionContext(),
    saleRead(`/admin/payments/${encodeURIComponent(id)}`, paymentSchema),
    saleRead(`/admin/payments/${encodeURIComponent(id)}/events`, eventsSchema),
  ]);
  const permissions = session.ok ? session.data.user.permissions : [];
  return (
    <AdminShell>
      <div className="space-y-5">
        <Link href="/admin/pagos" className="underline">
          Volver a pagos
        </Link>
        <h2 id="sale-page-title" className="text-2xl font-semibold">
          Detalle de pago
        </h2>
        {!result.ok ? (
          <AdminReadFailure result={result} />
        ) : (
          <>
            <section className="rounded-xl border border-white/20 p-4">
              <h2 className="text-lg font-semibold">
                {result.data.gateway} · {result.data.status}
              </h2>
              <p>{formatMoney(result.data.amount, result.data.currency)}</p>
              <p className="break-words">
                Referencia: {result.data.gatewayReference}
              </p>
              <p className="break-words">
                Transacción: {result.data.transactionId ?? "Sin transacción"}
              </p>
              <p>
                Confirmado: {result.data.confirmedAt ?? "Sin confirmación"} ·
                actualizado {result.data.updatedAt}
              </p>
              <Link
                href={`/admin/pedidos/${result.data.orderId}`}
                className="mt-3 inline-block underline"
              >
                Revisar pedido asociado
              </Link>
            </section>
            {result.data.gateway === "cash_on_delivery" ? (
              result.data.status === "approved" ? (
                <p data-state="success">COD ya conciliado.</p>
              ) : permissions.includes("payments.reconcile") ? (
                <MutationForm kind="cod" id={result.data.id} />
              ) : (
                <p data-state="forbidden">
                  Se requiere permiso de conciliación de pagos.
                </p>
              )
            ) : (
              <section
                data-state="provider_blocked"
                className="rounded-xl border border-amber-400/30 p-4"
              >
                <h2 className="text-lg font-semibold">
                  {result.data.gateway === "pse"
                    ? "PSE · proveedor bloqueado"
                    : `${result.data.gateway} · consulta externa bloqueada`}
                </h2>
                <p>
                  No hay proveedor externo configurado para consultar o aprobar
                  el pago.
                </p>
                <p data-state="business_decision_blocked">
                  La conciliación de una aprobación posterior a una cancelación
                  requiere decisión de Pagos y Finanzas.
                </p>
              </section>
            )}
            {result.data.gateway !== "cash_on_delivery" &&
            permissions.includes("payments.write") ? (
              <ProviderReview id={result.data.id} />
            ) : null}
            <SaleAuditTrail
              kind="payment"
              id={result.data.id}
              allowed={permissions.includes("audit.read")}
            />
          </>
        )}
        <section className="rounded-xl border border-white/20 p-4">
          <h2 className="text-lg font-semibold">
            Eventos recibidos · últimos 50
          </h2>
          {!events.ok ? (
            <AdminReadFailure result={events} />
          ) : events.data.data.length ? (
            <ol className="mt-3 space-y-3">
              {events.data.data.map((event) => (
                <li
                  key={event.id}
                  className="break-words border-l border-white/30 pl-3"
                >
                  <p>
                    {event.gateway} · {event.providerEventId}
                  </p>
                  <p>Recibido {event.receivedAt}</p>
                  <p>
                    {event.processedAt
                      ? `Procesado ${event.processedAt}`
                      : "Pendiente de procesamiento"}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p data-state="empty_success">
              Sin eventos recibidos. No implica confirmación del pago.
            </p>
          )}
        </section>
        {!session.ok ? <AdminReadFailure result={session} /> : null}
      </div>
    </AdminShell>
  );
}
