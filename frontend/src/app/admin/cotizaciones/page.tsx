import Link from "next/link";
import type { SectionSearchParams } from "@/features/admin/platform/query";
import {
  filterSectionQuery,
  paginationMeta,
} from "@/features/admin/platform/query";
import { SectionQueryControls } from "@/features/admin/platform/SectionQueryControls";
import { CotizacionesScreen } from "@/features/admin/screen-adapters/crm/SectionScreens";
import { getAdminModule } from "@/lib/admin/operations";
import { getAdminOperationalSnapshot } from "@/lib/admin/server-data";
import {
  CrmFrame,
  crmError,
  crmLoad,
  crmSession,
} from "@/features/admin/quotes/CrmFrame";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Cotizaciones admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function AdminQuotesPage({
  searchParams,
}: { searchParams?: Promise<SectionSearchParams> } = {}) {
  const loaded = await crmLoad(async () => {
    const query = filterSectionQuery(
      "cotizaciones",
      (await searchParams) ?? {},
    );
    const permissions = await crmSession();
    const operations = await getAdminOperationalSnapshot(["quotes"], query);
    return { query, permissions, operations };
  });
  if (!loaded.ok)
    return crmError(loaded.error, "Cotizaciones", "/admin/dashboard");
  const { query, permissions, operations } = loaded.data;
  return (
    <CrmFrame title="Cotizaciones" backHref="/admin/dashboard">
      {permissions.includes("quotes.write") && (
        <Link
          href="/admin/cotizaciones/nueva"
          className="inline-block rounded-lg bg-[var(--color-industrial-yellow)] px-4 py-2 font-semibold text-black"
        >
          Nueva cotización
        </Link>
      )}
      <SectionQueryControls
        moduleKey="cotizaciones"
        query={query}
        meta={paginationMeta(operations.quotes)}
      />
      <CotizacionesScreen
        moduleKey="cotizaciones"
        adminModule={getAdminModule("cotizaciones")}
        snapshot={null}
        operations={operations}
      />
    </CrmFrame>
  );
}
