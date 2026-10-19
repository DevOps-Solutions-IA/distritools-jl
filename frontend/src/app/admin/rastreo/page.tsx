import type { SectionSearchParams } from "@/features/admin/platform/query";
import {
  filterSectionQuery,
  paginationMeta,
} from "@/features/admin/platform/query";
import {
  AdminReadError,
  getAdminOperationalSnapshot,
} from "@/lib/admin/server-data";
import { adminFailure } from "@/lib/admin/transport/result";
import {
  logisticsPermissions,
  logisticsRead,
  checked,
  validateShipmentQuery,
} from "@/features/admin/logistics/server";
import { logisticsView } from "@/features/admin/logistics/View";
import { shipment, events, uuid } from "@/features/admin/logistics/contract";
import { ShipmentList } from "@/features/admin/logistics/ShipmentList";
import { Timeline } from "@/features/admin/logistics/Timeline";
import { LogReadFence } from "@/features/admin/logistics/LogReadFence";
import { fieldClass, linkClass } from "@/features/admin/logistics/ui";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Rastreo admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function AdminTrackingPage({
  searchParams,
}: { searchParams?: Promise<SectionSearchParams> } = {}) {
  return logisticsView(
    "Rastreo operativo",
    "Búsqueda por pedido y consulta de eventos internos; el proveedor externo conserva su bloqueo.",
    async () => {
      const permissions = await logisticsPermissions("tracking.read");
      const query = (await searchParams) ?? {};
      const shipmentId =
        typeof query.shipmentId === "string" ? query.shipmentId.trim() : "";
      if (shipmentId && !uuid(shipmentId))
        throw new AdminReadError(adminFailure(400));
      const data = permissions.includes("shipping.read")
        ? await getAdminOperationalSnapshot(
            ["shipments"],
            validateShipmentQuery(filterSectionQuery("rastreo", query)),
          )
        : null;
      const result = shipmentId
        ? await logisticsRead<{ data: unknown }>(
            "/admin/shipments/" + shipmentId + "/events",
          )
        : null;
      return (
        <LogReadFence permission="tracking.read">
          <form
            method="get"
            action="/admin/rastreo"
            className="mb-4 flex min-w-0 flex-wrap items-end gap-3"
          >
            <label className="min-w-0 flex-1 text-sm">
              ID del envío
              <input
                name="shipmentId"
                defaultValue={shipmentId}
                required
                maxLength={36}
                className={fieldClass}
              />
            </label>
            <button type="submit" className={linkClass}>
              Consultar eventos
            </button>
          </form>
          {result ? (
            <Timeline items={checked(() => events(result.data))} />
          ) : null}
          {data ? (
            <LogReadFence permission="shipping.read">
              <ShipmentList
                rows={checked(() => data.shipments.data.map(shipment))}
                meta={paginationMeta(data.shipments)}
                query={query}
                tracking
              />
            </LogReadFence>
          ) : (
            <p className="text-sm">
              Buscar pedidos en la lista requiere shipping.read; puedes
              consultar eventos con el ID del envío.
            </p>
          )}
          <p className="mt-4 text-sm text-amber-200">
            Sincronizar provider: BLOCKED_PROVIDER. No se consulta una
            transportadora sin integración autorizada.
          </p>
        </LogReadFence>
      );
    },
  );
}
