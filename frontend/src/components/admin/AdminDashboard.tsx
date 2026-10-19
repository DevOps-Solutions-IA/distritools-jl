import { AdminReadError } from '@/lib/admin/server-data';
import { AdminReadFailure } from '@/features/admin/platform/ReadFailure';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { KpiCard } from '@/components/ui/KpiCard';
import { controlAction, metric } from '@/features/admin/control/presentation';
import { ControlLink, ControlNavigation } from '@/features/admin/control/Navigation';
import styles from '@/features/admin/control/control.module.css';
import { assertDashboard } from '@/features/admin/control/contracts';
import {
  type AdminDashboardAlert,
  type AdminDashboardChartPoint,
  type AdminDashboardData,
  type AdminDashboardModuleReadiness,
  getAdminDashboardData,
} from '@/lib/admin/server-data';

const rangeOptions = [
  { label: 'Hoy', value: 'today' },
  { label: '7 días', value: '7d' },
  { label: '30 días', value: '30d' },
  { label: 'Mes actual', value: 'month' },
];

function money(value: string | number | null | undefined) {
  return metric(value, true);
}

function numberLabel(value: string | number | null | undefined) {
  return metric(value);
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusVariant(status: string) {
  if (['READY', 'approved', 'sent', 'delivered'].includes(status)) return 'success' as const;
  if (['NO_GO', 'BLOCKED_CONFIGURATION', 'BLOCKED_PROVIDER', 'failed', 'rejected', 'expired'].includes(status)) return 'danger' as const;
  if (['GO_WITH_RISKS', 'MOCK_ONLY', 'pending', 'pending_payment'].includes(status)) return 'warning' as const;
  if (['PARTIAL', 'pending_provider'].includes(status)) return 'info' as const;
  return 'neutral' as const;
}

function alertVariant(severity: AdminDashboardAlert['severity']) {
  if (severity === 'critical') return 'danger' as const;
  if (severity === 'warning') return 'warning' as const;
  return 'info' as const;
}

function maxValue(points: AdminDashboardChartPoint[]) {
  return Math.max(...points.map((point) => Number(point.value ?? point.amount ?? point.orders)).filter(Number.isFinite), 1);
}

function MiniBarChart({
  title,
  points,
  valueKey = 'value',
  format = numberLabel,
}: {
  title: string;
  points: AdminDashboardChartPoint[];
  valueKey?: 'value' | 'amount' | 'orders';
  format?: (value: string | number | null | undefined) => string;
}) {
  const max = maxValue(points);
  return (
    <div className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--color-off-white)]">{title}</h2>
        <Badge variant="neutral">{points.length ? `${points.length} puntos` : 'Sin datos'}</Badge>
      </div>
      <div className="mt-4 space-y-3">
        {points.length ? points.slice(-8).map((point) => {
          const rawValue = Number(point[valueKey]);
          const label = point.label ?? point.date ?? 'Sin etiqueta';
          return (
            <div key={`${label}-${rawValue}`} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="truncate text-[var(--color-text-secondary)]">{label}</span>
                <span className="font-semibold text-[var(--color-off-white)]">{format(point[valueKey])}</span>
              </div>
              {Number.isFinite(rawValue) ? <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[var(--color-industrial-yellow)]"
                  style={{ width: `${Math.max((rawValue / max) * 100, rawValue > 0 ? 6 : 0)}%` }}
                />
              </div> : null}
            </div>
          );
        }) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-[var(--color-text-secondary)]">
            Sin datos para este periodo.
          </div>
        )}
      </div>
    </div>
  );
}

function ReadinessCompact({ modules, counts }: { modules: AdminDashboardModuleReadiness[]; counts: Record<string, number> }) {
  return (
    <section className="rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--color-off-white)]">Readiness</h2>
        <ControlLink className="text-sm font-semibold text-[var(--color-industrial-yellow)]" href="/admin/configuracion">
          Ver configuración
        </ControlLink>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(counts).map(([status, count]) => (
          <Badge key={status} variant={statusVariant(status)}>
            {status}: {count}
          </Badge>
        ))}
      </div>
      <div className="mt-4 grid gap-2">
        {modules.slice(0, 10).map((module) => (
          <ControlLink
            key={module.key}
            href={module.href}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 transition hover:border-[var(--color-industrial-yellow)]"
          >
            <span className="text-sm font-semibold text-[var(--color-off-white)]">{module.label}</span>
            <Badge variant={statusVariant(module.status)}>{module.status}</Badge>
          </ControlLink>
        ))}
      </div>
    </section>
  );
}

function AlertsPanel({ alerts }: { alerts: AdminDashboardAlert[] }) {
  return (
    <section className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 id="control-alerts-heading" tabIndex={-1} className="text-base font-semibold text-[var(--color-off-white)]">Alertas críticas</h2>
        <Badge variant={alerts.some((alert) => alert.severity === 'critical') ? 'danger' : 'warning'}>
          {alerts.length}
        </Badge>
      </div>
      <div className="mt-4 space-y-3">
        {alerts.length ? alerts.map((alert) => (
          <div key={`${alert.module}-${alert.message}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-off-white)]">{alert.module}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{alert.message}</p>
              </div>
              <Badge variant={alertVariant(alert.severity)}>{alert.status}</Badge>
            </div>
            <ControlLink className="mt-3 inline-flex text-sm font-semibold text-[var(--color-industrial-yellow)]" href={controlAction(alert.href, alert.actionLabel).href}>
              {controlAction(alert.href, alert.actionLabel).label}
            </ControlLink>
          </div>
        )) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-[var(--color-text-secondary)]">
            Sin alertas accionables.
          </div>
        )}
      </div>
    </section>
  );
}

function QuickActions({ actions }: { actions: AdminDashboardData['quickActions'] }) {
  return (
    <section className="rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d] p-4">
      <h2 className="text-base font-semibold text-[var(--color-off-white)]">Acciones rápidas</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {actions.map((action) => (
          action.status === 'enabled' ? (
            <ControlLink
              key={action.label}
              href={controlAction(action.href, action.label).href}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-semibold text-[var(--color-off-white)] transition hover:border-[var(--color-industrial-yellow)]"
            >
              {controlAction(action.href, action.label).label}
            </ControlLink>
          ) : (
            <div
              key={action.label}
              className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-3 text-sm text-[var(--color-text-secondary)]"
              aria-disabled="true"
            >
              <span className="font-semibold text-[var(--color-off-white)]">{action.label}</span>
              <p className="mt-1 text-xs">{action.reason ?? 'Acción bloqueada.'}</p>
            </div>
          )
        ))}
      </div>
    </section>
  );
}

function persistedStatus(value: string) { return value === 'NO_DATA' ? 'Sin registro persistido' : value; }

function RecentActivity({ data }: { data: AdminDashboardData['recentActivity'] }) {
  const auditDenied = (data as typeof data & { auditAccessStatus?: 'GRANTED' | 'NO_PERMISSION' }).auditAccessStatus === 'NO_PERMISSION';
  const rows = [
    {
      title: 'Pedidos recientes',
      empty: 'Sin pedidos recientes.',
      items: data.orders.map((order) => ({
        key: order.orderNumber,
        main: order.orderNumber,
        meta: `${order.status} · ${persistedStatus(order.paymentStatus)} · ${persistedStatus(order.shippingStatus)}`,
        value: money(order.total),
        href: order.href,
      })),
    },
    {
      title: 'Pagos recientes',
      empty: 'Sin pagos recientes.',
      items: data.payments.map((payment) => ({
        key: `${payment.orderNumber}-${payment.createdAt}`,
        main: payment.orderNumber,
        meta: `${payment.method} · ${payment.status}`,
        value: money(payment.amount),
        href: payment.href,
      })),
    },
    {
      title: 'Auditoría reciente',
      empty: 'Sin auditoría reciente.',
      denied: auditDenied,
      items: (auditDenied ? [] : data.audit).map((entry) => ({
        key: `${entry.module}-${entry.action}-${entry.createdAt}`,
        main: entry.action,
        meta: `${entry.module} · ${entry.actor}`,
        value: dateLabel(entry.createdAt),
        href: entry.href,
      })),
    },
    {
      title: 'Notificaciones fallidas',
      empty: 'Sin fallas recientes.',
      items: data.failedNotifications.map((notification) => ({
        key: `${notification.reference}-${notification.createdAt}`,
        main: notification.type,
        meta: notification.reason,
        value: dateLabel(notification.createdAt),
        href: notification.href,
      })),
    },
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {rows.map((group) => (
        <div key={group.title} className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-[var(--color-off-white)]">{group.title}</h2>
            <Badge variant="neutral">{group.denied ? 'Sin permiso' : group.items.length}</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {group.denied ? <p role="alert" className="text-sm text-[var(--color-text-secondary)]">Requiere audit.read para consultar la auditoría reciente.</p> : group.items.length ? group.items.map((item) => (
              <ControlLink
                key={item.key}
                href={controlAction(item.href, item.main).href}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm transition hover:border-[var(--color-industrial-yellow)]"
              >
                <span>
                  <span className="block font-semibold text-[var(--color-off-white)]">{item.main}</span>
                  <span className="block max-w-[24rem] truncate text-xs text-[var(--color-text-secondary)]">{item.meta}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-[var(--color-industrial-yellow)]">{item.value}</span>
              </ControlLink>
            )) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-[var(--color-text-secondary)]">
                {group.empty}
              </div>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

export async function AdminDashboard({ range = '30d' }: { range?: string } = {}) {
  let dashboard: AdminDashboardData;
  try { dashboard = await getAdminDashboardData(range); assertDashboard(dashboard); }
  catch (error) {
    if (!(error instanceof AdminReadError)) throw error;
    return <section className={`${styles.root} space-y-4`}><h1 className="text-2xl font-semibold">Centro operativo</h1><AdminReadFailure result={error.result} /><p className="text-sm text-[var(--color-text-secondary)]">Las ventas del periodo, alertas críticas y readiness no están disponibles hasta recuperar la lectura administrativa.</p><Link href={`/admin/dashboard?range=${encodeURIComponent(range)}`} className="text-[var(--color-industrial-yellow)]">Reintentar lectura</Link></section>;
  }
  const activeRange = dashboard.range.key;
  const kpis = dashboard.kpis;
  const primaryKpis = [
    {
      title: 'Ventas del periodo',
      value: money(kpis.sales.totalSalesAmount),
      context: `${numberLabel(kpis.sales.orderCount)} órdenes · ticket ${money(kpis.sales.averageOrderValue)}`,
    },
    {
      title: 'Órdenes hoy',
      value: numberLabel(kpis.sales.ordersToday),
      context: `${numberLabel(kpis.sales.pendingOrders)} pendientes · ${numberLabel(kpis.sales.cancelledOrders)} canceladas`,
    },
    {
      title: 'Pagos pendientes',
      value: numberLabel(kpis.payments.pendingPayments),
      context: `${numberLabel(kpis.payments.codPendingReconciliation)} COD incluidos · ${kpis.payments.paymentProviderStatus}`,
      trend: kpis.payments.paymentProviderStatus,
    },
    {
      title: 'Pedidos sin guía',
      value: numberLabel(kpis.shipping.shipmentsPendingGuide),
      context: kpis.shipping.shippingProviderStatus,
      trend: kpis.shipping.shippingProviderStatus,
    },
    {
      title: 'Productos sin stock',
      value: numberLabel(kpis.inventory.outOfStockProducts),
      context: `${numberLabel(kpis.inventory.lowStockProducts)} bajo stock`,
    },
    {
      title: 'Readiness global',
      value: kpis.system.globalReadinessStatus,
      context: `${numberLabel(kpis.system.productionBlockersCount)} bloqueadores`,
      trend: kpis.system.globalReadinessStatus,
    },
  ];

  return (
    <ControlNavigation context="dashboard"><div className={`${styles.root} space-y-5`}>
      <section className="rounded-[1.75rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#111111_0%,#0b0b0b_100%)] p-5 shadow-elevated">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
              Centro operativo
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">
              Dashboard admin
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {dashboard.range.label} · actualizado {dateLabel(dashboard.refreshedAt)}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Fuente: pedidos, pagos, envíos y auditoría · {dateLabel(dashboard.range.from)} – {dateLabel(dashboard.range.to)}</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Inventario y notificaciones: estado actual. Ventas: valor de pedidos de todos los estados del periodo.</p>
            <nav aria-label="Acciones del dashboard" className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-[var(--color-industrial-yellow)]">
              <a href="#control-alerts-heading" className="rounded-lg border border-white/20 px-3 py-2 focus-visible:outline-2">Revisar alertas</a>
              <ControlLink href={`/admin/reportes?range=${encodeURIComponent(activeRange)}`} className="rounded-lg border border-white/20 px-3 py-2 focus-visible:outline-2">Abrir reportes</ControlLink>
              <ControlLink href="/admin/productos" className="rounded-lg border border-white/20 px-3 py-2 focus-visible:outline-2">Auditar catálogo</ControlLink>
            </nav>
          </div>
          <div className="flex flex-wrap items-center gap-2" aria-label="Selector de rango">
            {rangeOptions.map((option) => (
              <Link
                key={option.value}
                href={`/admin/dashboard?range=${option.value}`}
                className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                  activeRange === option.value
                    ? 'border-[var(--color-industrial-yellow)] bg-[var(--color-industrial-yellow)] text-[#050505]'
                    : 'border-white/10 bg-white/[0.04] text-[var(--color-off-white)] hover:border-[var(--color-industrial-yellow)]'
                }`}
              >
                {option.label}
              </Link>
            ))}
            <Link
              href={`/admin/dashboard?range=${activeRange}&refresh=${new Date(dashboard.refreshedAt).getTime()}`}
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-[var(--color-off-white)] transition hover:border-[var(--color-industrial-yellow)]"
            >
              Refrescar
            </Link>
            <Badge variant={statusVariant(dashboard.readiness.globalStatus)}>
              {dashboard.readiness.globalStatus}
            </Badge>
          </div>
        </div>
      </section>

      {Object.keys(dashboard.errors).length ? (
        <section className="rounded-[1.35rem] border border-amber-300/25 bg-amber-300/[0.08] p-4">
          <h2 className="text-base font-semibold text-amber-100">Fuentes pendientes</h2>
          <div className="mt-2 grid gap-1 text-sm text-amber-100/80">
            {Object.entries(dashboard.errors).map(([key, error]) => (
              <p key={key}>{key}: {error}</p>
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {primaryKpis.map((kpi) => (
          <div key={kpi.title} data-control-kpi><KpiCard {...kpi} /></div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <MiniBarChart
          title="Ventas por día"
          points={dashboard.charts.salesByDay}
          valueKey="amount"
          format={(value) => money(value)}
        />
        <MiniBarChart title="Pedidos por estado" points={dashboard.charts.ordersByStatus} />
        <MiniBarChart title="Pagos por estado" points={dashboard.charts.paymentsByStatus} />
        <MiniBarChart title="Inventario por estado" points={dashboard.charts.inventoryByStatus} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <AlertsPanel alerts={dashboard.alerts.map(alert => alert.module === 'Pagos' && alert.actionLabel === 'Ver pagos' ? { ...alert, message: `${kpis.payments.pendingPayments} pagos pendientes por conciliar (incluye COD).` } : alert)} />
        <div className="grid gap-4">
          <ReadinessCompact modules={dashboard.readiness.modules} counts={dashboard.readiness.counts} />
          <QuickActions actions={dashboard.quickActions.filter(action => !['Revisar alertas', 'Abrir reportes', 'Auditar catálogo'].includes(action.label))} />
        </div>
      </section>

      <RecentActivity data={dashboard.recentActivity} />
    </div></ControlNavigation>
  );
}
