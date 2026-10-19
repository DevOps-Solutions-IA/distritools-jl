import type { SectionSearchParams } from "@/features/admin/platform/query";
import {
  filterSectionQuery,
  paginationMeta,
} from "@/features/admin/platform/query";
import { getAdminOperationalSnapshot } from "@/lib/admin/server-data";
import {
  logisticsPermissions,
  checked,
  validateShipmentQuery,
} from "@/features/admin/logistics/server";
import { logisticsView } from "@/features/admin/logistics/View";
import { shipment } from "@/features/admin/logistics/contract";
import { ShipmentList } from "@/features/admin/logistics/ShipmentList";
import { OperationsPanel } from "@/features/admin/logistics/OperationsPanel";
import { LogReadFence } from "@/features/admin/logistics/LogReadFence";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Envíos admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function AdminShipmentsPage({
  searchParams,
}: { searchParams?: Promise<SectionSearchParams> } = {}) {
  return logisticsView(
    "Envíos",
    "Pedidos, guías y estados persistidos de la operación logística.",
    async () => {
      await logisticsPermissions("shipping.read");
      const query = (await searchParams) ?? {};
      const data = await getAdminOperationalSnapshot(
        ["shipments", "shippingCapabilities"],
        validateShipmentQuery(filterSectionQuery("envios", query)),
      );
      const rows = checked(() => data.shipments.data.map(shipment));
      return (
        <LogReadFence permission="shipping.read">
          <OperationsPanel capabilities={data.shippingCapabilities} />
          <ShipmentList
            rows={rows}
            meta={paginationMeta(data.shipments)}
            query={query}
          />
        </LogReadFence>
      );
    },
  );
}
