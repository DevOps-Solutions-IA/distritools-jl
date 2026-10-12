"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { mutateSale, type SaleMutationResult } from "./transport";
type MutationFormProps =
  | { kind: "cancel"; id: string; expectedId: string }
  | { kind: "cod"; id: string };
export function MutationForm(props: MutationFormProps) {
  const { kind, id } = props;
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SaleMutationResult | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const title = kind === "cancel" ? "Cancelar pedido" : "Conciliar COD";
  return (
    <section className="rounded-xl border border-white/20 p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <form
        ref={form}
        className="mt-3 space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!confirm || pending) return;
          setPending(true);
          setResult(null);
          const data = new FormData(event.currentTarget);
          const payload: Record<string, string> =
            kind === "cancel"
              ? { reason: String(data.get("reason")).trim() }
              : {
                  reference: String(data.get("reference")).trim(),
                  note: String(data.get("note")).trim(),
                };
          if (Object.values(payload).some((value) => !value)) {
            setResult({
              ok: false,
              kind: "validation_error",
              status: 400,
              data: null,
              error: "Complete los campos requeridos con texto válido.",
            });
            setPending(false);
            setConfirm(false);
            return;
          }
          const response = await mutateSale(
            kind === "cancel"
              ? `/api/admin/orders/${encodeURIComponent(id)}/cancel`
              : `/api/admin/payments/${encodeURIComponent(id)}/reconcile-cod`,
            payload,
            { kind, id: props.kind === "cancel" ? props.expectedId : props.id },
          );
          setResult(response);
          setPending(false);
          setConfirm(false);
          if (response.ok) router.refresh();
        }}
      >
        {kind === "cancel" ? (
          <label className="block">
            Motivo
            <textarea
              name="reason"
              required
              maxLength={500}
              className="mt-1 block w-full rounded border border-white/30 bg-black p-2"
            />
          </label>
        ) : (
          <>
            <label className="block">
              Referencia de recaudo
              <input
                name="reference"
                required
                maxLength={200}
                className="mt-1 block w-full rounded border border-white/30 bg-black p-2"
              />
            </label>
            <label className="block">
              Nota de conciliación
              <textarea
                name="note"
                required
                maxLength={500}
                className="mt-1 block w-full rounded border border-white/30 bg-black p-2"
              />
            </label>
          </>
        )}
        {confirm ? (
          <div role="group" aria-label="Confirmación" className="space-y-3">
            <p>
              {kind === "cancel"
                ? "Confirme la cancelación y liberación según la política vigente."
                : "Confirme que el recaudo contra entrega fue recibido. Esta operación aprueba el pago COD."}
            </p>
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-[var(--color-industrial-yellow)] px-4 py-2 text-black disabled:opacity-50"
            >
              {pending ? "Procesando…" : `Confirmar ${title.toLowerCase()}`}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirm(false)}
              className="ml-3 underline"
            >
              Volver
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={
              pending ||
              result?.kind === "uncertain" ||
              (result?.ok === false && result.status >= 500)
            }
            onClick={() => {
              if (form.current?.reportValidity()) setConfirm(true);
            }}
            className="rounded border border-white/30 px-4 py-2 disabled:opacity-50"
          >
            {title}
          </button>
        )}
      </form>
      {result ? (
        <div
          role={result.ok ? "status" : "alert"}
          data-state={result.kind}
          className="mt-4 rounded border border-white/30 p-3"
        >
          {result.ok
            ? `Operación confirmada: ${result.data.status}${result.data.alreadyReconciled ? " (ya conciliado)" : ""}.`
            : result.error}
          {!result.ok && result.kind === "auth_required" ? (
            <a href="/admin/login" className="ml-3 underline">
              Iniciar sesión
            </a>
          ) : null}
          {!result.ok &&
          (result.kind === "uncertain" || result.status >= 500) ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-3 underline"
            >
              Recargar y comprobar
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
