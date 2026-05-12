import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { KpiCard } from '@/components/ui/KpiCard';
import { adminModules, getAdminCatalogSnapshot } from '@/lib/admin/operations';
import { getAdminDashboardData } from '@/lib/admin/server-data';

const rangeOptions = [
  { label: 'Hoy', value: 'today' },
  { label: '7 días', value: '7d' },
  { label: '30 días', value: '30d' },
  { label: 'Mes actual', value: 'month' },
];

function money(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  return `$ ${amount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

function numberLabel(value: string | number | null | undefined) {
  return Number(value ?? 0).toLocaleString('es-CO');
}

function severityVariant(severity: string) {
  if (severity === 'critical') return 'danger' as const;
  if (severity === 'warning') return 'warning' as const;
  return 'info' as const;
}

export async function AdminDashboard({ range = '30d' }: { range?: string } = {}) {
  const [snapshot, dashboard] = await Promise.all([
    getAdminCatalogSnapshot(),
    getAdminDashboardData(range),
  ]);
  const operational = dashboard.operational;
  const executive = operational?.executive;
  const catalogHealth = operational?.catalogHealth;
  const orderHealth = operational?.orderHealth;
  const inventory = operational?.inventoryIntelligence;
  const recommendations = operational?.recommendations ?? [];
  const notifications = dashboard.notifications?.data ?? [];

  const kpis = [
    {
      title: 'Ventas del rango',
      value: money(dashboard.sales?.netRevenue ?? executive?.salesTotal ?? 0),
      context: dashboard.sales
        ? `${dashboard.sales.orderCount} órdenes reales en el periodo.`
        : 'Sesión requerida para leer ventas reales.',
    },
    {
      title: 'Órdenes totales',
      value: numberLabel(executive?.orderCount ?? dashboard.sales?.orderCount ?? 0),
      context: `${numberLabel(executive?.pendingOrders ?? 0)} pendientes, ${numberLabel(executive?.confirmedOrders ?? 0)} confirmadas.`,
    },
    {
      title: 'Ticket promedio',
      value: money(executive?.averageTicket ?? 0),
      context: 'Calculado desde grandTotal real de pedidos.',
    },
    {
      title: 'Productos vendibles',
      value: `${numberLabel(catalogHealth?.sellableProducts ?? 0)} / ${numberLabel(catalogHealth?.activeProducts ?? snapshot.products)}`,
      context: `${catalogHealth?.sellableRate ?? 0}% de salud comercial.`,
    },
    {
      title: 'Sin stock',
      value: numberLabel(executive?.productsWithoutStock ?? snapshot.productsWithoutPrice),
      context: 'Productos activos sin stock disponible.',
    },
    {
      title: 'Bajo stock',
      value: numberLabel(executive?.lowStockProducts ?? operational?.inventoryStatus.lowStock ?? 0),
      context: 'Stock disponible entre 1 y 2 unidades.',
    },
    {
      title: 'Pedidos sin guía',
      value: numberLabel(executive?.ordersPendingGuide ?? 0),
      context: 'No se inventa guía externa sin transportadora real.',
    },
    {
      title: 'Notificaciones pendientes',
      value: numberLabel(executive?.notificationsPending ?? 0),
      context: `${numberLabel(executive?.notificationsFailed ?? 0)} fallidas en local/test.`,
    },
  ];

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#121212_0%,#0b0b0b_100%)] p-5 shadow-elevated sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
              Dashboard ejecutivo
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-off-white)] sm:text-4xl">
              Centro operativo DistriTools JL
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
              Métricas reales de pedidos, catálogo, inventario, notificaciones, RBAC y auditoría. Si falta una fuente persistente, el panel lo marca como pendiente controlado.
            </p>
            <div className="flex flex-wrap gap-2" aria-label="Selector de rango">
              {rangeOptions.map((option) => (
                <Link
                  key={option.value}
                  href={`/admin/dashboard?range=${option.value}`}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    range === option.value
                      ? 'border-[var(--color-industrial-yellow)] bg-[var(--color-industrial-yellow)] text-[#050505]'
                      : 'border-white/10 bg-white/[0.04] text-[var(--color-off-white)] hover:border-[var(--color-industrial-yellow)]'
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['RBAC', 'Permisos server-side'],
              ['Auditoría', `${numberLabel(executive?.auditEventsCount ?? 0)} eventos`],
              ['Tracking', `${numberLabel(executive?.ordersWithInternalTracking ?? 0)} códigos internos`],
              ['Providers', 'Email/PSE/shipping productivos pendientes'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">{label}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--color-off-white)]">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {Object.keys(dashboard.errors).length ? (
        <section className="rounded-[1.5rem] border border-amber-300/25 bg-amber-300/[0.08] p-5">
          <h2 className="text-lg font-semibold text-amber-100">Fuentes admin pendientes</h2>
          <div className="mt-3 grid gap-2 text-sm text-amber-100/80">
            {Object.entries(dashboard.errors).map(([key, error]) => (
              <p key={key}>{key}: {error}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-off-white)]">Alertas operativas</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Reglas derivadas de datos reales. No hay recomendaciones inventadas.
              </p>
            </div>
            <Badge variant={recommendations.some((item) => item.severity === 'critical') ? 'danger' : 'info'}>
              {recommendations.length} alertas
            </Badge>
          </div>
          <div className="mt-5 grid gap-3">
            {recommendations.map((recommendation) => (
              <div key={recommendation.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--color-off-white)]">{recommendation.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{recommendation.action}</p>
                  </div>
                  <Badge variant={severityVariant(recommendation.severity)}>
                    {recommendation.count ?? recommendation.severity}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-xl font-semibold text-[var(--color-off-white)]">Salud del catálogo</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ['Sin variante', catalogHealth?.productsWithoutVariants ?? 0],
              ['Sin SKU', catalogHealth?.variantsWithoutSku ?? snapshot.productsWithoutSku],
              ['Sin precio', catalogHealth?.variantsWithoutPrice ?? snapshot.productsWithoutPrice],
              ['Sin imagen', catalogHealth?.productsWithoutImage ?? snapshot.productsWithoutImage],
              ['Stock saludable', inventory?.healthyStock ?? 0],
              ['Movimientos stock', executive?.stockMovementsCount ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-off-white)]">{numberLabel(value)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5 xl:col-span-2">
          <h2 className="text-xl font-semibold text-[var(--color-off-white)]">Top productos vendidos</h2>
          <div className="mt-4 overflow-x-auto">
            {(dashboard.topProducts?.data.length ?? 0) > 0 ? (
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="py-3 pr-4">Producto</th>
                    <th className="py-3 pr-4">Unidades</th>
                    <th className="py-3 pr-4">Ingreso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {dashboard.topProducts?.data.map((product) => (
                    <tr key={product.variantId}>
                      <td className="py-3 pr-4 font-semibold text-[var(--color-off-white)]">{product.variantName}</td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{product.quantitySold}</td>
                      <td className="py-3 pr-4 text-[var(--color-text-secondary)]">{money(product.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-6 text-sm text-[var(--color-text-secondary)]">
                Aún no hay ventas suficientes para este periodo.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5">
          <h2 className="text-xl font-semibold text-[var(--color-off-white)]">Notificaciones local/test</h2>
          <div className="mt-4 grid gap-3">
            {notifications.slice(0, 5).map((notification) => (
              <div key={notification.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--color-off-white)]">{notification.eventName}</p>
                  <Badge variant={notification.status === 'sent' ? 'success' : notification.status === 'failed' ? 'danger' : 'warning'}>
                    {notification.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{notification.subject ?? notification.channel}</p>
              </div>
            ))}
            {!notifications.length ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-[var(--color-text-secondary)]">
                No hay notificaciones para mostrar o la sesión no tiene permiso.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {adminModules.filter((module) => module.key !== 'dashboard').map((module) => (
          <Link
            key={module.key}
            href={module.href}
            className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition hover:border-[rgba(245,183,0,0.45)] hover:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-off-white)]">{module.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{module.description}</p>
              </div>
              <Badge variant={module.status === 'operational' ? 'success' : 'warning'}>
                {module.status === 'operational' ? 'Activo' : 'Riesgo'}
              </Badge>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
