"use client";
import { useState, useContext } from "react";
import Link from "next/link";
import { date, notificationLabels, type NotificationRow } from "./contract";
import { LogPermissionContext } from "./LogReadFence";
import { fieldClass, linkClass } from "./ui";
export function NotificationExplorer({
  rows,
  limit,
  settingsRead,
}: {
  rows: NotificationRow[];
  limit: number;
  settingsRead: boolean;
}) {
  const livePermissions = useContext(LogPermissionContext);
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [detail, setDetail] = useState<NotificationRow | null>(null);
  const filtered = rows.filter(
    (r) =>
      (!status || r.status === status) && (!channel || r.channel === channel),
  );
  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-wrap gap-3">
        <form
          method="get"
          action="/admin/notificaciones"
          className="flex min-w-0 flex-wrap items-end gap-3"
        >
          <label className="text-sm">
            Límite de historial
            <select
              name="limit"
              defaultValue={String(limit)}
              className={fieldClass}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button className={linkClass} type="submit">
            Consultar historial
          </button>
        </form>
        <Link
          href={"/admin/notificaciones?limit=" + limit}
          className={linkClass}
        >
          Actualizar historial
        </Link>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)]">
        Últimos {limit} registros consultados al backend; filtros locales sobre{" "}
        {rows.length} registros. Sin cursor de historial completo.
      </p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Estado en esta vista
          <select
            className={fieldClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setDetail(null);
            }}
          >
            <option value="">Todos los estados</option>
            {Object.entries(notificationLabels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Canal en esta vista
          <select
            className={fieldClass}
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value);
              setDetail(null);
            }}
          >
            <option value="">Todos los canales</option>
            {["email", "whatsapp", "internal"].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="max-w-full overflow-x-auto rounded-xl border border-white/10"
        role="region"
        aria-label="Historial de notificaciones"
        tabIndex={0}
      >
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Evento",
                "Estado",
                "Intentos",
                "Canal / proveedor",
                "Destinatario protegido",
                "Registro",
                "Detalle",
              ].map((s) => (
                <th key={s} className="whitespace-nowrap p-3">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={row.id} className="border-t border-white/10">
                <td className="p-3">{row.eventName}</td>
                <td className="p-3">
                  {notificationLabels[row.status] ?? row.status}
                </td>
                <td className="p-3">{row.attempts}</td>
                <td className="p-3">
                  {row.channel} / {row.provider}
                </td>
                <td className="p-3">{row.recipient}</td>
                <td className="whitespace-nowrap p-3">{date(row.createdAt)}</td>
                <td className="p-3">
                  <button className={linkClass} onClick={() => setDetail(row)}>
                    Revisar notificación
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p data-state="EMPTY_SUCCESS" className="p-4">
            No hay notificaciones en esta vista.
          </p>
        ) : null}
      </div>
      {detail ? (
        <section
          role="region"
          aria-label="Detalle de notificación"
          className="space-y-2 rounded-xl border border-white/15 p-4"
        >
          <h2 className="font-semibold">{detail.eventName}</h2>
          <p>
            {notificationLabels[detail.status] ?? detail.status} ·{" "}
            {detail.attempts} intentos
          </p>
          <p>Código de fallo: {detail.lastError ?? "Sin código de fallo"}</p>
          <p>Entrega al proveedor: {date(detail.sentAt)}</p>
          <p>Último fallo: {date(detail.failedAt)}</p>
          <p>Actualizado: {date(detail.updatedAt)}</p>
          <button className={linkClass} onClick={() => setDetail(null)}>
            Cerrar detalle
          </button>
        </section>
      ) : null}
      <p className="rounded-lg border border-amber-300/20 p-3 text-sm text-amber-100">
        BLOCKED_DECISION: replay manual tras tres fallos o resultado incierto
        pendiente de política de operaciones. No se autoriza reenvío automático.
      </p>
      {settingsRead && livePermissions.includes("settings.read") ? (
        <Link className={linkClass} href="/admin/configuracion">
          Revisar configuración local del proveedor
        </Link>
      ) : (
        <p className="text-xs text-[var(--color-text-secondary)]">
          La validación local del proveedor requiere acceso a configuración; no
          hay endpoint de prueba de entrega disponible en notificaciones.
        </p>
      )}
    </section>
  );
}
