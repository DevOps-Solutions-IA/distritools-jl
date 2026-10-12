import Link from "next/link";
import {
  money,
  quoteStatus,
  record,
  rows,
  text,
} from "@/features/admin/quotes/display";
import type {
  DetailAdapterRegistration,
  DetailScreenProps,
} from "../shared/types";
const box = "space-y-3 rounded-xl border border-white/15 p-4";
export function QuoteDetailScreen({ value }: DetailScreenProps) {
  const quote = record(value),
    customer = record(quote.customer),
    order = record(quote.order);
  return (
    <div className="space-y-5">
      <section className={box}>
        <h2 className="text-xl font-semibold">{text(quote.quoteNumber)}</h2>
        <p>{quoteStatus(text(quote.status), quote.order)}</p>
        <p>
          Cliente: {text(customer.fullName)} · {text(customer.email)}
        </p>
        <p>
          Subtotal: {money(quote.subtotal)} {text(quote.currency)}
        </p>
        {quote.order ? (
          <Link
            href={`/admin/pedidos/${encodeURIComponent(text(order.id))}`}
            className="underline"
          >
            {text(order.orderNumber)}
          </Link>
        ) : (
          <p>
            Sin pedido vinculado. La intención de conversión no reserva stock ni
            cobra pagos.
          </p>
        )}
        <p>Notas: {text(quote.notes)}</p>
        <p>Notas internas: {text(quote.internalNotes)}</p>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Líneas de cotización</h2>
        {rows(quote.items).length ? (
          rows(quote.items).map((item) => (
            <div key={text(item.id)} className="border-b border-white/10 py-2">
              <p>
                {text(item.nameSnapshot)} · {text(item.skuSnapshot)}
              </p>
              <p>
                {text(item.quantity)} unidades · Precio: {money(item.unitPrice)}{" "}
                · Total: {money(item.totalPrice)}
              </p>
              <p>{text(item.notes)}</p>
            </div>
          ))
        ) : (
          <p>No hay líneas en esta cotización.</p>
        )}
      </section>
      <section className={box}>
        <h2 className="font-semibold">Historial auditado</h2>
        <p className="text-sm">
          Últimos 50 eventos devueltos por el servicio; no representa el
          historial completo.
        </p>
        {rows(quote.timeline).map((event) => (
          <div key={text(event.id)} className="border-b border-white/10 py-2">
            <p>{text(event.action)}</p>
            <p className="text-sm">
              {text(event.createdAt)} · Actor: {text(event.actorUserId)}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
export function CustomerDetailScreen({ value }: DetailScreenProps) {
  const customer = record(value);
  return (
    <div className="space-y-5">
      <section className={box}>
        <h2 className="text-xl font-semibold">{text(customer.fullName)}</h2>
        <p>
          {text(customer.email)} · {text(customer.phone)}
        </p>
        <p>
          {text(customer.city)} · {text(customer.department)}
        </p>
        <p>
          PII protegida por el servicio. Revelar datos requiere permiso y
          auditoría específicos.
        </p>
      </section>
      <section className={box}>
        <h2 className="font-semibold">Consentimientos registrados</h2>
        <p className="text-sm">
          Hasta 100 registros existentes; editar el perfil no crea historial de
          consentimiento.
        </p>
        {rows(customer.consents).map((consent) => (
          <p key={text(consent.id)}>
            {text(consent.type)} ·{" "}
            {consent.accepted ? "Aceptado" : "No aceptado"} ·{" "}
            {text(consent.source)} · {text(consent.createdAt)}
          </p>
        ))}
      </section>
    </div>
  );
}
export const crmDetailAdapters = [
  { prefix: "/admin/quotes/", Screen: QuoteDetailScreen },
  { prefix: "/admin/customers/", Screen: CustomerDetailScreen },
] satisfies ReadonlyArray<DetailAdapterRegistration>;
