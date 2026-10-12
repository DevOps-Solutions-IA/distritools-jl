"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { crmRequest, priceItemsPayload } from "./contracts";
import { useCrmSessionRecovery } from "./session-recovery";
import { record, text, rows } from "./display";
export const fieldClass =
  "mt-1 w-full rounded-lg border border-white/20 bg-[var(--color-surface)] px-3 py-2";
export const buttonClass =
  "rounded-lg bg-[var(--color-industrial-yellow)] px-4 py-2 font-semibold text-black disabled:opacity-50";
type QuoteActionProps = {
  quote: Record<string, unknown>;
  permissions: string[];
};
export function QuoteActions(props: QuoteActionProps) {
  return (
    <QuoteActionState
      key={`${text(props.quote.id)}:${text(props.quote.status)}:${[...props.permissions].sort().join(",")}`}
      {...props}
    />
  );
}
function QuoteActionState({ quote, permissions }: QuoteActionProps) {
  const router = useRouter();
  const recovery = useCrmSessionRecovery();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false);
  const items = rows(quote.items);
  const id = encodeURIComponent(text(quote.id));
  const status = text(quote.status);
  async function execute(
    action: string,
    body?: object,
    method: "POST" | "PATCH" = "POST",
  ) {
    if (busy) return;
    const isCurrent = recovery.capture();
    setBusy(true);
    setMessage("");
    setFailed(false);
    const result = await crmRequest(`/quotes/${id}${action}`, method, body, {
      status,
    });
    if (!isCurrent()) return;
    if (!result.ok) {
      setFailed(true);
      setMessage(result.error);
      if (result.status === 401) {
        const message = await recovery.recover(isCurrent);
        if (!isCurrent()) return;
        if (message) setMessage(message);
      }
      setBusy(false);
      return;
    }
    setBusy(false);
    const operation = record(result.data.operationalState);
    setMessage(
      typeof operation.message === "string"
        ? operation.message
        : "Cambio confirmado por el servicio. Consulte el estado y el historial actualizado.",
    );
    router.refresh();
  }
  const canWrite = permissions.includes("quotes.write");
  return (
    <section
      className="space-y-5 rounded-xl border border-white/15 p-4"
      aria-label="Operaciones de cotización"
    >
      {message && <p role={failed ? "alert" : "status"}>{message}</p>}
      {canWrite && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void execute(
              "",
              {
                notes: String(data.get("notes") ?? ""),
                internalNotes: String(data.get("internalNotes") ?? ""),
              },
              "PATCH",
            );
          }}
          className="space-y-3"
        >
          <h2 className="font-semibold">Editar notas</h2>
          <label className="block">
            Notas del cliente
            <textarea
              name="notes"
              aria-label="Notas del cliente"
              defaultValue={typeof quote.notes === "string" ? quote.notes : ""}
              className={fieldClass}
            />
          </label>
          <label className="block">
            Notas internas
            <textarea
              name="internalNotes"
              aria-label="Notas internas"
              defaultValue={
                typeof quote.internalNotes === "string"
                  ? quote.internalNotes
                  : ""
              }
              className={fieldClass}
            />
          </label>
          <button disabled={busy} className={buttonClass}>
            Guardar notas
          </button>
        </form>
      )}
      {canWrite &&
        !["accepted", "rejected", "converted_to_order", "cancelled"].includes(
          status,
        ) &&
        items.length > 0 && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              try {
                const payload = priceItemsPayload(
                  items.map((item) => ({
                    id: text(item.id),
                    quantity: Number(item.quantity),
                  })),
                  items.map((item) => ({
                    id: text(item.id),
                    quantity: String(data.get(`quantity-${item.id}`) ?? ""),
                    unitPrice: String(data.get(`price-${item.id}`) ?? ""),
                  })),
                );
                void execute("/price-items", payload);
              } catch (error) {
                setFailed(true);
                setMessage(
                  error instanceof Error ? error.message : "Revise las líneas.",
                );
              }
            }}
            className="space-y-3"
          >
            <h2 className="font-semibold">Asignar precio a líneas propias</h2>
            {items.map((item) => (
              <fieldset
                key={text(item.id)}
                className="grid gap-3 border border-white/10 p-3 sm:grid-cols-2"
              >
                <legend>{text(item.nameSnapshot)}</legend>
                <label>
                  Cantidad
                  <input
                    name={`quantity-${item.id}`}
                    type="number"
                    min="1"
                    step="1"
                    required
                    defaultValue={Number(item.quantity)}
                    className={fieldClass}
                  />
                </label>
                <label>
                  Precio unitario
                  <input
                    name={`price-${item.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={
                      item.unitPrice === null ? "" : text(item.unitPrice)
                    }
                    className={fieldClass}
                  />
                </label>
              </fieldset>
            ))}
            <button disabled={busy} className={buttonClass}>
              Guardar precios
            </button>
          </form>
        )}
      <div className="flex flex-wrap gap-3">
        {canWrite && ["requested", "in_review"].includes(status) && (
          <button
            disabled={busy}
            className={buttonClass}
            onClick={() => void execute("/submit-review")}
          >
            Solicitar revisión
          </button>
        )}
        {canWrite && ["requested", "in_review", "quoted"].includes(status) && (
          <button
            disabled={busy}
            className={buttonClass}
            onClick={() => void execute("/send")}
          >
            Registrar envío manual pendiente
          </button>
        )}
        {permissions.includes("quotes.approve") &&
          ["quoted", "sent"].includes(status) && (
            <>
              <button
                disabled={busy}
                className={buttonClass}
                onClick={() => void execute("/accept")}
              >
                Aceptar cotización
              </button>
              <button
                disabled={busy}
                className={buttonClass}
                onClick={() => void execute("/reject", {})}
              >
                Rechazar cotización
              </button>
            </>
          )}
        {canWrite &&
          ["requested", "in_review", "quoted", "sent", "accepted"].includes(
            status,
          ) && (
            <button
              disabled={busy}
              className={buttonClass}
              onClick={() => void execute("/cancel")}
            >
              Cancelar cotización
            </button>
          )}
        {permissions.includes("quotes.convert") &&
          items.length > 0 &&
          !quote.order && (
            <button
              disabled={busy}
              className={buttonClass}
              onClick={() => void execute("/convert-to-order")}
            >
              Solicitar conversión a pedido
            </button>
          )}
      </div>
      <p className="text-sm">
        El envío manual no confirma entrega. La conversión registra una
        intención; no crea un pedido, pago ni reserva. Los permisos y
        transiciones se validan en el servidor.
      </p>
    </section>
  );
}
