"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { crmRequest } from "./contracts";
import { useCrmSessionRecovery } from "./session-recovery";
import { buttonClass, fieldClass } from "./QuoteActions";
export function CreateQuoteForm() {
  const router = useRouter();
  const recovery = useCrmSessionRecovery();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="space-y-5 rounded-xl border border-white/15 p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const data = new FormData(event.currentTarget);
        const customerId = String(data.get("customerId") ?? "").trim();
        const productId = String(data.get("productId") ?? "").trim();
        const quantity = Number(data.get("quantity"));
        const unitPrice = String(data.get("unitPrice") ?? "").trim();
        if (
          !Number.isInteger(quantity) ||
          quantity < 1 ||
          (unitPrice &&
            (!Number.isFinite(Number(unitPrice)) || Number(unitPrice) < 0))
        ) {
          setMessage("Revise cantidad entera y precio no negativo.");
          return;
        }
        const customer = customerId
          ? undefined
          : {
              fullName: String(data.get("fullName") ?? "").trim(),
              email: String(data.get("email") ?? "").trim(),
              phone: String(data.get("phone") ?? "").trim(),
              dataTreatmentConsent: data.get("consent") === "on",
            };
        if (!customerId && (!customer?.fullName || !customer.email)) {
          setMessage(
            "Seleccione un cliente por ID o introduzca nombre y correo nuevos.",
          );
          return;
        }
        const isCurrent = recovery.capture();
        setBusy(true);
        const result = await crmRequest("/quotes", "POST", {
          ...(customerId ? { customerId } : { customer }),
          notes: String(data.get("notes") ?? ""),
          items: [
            {
              productId,
              nameSnapshot: String(data.get("nameSnapshot") ?? "").trim(),
              quantity,
              ...(unitPrice ? { unitPrice } : {}),
            },
          ],
        });
        if (!isCurrent()) return;
        if (!result.ok) {
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
        if (typeof result.data.id !== "string") {
          setMessage(
            "Resultado incierto: consulte el listado antes de repetir.",
          );
          return;
        }
        router.push(
          `/admin/cotizaciones/${encodeURIComponent(result.data.id)}`,
        );
        router.refresh();
      }}
    >
      <h2 className="font-semibold">Nueva cotización</h2>
      <p>
        Use referencias reales del catálogo y del cliente. Un cliente nuevo y la
        cotización se guardan en una sola transacción. No se crea un pedido.
      </p>
      <label className="block">
        ID de cliente existente (opcional)
        <input
          name="customerId"
          className={fieldClass}
          pattern="[0-9a-fA-F-]{36}"
        />
      </label>
      <p className="text-sm">
        Si introduce un ID, el perfil y consentimientos existentes se conservan.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Nombre de cliente nuevo
          <input name="fullName" className={fieldClass} />
        </label>
        <label>
          Correo de cliente nuevo
          <input name="email" type="email" className={fieldClass} />
        </label>
        <label>
          Teléfono de cliente nuevo
          <input name="phone" className={fieldClass} />
        </label>
      </div>
      <label className="flex gap-2">
        <input name="consent" type="checkbox" />
        Consentimiento de tratamiento informado por el cliente nuevo
      </label>
      <label className="block">
        ID real de producto
        <input
          name="productId"
          required
          pattern="[0-9a-fA-F-]{36}"
          className={fieldClass}
        />
      </label>
      <label className="block">
        Descripción de la línea
        <input name="nameSnapshot" required className={fieldClass} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          Cantidad
          <input
            name="quantity"
            type="number"
            min="1"
            step="1"
            defaultValue="1"
            required
            className={fieldClass}
          />
        </label>
        <label>
          Precio unitario (vacío para solicitar precio)
          <input
            name="unitPrice"
            type="number"
            min="0"
            step="0.01"
            className={fieldClass}
          />
        </label>
      </div>
      <label className="block">
        Notas
        <textarea name="notes" className={fieldClass} />
      </label>
      <button disabled={busy} className={buttonClass}>
        Crear cotización
      </button>
      {message && <p role="alert">{message}</p>}
    </form>
  );
}
