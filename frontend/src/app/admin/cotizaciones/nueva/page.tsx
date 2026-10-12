import {
  CrmFrame,
  crmError,
  crmLoad,
  crmSession,
} from "@/features/admin/quotes/CrmFrame";
import { CreateQuoteForm } from "@/features/admin/quotes/CreateQuoteForm";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Nueva cotización admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function NewQuotePage() {
  const loaded = await crmLoad(async () => {
    const permissions = await crmSession();
    return { permissions };
  });
  if (!loaded.ok)
    return crmError(loaded.error, "Nueva cotización", "/admin/cotizaciones");
  const { permissions } = loaded.data;
  return (
    <CrmFrame title="Nueva cotización" backHref="/admin/cotizaciones">
      {permissions.includes("quotes.write") ? (
        <CreateQuoteForm />
      ) : (
        <p role="alert">No tiene permiso para crear cotizaciones.</p>
      )}
    </CrmFrame>
  );
}
