import { AdminReadError } from '@/lib/admin/server-data';
import { AdminReadFailure } from '@/features/admin/platform/ReadFailure';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { KpiCard } from '@/components/ui/KpiCard';
import { type AdminReportsData, getAdminReportsData } from '@/lib/admin/server-data';

const rangeOptions = [
  { label: 'Hoy', value: 'today' },
  { label: '7 días', value: '7d' },
  { label: '30 días', value: '30d' },
  { label: 'Mes actual', value: 'month' },
];

const reportTabs = [
  { key: 'sales', label: 'Ventas' },
  { key: 'orders', label: 'Pedidos' },
  { key: 'payments', label: 'Pagos' },
  { key: 'inventory', label: 'Inventario' },
  { key: 'shipping', label: 'Envíos' },
  { key: 'notifications', label: 'Notificaciones' },
  { key: 'readiness', label: 'Readiness' },
  { key: 'audit', label: 'Auditoría' },
];

function money(value: unknown) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return String(value ?? 'NO_DATA');
  return `$ ${amount.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;
}

function label(value: unknown) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return String(value ?? 'Sin datos');
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusVariant(status: string) {
  if (['READY', 'approved', 'sent', 'delivered'].includes(status)) return 'success' as const;
  if (['NO_GO', 'BLOCKED_PROVIDER', 'BLOCKED_CONFIGURATION', 'failed', 'rejected', 'expired'].includes(status)) return 'danger' as const;
  if (['GO_WITH_RISKS', 'MOCK_ONLY', 'pending', 'pending_payment'].includes(status)) return 'warning' as const;
  if (['PARTIAL', 'MARGIN_UNAVAILABLE_MISSING_COSTS'].includes(status)) return 'info' as const;
  return 'neutral' as const;
}

function MiniBars({ title, data }: { title: string; data: Array<Record<string, string | number>> }) {
  const max = Math.max(...data.map((item) => Number(item.value ?? item.amount ?? item.orders ?? 0)), 1);
  return (
    <section className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--color-off-white)]">{title}</h2>
        <Badge variant="neutral">{data.length ? `${data.length} puntos` : 'Sin datos'}</Badge>
      </div>
      <div className="mt-4 space-y-3">
        {data.length ? data.slice(0, 8).map((item) => {
          const value = Number(item.value ?? item.amount ?? item.orders ?? 0);
          const itemLabel = String(item.label ?? item.date ?? item.status ?? 'Sin etiqueta');
          return (
            <div key={`${itemLabel}-${value}`} className="space-y-1">
              <div className="flex justify-between gap-3 text-xs">
                <span className="truncate text-[var(--color-text-secondary)]">{itemLabel}</span>
                <span className="font-semibold text-[var(--color-off-white)]">{Number.isFinite(value) ? value.toLocaleString('es-CO') : 'NO_DATA'}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[var(--color-industrial-yellow)]"
                  style={{ width: `${Math.max((value / max) * 100, value > 0 ? 6 : 0)}%` }}
                />
              </div>
            </div>
          );
        }) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-[var(--color-text-secondary)]">
            Sin datos para este filtro.
          </div>
        )}
      </div>
    </section>
  );
}

function ReportTable({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  columns: string[];
}) {
  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
        <h2 className="text-base font-semibold text-[var(--color-off-white)]">{title}</h2>
        <Badge variant="neutral">{rows.length}</Badge>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="px-4 py-3">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {rows.slice(0, 12).map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column} className="max-w-[18rem] truncate px-4 py-3 text-[var(--color-text-secondary)]">
                      {label(row[column])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-4">
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-[var(--color-text-secondary)]">
            Sin datos para este reporte.
          </div>
        </div>
      )}
    </section>
  );
}

function exportHref(range: string, type: string, format: 'csv' | 'pdf') {
  return `/api/admin/reports/export?range=${encodeURIComponent(range)}&type=${encodeURIComponent(type)}&format=${format}`;
}

export async function AdminReports({ range = '30d', tab = 'sales' }: { range?: string; tab?: string } = {}) {
  let reports: AdminReportsData;
  try { reports = await getAdminReportsData(range); }
  catch (error) {
    if (!(error instanceof AdminReadError)) throw error;
    return <section className="space-y-4"><h1 className="text-2xl font-semibold">Reportes admin</h1><AdminReadFailure result={error.result} /><p className="text-sm text-[var(--color-text-secondary)]">Los reportes no están disponibles hasta recuperar la lectura administrativa.</p></section>;
  }
  const activeTab = reportTabs.some((item) => item.key === tab) ? tab : 'sales';
  const activeReport = reports.reports[activeTab as keyof typeof reports.reports];
  const activeRows = 'rows' in activeReport ? activeReport.rows as Array<Record<string, unknown>> : reports.reports.readiness.modules as Array<Record<string, unknown>>;
  const activeChart = 'chart' in activeReport ? activeReport.chart as Array<Record<string, string | number>> : reports.reports.readiness.chart;

  const kpis = [
    { title: 'Ventas', value: money(reports.summary.totalSalesAmount), context: `${label(reports.summary.orderCount)} órdenes` },
    { title: 'Ticket promedio', value: money(reports.summary.averageOrderValue), context: String(reports.summary.marginStatus ?? 'NO_DATA') },
    { title: 'Pagos pendientes', value: label(reports.summary.pendingPayments), context: 'COD/manual incluido' },
    { title: 'Pedidos sin guía', value: label(reports.summary.ordersWithoutGuide), context: 'No inventa guía externa' },
    { title: 'No vendibles', value: label(reports.summary.nonSellableProducts), context: 'Stock, precio, SKU o costo' },
    { title: 'Bloqueadores', value: label(reports.summary.productionBlockers), context: reports.reports.readiness.globalStatus },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-[1.75rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#111111_0%,#0b0b0b_100%)] p-5 shadow-elevated">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">Reportes reales</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">Reportes admin</h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              {reports.range.label} · actualizado {dateLabel(reports.refreshedAt)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {rangeOptions.map((option) => (
              <Link
                key={option.value}
                href={`/admin/reportes?range=${option.value}&tab=${activeTab}`}
                className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${
                  reports.range.key === option.value
                    ? 'border-[var(--color-industrial-yellow)] bg-[var(--color-industrial-yellow)] text-[#050505]'
                    : 'border-white/10 bg-white/[0.04] text-[var(--color-off-white)] hover:border-[var(--color-industrial-yellow)]'
                }`}
              >
                {option.label}
              </Link>
            ))}
            {reports.export.enabled ? (
              <>
                <Link
                  href={exportHref(reports.range.key, activeTab, 'csv')}
                  className="rounded-full border border-[var(--color-industrial-yellow)] px-3 py-2 text-sm font-semibold text-[var(--color-industrial-yellow)]"
                >
                  Export CSV
                </Link>
                <Link
                  href={exportHref(reports.range.key, activeTab, 'pdf')}
                  className="rounded-full border border-[var(--color-industrial-yellow)] px-3 py-2 text-sm font-semibold text-[var(--color-industrial-yellow)]"
                >
                  Export PDF
                </Link>
              </>
            ) : (
              <span className="rounded-full border border-white/10 px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                Export bloqueado: reports.export
              </span>
            )}
            <Badge variant={statusVariant(reports.reports.readiness.globalStatus)}>
              {reports.reports.readiness.globalStatus}
            </Badge>
          </div>
        </div>
      </section>

      {Object.keys(reports.errors).length ? (
        <section className="rounded-[1.35rem] border border-amber-300/25 bg-amber-300/[0.08] p-4 text-sm text-amber-100">
          {Object.entries(reports.errors).map(([key, value]) => <p key={key}>{key}: {value}</p>)}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {kpis.map((kpi) => <KpiCard key={kpi.title} {...kpi} />)}
      </section>

      <nav className="flex gap-2 overflow-x-auto rounded-[1.25rem] border border-[var(--color-border)] bg-[#0d0d0d] p-2" aria-label="Reportes">
        {reportTabs.map((item) => (
          <Link
            key={item.key}
            href={`/admin/reportes?range=${reports.range.key}&tab=${item.key}`}
            className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${
              activeTab === item.key
                ? 'bg-[var(--color-industrial-yellow)] text-[#050505]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-off-white)]'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <MiniBars title={`Gráfica: ${reportTabs.find((item) => item.key === activeTab)?.label ?? activeTab}`} data={activeChart} />
        <section className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-[var(--color-off-white)]">Bloqueadores de producción</h2>
            <Badge variant={reports.reports.blockers.length ? 'danger' : 'success'}>{reports.reports.blockers.length}</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {reports.reports.blockers.length ? reports.reports.blockers.map((blocker) => (
              <Link key={`${blocker.module}-${blocker.status}`} href={blocker.href} className="block rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-[var(--color-off-white)]">{blocker.module}</span>
                  <Badge variant={statusVariant(blocker.status)}>{blocker.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{blocker.blocker}</p>
                <p className="mt-1 text-xs text-[var(--color-industrial-yellow)]">{blocker.nextAction}</p>
              </Link>
            )) : (
              <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm text-[var(--color-text-secondary)]">
                Sin bloqueadores de producción.
              </div>
            )}
          </div>
        </section>
      </section>

      <ReportTable
        title={`Tabla: ${reportTabs.find((item) => item.key === activeTab)?.label ?? activeTab}`}
        rows={activeRows}
        columns={Object.keys(activeRows[0] ?? { estado: 'Sin datos' }).slice(0, 7)}
      />
    </div>
  );
}
