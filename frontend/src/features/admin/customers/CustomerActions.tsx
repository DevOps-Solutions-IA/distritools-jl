"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { crmRequest, customerChanges } from "../quotes/contracts";
import { fieldClass, buttonClass } from "../quotes/QuoteActions";
import { record, text } from "../quotes/display";
import { useCrmSessionRecovery } from "../quotes/session-recovery";
export function ExportCustomers({ permissions }: { permissions: string[] }) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  if (!permissions.includes("customers.export")) return null;
  return (
    <section className="space-y-3 rounded-xl border border-amber-300/25 p-4">
      <h2 className="font-semibold">
        Exportación de clientes · BLOCKED_DECISION
      </h2>
      <p>
        La política de tratamiento de datos está pendiente. Esta acción registra
        una solicitud bloqueada; no descarga datos.
      </p>
      <button
        className={buttonClass}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const result = await crmRequest("/customers/export", "POST");
          setBusy(false);
          setMessage(
            result.ok && result.data.exported === false
              ? text(record(result.data.operationalState).message)
              : result.ok
                ? "Respuesta inesperada: no se generó ni descargó archivo."
                : result.error,
          );
        }}
      >
        Registrar solicitud de exportación
      </button>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
export function CustomerActions(props: { id: string; permissions: string[] }) {
  return (
    <CustomerActionState
      key={`${props.id}:${[...props.permissions].sort().join(",")}`}
      {...props}
    />
  );
}
function CustomerActionState({
  id,
  permissions,
}: {
  id: string;
  permissions: string[];
}) {
  const router = useRouter();
  const recovery = useCrmSessionRecovery();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [sensitive, setSensitive] = useState<Record<string, unknown> | null>(null);
  async function submit(
    body?: object,
    action = "",
    method: "POST" | "PATCH" = "PATCH",
  ) {
    if (busy) return;
    const isCurrent = recovery.capture();
    setBusy(true);
    setMessage("");
    const result = await crmRequest(
      `/customers/${encodeURIComponent(id)}${action}`,
      method,
      body,
    );
    if (!isCurrent()) return;
    if (!result.ok) {
      setMessage(result.error);
      if (
        result.status === 401 ||
        result.status === 403 ||
        result.kind === "contract_error"
      )
        setSensitive(null);
      if (result.status === 401) {
        const message = await recovery.recover(isCurrent);
        if (!isCurrent()) return;
        if (message) setMessage(message);
      }
      setBusy(false);
      return;
    }
    setBusy(false);
    if (action) {
      setSensitive(result.data);
      setMessage("Consulta sensible auditada. Cierre esta vista al terminar.");
    } else {
      setMessage(
        "Perfil actualizado; asociación de pedidos por correo existente.",
      );
      setSensitive(null);
      router.refresh();
    }
  }
  return (
    <section className="space-y-4 rounded-xl border border-white/15 p-4">
      {message && <p role="status">{message}</p>}
      {permissions.includes("customers.notes.write") && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            try {
              const payload = customerChanges(
                Object.fromEntries(
                  [
                    "fullName",
                    "email",
                    "phone",
                    "defaultAddress",
                    "city",
                    "department",
                    "country",
                  ].map((key) => [key, String(data.get(key) ?? "")]),
                ),
              );
              if (!Object.keys(payload).length) {
                setMessage("Introduzca al menos un dato nuevo.");
                return;
              }
              void submit(payload);
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Revise los datos.",
              );
            }
          }}
          className="space-y-3"
        >
          <h2 className="font-semibold">Reemplazar datos del perfil</h2>
          <p>
            No se precargan valores enmascarados. Los campos vacíos conservan el
            valor almacenado. Cambiar correo no traslada pedidos anteriores.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries({
              fullName: "Nombre nuevo",
              email: "Correo nuevo",
              phone: "Teléfono nuevo",
              defaultAddress: "Dirección nueva",
              city: "Ciudad nueva",
              department: "Departamento nuevo",
              country: "País nuevo",
            }).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  name={key}
                  type={key === "email" ? "email" : "text"}
                  autoComplete="off"
                  className={fieldClass}
                />
              </label>
            ))}
          </div>
          <button disabled={busy} className={buttonClass}>
            Guardar perfil
          </button>
        </form>
      )}
      {permissions.includes("customers.read_sensitive") && (
        <button
          disabled={busy}
          className={buttonClass}
          onClick={() => void submit(undefined, "/view-sensitive", "POST")}
        >
          Consultar datos sensibles con auditoría
        </button>
      )}
      {permissions.includes("customers.read_sensitive") && sensitive && (
        <div
          className="space-y-2 border border-amber-300/25 p-3"
          aria-label="Datos sensibles consultados"
        >
          <p>{text(sensitive.fullName)}</p>
          <p>{text(sensitive.email)}</p>
          <p>{text(sensitive.phone)}</p>
          <p>{text(sensitive.defaultAddress)}</p>
          <button className={buttonClass} onClick={() => setSensitive(null)}>
            Cerrar datos sensibles
          </button>
        </div>
      )}
    </section>
  );
}
