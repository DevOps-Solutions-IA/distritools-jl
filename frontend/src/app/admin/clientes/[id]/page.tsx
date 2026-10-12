import Link from "next/link";
import { CustomerDetailScreen } from "@/features/admin/screen-adapters/crm/DetailScreens";
import { CustomerActions } from "@/features/admin/customers/CustomerActions";
import {
  CrmFrame,
  crmError,
  crmLoad,
  crmRead,
  crmSession,
} from "@/features/admin/quotes/CrmFrame";
import { rows, record, text, money } from "@/features/admin/quotes/display";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Detalle cliente admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function AdminCustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ ordersPage?: string; quotesPage?: string }>;
}) {
  const loaded = await crmLoad(async () => {
    const { id } = await params;
    const query = (await searchParams) ?? {};
    const permissions = await crmSession();
    const customer = await crmRead(
      `/admin/customers/${encodeURIComponent(id)}`,
    );
    const orders = await crmRead(
      `/admin/customers/${encodeURIComponent(id)}/orders?page=${encodeURIComponent(query.ordersPage ?? "1")}&limit=20`,
    );
    const quotes = await crmRead(
      `/admin/customers/${encodeURIComponent(id)}/quotes?page=${encodeURIComponent(query.quotesPage ?? "1")}&limit=20`,
    );
    return { id, query, permissions, customer, orders, quotes };
  });
  if (!loaded.ok)
    return crmError(loaded.error, "Perfil de cliente", "/admin/clientes");
  const { id, query, permissions, customer, orders, quotes } = loaded.data;
  function pages(
    data: Record<string, unknown>,
    key: "ordersPage" | "quotesPage",
  ) {
    const meta = record(data.meta);
    const page = Number(meta.page),
      total = Number(meta.total),
      limit = Number(meta.limit);
    const href = (value: number) => {
      const params = new URLSearchParams({
        ordersPage: query.ordersPage ?? "1",
        quotesPage: query.quotesPage ?? "1",
        [key]: String(value),
      });
      return `/admin/clientes/${encodeURIComponent(id)}?${params}`;
    };
    return (
      <nav
        aria-label={
          key === "ordersPage"
            ? "Paginación de pedidos"
            : "Paginación de cotizaciones"
        }
        className="flex gap-4"
      >
        <span>
          Página {page} · {total} registros
        </span>
        {page > 1 && (
          <Link href={href(page - 1)} className="underline">
            Anterior
          </Link>
        )}
        {page * limit < total && (
          <Link href={href(page + 1)} className="underline">
            Siguiente
          </Link>
        )}
      </nav>
    );
  }
  return (
    <CrmFrame title="Perfil de cliente" backHref="/admin/clientes">
      <CustomerDetailScreen value={customer} />
      <CustomerActions id={id} permissions={permissions} />
      <section className="space-y-3 rounded-xl border border-white/15 p-4">
        <h2 className="font-semibold">Pedidos vinculados por correo</h2>
        {rows(orders.data).map((order) => (
          <article key={text(order.id)}>
            <p>
              {text(order.orderNumber)} · {text(order.status)} ·{" "}
              {money(order.grandTotal)}
            </p>
            {permissions.includes("orders.read") && (
              <Link
                href={`/admin/pedidos/${encodeURIComponent(text(order.id))}`}
                className="underline"
              >
                Ver pedido {text(order.orderNumber)}
              </Link>
            )}
          </article>
        ))}
        {!rows(orders.data).length && <p>No hay pedidos en esta página.</p>}
        {pages(orders, "ordersPage")}
      </section>
      <section className="space-y-3 rounded-xl border border-white/15 p-4">
        <h2 className="font-semibold">Cotizaciones del cliente</h2>
        {rows(quotes.data).map((quote) => (
          <article key={text(quote.id)}>
            <p>
              {text(quote.quoteNumber)} · {text(quote.status)} ·{" "}
              {money(quote.subtotal)}
            </p>
            {permissions.includes("quotes.read") && (
              <Link
                href={`/admin/cotizaciones/${encodeURIComponent(text(quote.id))}`}
                className="underline"
              >
                Ver cotización {text(quote.quoteNumber)}
              </Link>
            )}
          </article>
        ))}
        {!rows(quotes.data).length && (
          <p>No hay cotizaciones en esta página.</p>
        )}
        {pages(quotes, "quotesPage")}
      </section>
    </CrmFrame>
  );
}
