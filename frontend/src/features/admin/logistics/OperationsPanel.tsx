"use client";
import { useState } from "react";
import { useAdminSession } from "@/features/admin/shell/useAdminSession";
import { record, text } from "./contract";
import { linkClass } from "./ui";
export function OperationsPanel({
  capabilities,
}: {
  capabilities: Record<string, unknown>;
}) {
  const { state, retry } = useAdminSession("logistics:provider-check");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const config = record(capabilities.providerConfig);
  const mock =
    capabilities.provider === "mock_99envios" ||
    capabilities.mode === "mock" ||
    config.status === "mock_local";
  const canRead =
    state.status === "success" &&
    state.user.permissions.includes("shipping.read");
  async function check() {
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/admin/shipping/login-test", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = record(await response.json().catch(() => null));
      if (!response.ok) {
        setResult({
          ok: false,
          message:
            response.status === 401
              ? "Sesión vencida. Inicia sesión."
              : response.status === 403
                ? "No tienes permiso para consultar el proveedor."
                : "No se pudo confirmar la conexión.",
        });
        if (response.status === 401 || response.status === 403) retry();
        return;
      }
      setResult({
        ok: data.ok === true,
        message:
          data.status === "mock_authenticated"
            ? "Login mock local/test; no autentica contra 99 Envíos real."
            : data.status === "internal_tracking"
              ? "BLOCKED_PROVIDER: sólo tracking interno; no hay login externo."
              : data.ok === true
                ? "Conexión confirmada por el backend; requiere aprobación de proveedor antes de operaciones externas."
                : "BLOCKED_PROVIDER: conexión externa no confirmada.",
      });
    } catch {
      setResult({
        ok: false,
        message: "No se pudo conectar con el servicio administrativo.",
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="min-w-0 rounded-xl border border-white/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Operador logístico</h2>
        <span className="text-xs text-amber-200">Producción NO-GO</span>
      </div>
      <p className="mt-2 text-sm">
        Proveedor: {text(capabilities.provider) ?? "Sin confirmar"} · modo{" "}
        {text(capabilities.mode) ?? "Sin confirmar"}
      </p>
      {mock ? (
        <div className="mt-3 rounded-lg bg-amber-300/10 p-3 text-sm">
          <p className="font-semibold">Mock local/test activo</p>
          <p>
            No existe en panel real 99 Envíos. Sus resultados no acreditan
            tarifas, guías ni PDF reales.
          </p>
        </div>
      ) : null}
      <ul className="mt-4 space-y-2 text-sm">
        {[
          "Cotizar envío",
          "Crear preenvío",
          "Descargar PDF",
          "Sincronizar novedades",
          "Sincronizar provider",
        ].map((label) => (
          <li
            key={label}
            className="flex flex-wrap justify-between gap-2 border-b border-white/10 pb-2"
          >
            <span>{label}</span>
            <span className="text-amber-200">
              BLOCKED_PROVIDER · integración autorizada pendiente
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
        Las lecturas internas permanecen disponibles. Las operaciones externas
        requieren el cierre de su integración y autorización de proveedor.
      </p>
      {canRead ? (
        <button
          className={linkClass + " mt-4"}
          onClick={() => void check()}
          disabled={pending}
        >
          {pending ? "Comprobando…" : "Probar login"}
        </button>
      ) : null}
      {result ? (
        <p role={result.ok ? "status" : "alert"} className="mt-3 text-sm">
          {result.message}
        </p>
      ) : null}
    </section>
  );
}
