import Link from "next/link";
import { AdminReadError } from "@/lib/admin/server-data";
import { adminFailure } from "@/lib/admin/transport/result";
import { logisticsView } from "@/features/admin/logistics/View";
import {
  logisticsPermissions,
  logisticsRead,
  checked,
} from "@/features/admin/logistics/server";
import {
  shipment,
  events,
  uuid,
  guideLabel,
  shipmentLabels,
  date,
} from "@/features/admin/logistics/contract";
import { Timeline } from "@/features/admin/logistics/Timeline";
import { LogReadFence } from "@/features/admin/logistics/LogReadFence";
import { linkClass } from "@/features/admin/logistics/ui";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Detalle envío admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function AdminShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return logisticsView(
    "Detalle de envío",
    "Trazabilidad del registro logístico; sin datos personales del destinatario.",
    async () => {
      const permissions = await logisticsPermissions("shipping.read");
      const { id } = await params;
      if (!uuid(id)) throw new AdminReadError(adminFailure(400));
      const raw = await logisticsRead("/admin/shipments/" + id);
      const row = checked(() => shipment(raw));
      const eventRaw = permissions.includes("tracking.read")
        ? await logisticsRead<{ data: unknown }>(
            "/admin/shipments/" + id + "/events",
          )
        : null;
      const timeline = eventRaw ? checked(() => events(eventRaw.data)) : [];
      return (
        <LogReadFence permission="shipping.read">
          <div className="flex flex-wrap gap-3">
            <Link className={linkClass} href="/admin/envios">
              Volver a envíos
            </Link>
            <Link
              className={linkClass}
              href={
                "/rastreo-de-pedido?query=" +
                encodeURIComponent(row.orderNumber)
              }
            >
              Abrir rastreo público
            </Link>
          </div>
          <section className="my-4 grid min-w-0 gap-4 rounded-xl border border-white/10 p-4 sm:grid-cols-2">
            <div>
              <h2 className="font-semibold">{row.orderNumber}</h2>
              <p className="mt-2">{shipmentLabels[row.status] ?? row.status}</p>
              <p className="mt-2">{guideLabel(row)}</p>
              {guideLabel(row) === "Mock local/test" ? (
                <p className="text-sm text-amber-200">
                  No existe en panel real 99 Envíos.
                </p>
              ) : null}
            </div>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[var(--color-text-secondary)]">
                  Guía externa
                </dt>
                <dd className="break-all">
                  {row.trackingNumber ?? "Sin guía externa"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-secondary)]">
                  Registrado
                </dt>
                <dd>{date(row.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-text-secondary)]">
                  Última sincronización
                </dt>
                <dd>{date(row.lastSyncAt)}</dd>
              </div>
            </dl>
          </section>
          {permissions.includes("tracking.read") ? (
            <LogReadFence permission="tracking.read">
              <Timeline items={timeline} />
            </LogReadFence>
          ) : (
            <p>Consultar eventos requiere tracking.read.</p>
          )}
          <p className="mt-4 text-sm text-amber-200">
            BLOCKED_PROVIDER: PDF y sincronización externa pendientes de
            integración autorizada.
          </p>
        </LogReadFence>
      );
    },
  );
}
