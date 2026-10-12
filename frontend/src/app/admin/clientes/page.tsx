import type { SectionSearchParams } from "@/features/admin/platform/query";
import { filterSectionQuery } from "@/features/admin/platform/query";
import { SectionQueryControls } from "@/features/admin/platform/SectionQueryControls";
import { paginationMeta } from "@/features/admin/platform/query";
import { ClientesScreen } from "@/features/admin/screen-adapters/crm/SectionScreens";
import { getAdminModule } from "@/lib/admin/operations";
import { getAdminOperationalSnapshot } from "@/lib/admin/server-data";
import {
  CrmFrame,
  crmError,
  crmLoad,
  crmSession,
} from "@/features/admin/quotes/CrmFrame";
import { ExportCustomers } from "@/features/admin/customers/CustomerActions";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Clientes admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function AdminCustomersPage({
  searchParams,
}: { searchParams?: Promise<SectionSearchParams> } = {}) {
  const loaded = await crmLoad(async () => {
    const query = filterSectionQuery("clientes", (await searchParams) ?? {});
    const permissions = await crmSession();
    const operations = await getAdminOperationalSnapshot(["customers"], query);
    return { query, permissions, operations };
  });
  if (!loaded.ok) return crmError(loaded.error, "Clientes", "/admin/dashboard");
  const { query, permissions, operations } = loaded.data;
  return (
    <CrmFrame title="Clientes" backHref="/admin/dashboard">
      <SectionQueryControls
        moduleKey="clientes"
        query={query}
        meta={paginationMeta(operations.customers)}
      />
      <ClientesScreen
        moduleKey="clientes"
        adminModule={getAdminModule("clientes")}
        snapshot={null}
        operations={operations}
      />
      <ExportCustomers permissions={permissions} />
    </CrmFrame>
  );
}
