import Link from "next/link";
import { AdminReadFailure } from "@/features/admin/platform/ReadFailure";
import { saleRead } from "./reads";
import { paymentsSchema, formatMoney } from "./contracts";
export async function OrderPayments({
  id,
  allowed,
}: {
  id: string;
  allowed: boolean;
}) {
  if (!allowed)
    return (
      <p data-state="forbidden">Se requiere permiso de lectura de pagos.</p>
    );
  const result = await saleRead(
    `/admin/payments?orderId=${encodeURIComponent(id)}&page=1&limit=20`,
    paymentsSchema,
  );
  if (!result.ok) return <AdminReadFailure result={result} />;
  return (
    <div className="mt-3 space-y-3">
      <h3 className="font-semibold">
        Pagos asociados · {result.data.meta.total}
      </h3>
      {result.data.data.length ? (
        <ul className="space-y-2">
          {result.data.data.map((payment) => (
            <li
              key={payment.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-white/20 p-3"
            >
              <span>
                {payment.gateway} · {payment.status} ·{" "}
                {formatMoney(payment.amount, payment.currency)}
              </span>
              <Link className="underline" href={`/admin/pagos/${payment.id}`}>
                Revisar pago
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p data-state="empty_success">
          Sin pagos registrados para este pedido.
        </p>
      )}
      {result.data.meta.total > result.data.data.length ? (
        <Link
          className="inline-block underline"
          href={`/admin/pagos?orderId=${encodeURIComponent(id)}`}
        >
          Ver todos los pagos del pedido
        </Link>
      ) : null}
    </div>
  );
}
