import { QuoteDetailScreen } from "@/features/admin/screen-adapters/crm/DetailScreens";
import { QuoteActions } from "@/features/admin/quotes/QuoteActions";
import {
  CrmFrame,
  crmError,
  crmLoad,
  crmRead,
  crmSession,
} from "@/features/admin/quotes/CrmFrame";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Detalle cotización admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function AdminQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const loaded = await crmLoad(async () => {
    const { id } = await params;
    const permissions = await crmSession();
    const quote = await crmRead(`/admin/quotes/${encodeURIComponent(id)}`);
    return { permissions, quote };
  });
  if (!loaded.ok)
    return crmError(
      loaded.error,
      "Detalle de cotización",
      "/admin/cotizaciones",
    );
  const { permissions, quote } = loaded.data;
  return (
    <CrmFrame title="Detalle de cotización" backHref="/admin/cotizaciones">
      <QuoteDetailScreen value={quote} />
      <QuoteActions
        key={String(quote.updatedAt)}
        quote={quote}
        permissions={permissions}
      />
    </CrmFrame>
  );
}
