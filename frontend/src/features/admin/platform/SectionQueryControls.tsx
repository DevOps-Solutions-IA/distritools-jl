import Link from 'next/link';
import type { AdminReadQuery } from '@/lib/admin/server-data';
import {
  getAdminModule,
  type AdminModuleKey,
} from '@/lib/admin/transport/navigation';
import { sectionQueryKeys, type paginationMeta } from './query';
const statusOptions = {
  pedidos: [
    'draft',
    'pending_payment',
    'paid',
    'packed',
    'shipped',
    'delivered',
    'cancelled',
    'refunded',
  ],
  cotizaciones: [
    'requested',
    'in_review',
    'quoted',
    'sent',
    'accepted',
    'rejected',
    'expired',
    'converted_to_order',
    'cancelled',
  ],
  pagos: ['pending', 'approved', 'rejected', 'expired', 'refunded'],
  envios: [
    'pending_provider',
    'pending_address',
    'pending_quote',
    'quoted',
    'pending_dispatch',
    'shipment_created',
    'guide_generated',
    'pickup_scheduled',
    'in_transit',
    'out_for_delivery',
    'delivered',
    'delivery_failed',
    'returned',
    'cancelled',
  ],
};
export function SectionQueryControls({
  moduleKey,
  query,
  meta,
}: {
  moduleKey: AdminModuleKey;
  query: AdminReadQuery;
  meta: ReturnType<typeof paginationMeta>;
}) {
  const keys = sectionQueryKeys[moduleKey];
  if (!keys) return null;
  const href = getAdminModule(moduleKey).href;
  const status =
    moduleKey === 'rastreo'
      ? statusOptions.envios
      : moduleKey in statusOptions
        ? statusOptions[moduleKey as keyof typeof statusOptions]
        : [];
  const fieldClass =
    'mt-1 w-full rounded-lg border border-white/20 bg-[var(--color-surface)] px-3 py-2';
  function pageHref(page: number) {
    const params = new URLSearchParams();
    for (const key of keys ?? []) if (query[key]) params.set(key, query[key]!);
    params.set('page', String(page));
    return `${href}?${params}`;
  }
  return (
    <section
      aria-label="Filtros del listado"
      className="space-y-3 rounded-xl border border-white/10 p-4"
    >
      <form
        action={href}
        method="GET"
        className="flex flex-wrap items-end gap-3"
      >
        {keys.includes('search') ? (
          <label className="min-w-48 flex-1 text-sm">
            Buscar
            <input
              name="search"
              defaultValue={query.search ?? ''}
              className={fieldClass}
            />
          </label>
        ) : null}
        {keys.includes('status') ? (
          <label className="text-sm">
            Estado
            <select
              name="status"
              defaultValue={query.status ?? ''}
              className={fieldClass}
            >
              <option value="">Todos</option>
              {status.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {['action', 'entityType', 'entityId', 'gateway']
          .filter((key) => keys.includes(key))
          .map((key) => (
            <label key={key} className="text-sm">
              {
                {
                  action: 'Acción',
                  entityType: 'Entidad',
                  entityId: 'ID de entidad',
                  gateway: 'Pasarela',
                }[key]
              }
              <input
                name={key}
                defaultValue={query[key] ?? ''}
                className={fieldClass}
              />
            </label>
          ))}
        {keys.includes('limit') ? (
          <label className="text-sm">
            Filas
            <select
              name="limit"
              defaultValue={query.limit ?? '20'}
              className={fieldClass}
            >
              {[20, 50, 100].map((limit) => (
                <option key={limit} value={limit}>
                  {limit}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {['direction', 'paymentStatus']
          .filter((key) => query[key] && keys.includes(key))
          .map((key) => (
            <input key={key} type="hidden" name={key} value={query[key]} />
          ))}
        <button
          type="submit"
          className="rounded-lg bg-[var(--color-industrial-yellow)] px-4 py-2 font-semibold text-black"
        >
          Aplicar filtros
        </button>
        <Link href={href} className="px-2 py-2 text-sm underline">
          Limpiar
        </Link>
      </form>
      {meta ? (
        <nav
          aria-label="Paginación"
          className="flex flex-wrap items-center gap-4 text-sm"
        >
          <span>
            Página {meta.page} · {meta.total} registros · {meta.limit} por
            página
          </span>
          {meta.page > 1 ? (
            <Link href={pageHref(meta.page - 1)} className="underline">
              Anterior
            </Link>
          ) : null}
          {meta.page * meta.limit < meta.total ? (
            <Link href={pageHref(meta.page + 1)} className="underline">
              Siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </section>
  );
}
