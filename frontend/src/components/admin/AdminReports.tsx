import { AdminReadError, type AdminReportsData } from '@/lib/admin/server-data';
import { AdminReadFailure } from '@/features/admin/platform/ReadFailure';
import { readReports } from '@/features/admin/control/readers';
import { exportHref, metric, orderStatuses, paymentStatuses, reportColumns, reportHref, shipmentStatuses, type ReportFilters } from '@/features/admin/control/presentation';
import { ExportLink } from '@/features/admin/control/ExportLink';
import { ControlLink, ControlNavigation } from '@/features/admin/control/Navigation';
import styles from '@/features/admin/control/control.module.css';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { KpiCard } from '@/components/ui/KpiCard';

const rangeOptions = [{ label: 'Hoy', value: 'today' }, { label: '7 días', value: '7d' }, { label: '30 días', value: '30d' }, { label: 'Mes actual', value: 'month' }];
const reportTabs = [{ key: 'sales', label: 'Ventas' }, { key: 'orders', label: 'Pedidos' }, { key: 'payments', label: 'Pagos' }, { key: 'inventory', label: 'Inventario' }, { key: 'shipping', label: 'Envíos' }, { key: 'notifications', label: 'Notificaciones' }, { key: 'readiness', label: 'Readiness' }, { key: 'audit', label: 'Auditoría' }];
function dateLabel(value: string) { return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(value)); }
function label(value: unknown) {
  if (value == null) return 'Sin datos';
  if (Array.isArray(value)) return value.join(', ') || 'Sin pendientes';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return String(value);
}
function statusVariant(status: string) {
  if (['READY', 'approved', 'sent', 'delivered'].includes(status)) return 'success' as const;
  if (['NO_GO', 'BLOCKED_PROVIDER', 'BLOCKED_CONFIGURATION', 'failed', 'rejected', 'expired'].includes(status)) return 'danger' as const;
  if (['GO_WITH_RISKS', 'MOCK_ONLY', 'pending', 'pending_payment'].includes(status)) return 'warning' as const;
  if (['PARTIAL', 'MARGIN_UNAVAILABLE_MISSING_COSTS'].includes(status)) return 'info' as const;
  return 'neutral' as const;
}
function MiniBars({ title, data }: { title: string; data: Array<Record<string, string | number>> }) {
  const raw = (item: Record<string, string | number>) => item.value ?? item.amount ?? item.orders;
  const max = Math.max(...data.map(item => Number(raw(item))).filter(Number.isFinite), 1);
  return <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
    <h2 className="text-base font-semibold">{title}</h2>
    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{data.length ? `Últimos ${Math.min(data.length, 8)} de ${data.length} puntos` : 'Sin datos para este filtro.'}</p>
    <div className="mt-4 space-y-3">{data.slice(-8).map((item, index) => { const value = Number(raw(item)); return <div key={index}><div className="flex justify-between gap-3 text-xs"><span>{item.label ?? item.date ?? item.status}</span><span>{metric(raw(item))}</span></div>{Number.isFinite(value) ? <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/8"><div className="h-full bg-[var(--color-industrial-yellow)]" style={{ width: `${Math.max(value / max * 100, value > 0 ? 6 : 0)}%` }} /></div> : null}</div>; })}</div>
  </section>;
}
function FilterSelect({ name, title, value, values }: { name: string; title: string; value?: string; values: string[] }) {
  const id = `control-report-${name}`;
  return <div className="grid gap-1 text-sm"><label htmlFor={id}>{title}</label><select id={id} name={name} defaultValue={value ?? ''} className="min-h-10 max-w-full rounded-lg border border-white/20 bg-[#111] p-2"><option value="">Todos</option>{values.map(status => <option key={status} value={status}>{status}</option>)}</select></div>;
}
export type ControlReportQuery = ReportFilters & { range?: string; tab?: string; page?: string };
export async function AdminReports({ range = '30d', tab = 'sales', page = '1', ...filters }: ControlReportQuery = {}) {
  let reports: AdminReportsData;
  try { reports = await readReports(range, filters); }
  catch (error) {
    if (!(error instanceof AdminReadError)) throw error;
    return <section className={`${styles.root} space-y-4`}><h1 className="text-2xl font-semibold">Reportes admin</h1><AdminReadFailure result={error.result} /><p>Los reportes no están disponibles hasta recuperar la lectura administrativa.</p><Link href={reportHref(range, tab, filters)} className="text-[var(--color-industrial-yellow)]">Reintentar lectura</Link><Link className="ml-4 text-[var(--color-industrial-yellow)]" href="/admin/reportes">Limpiar filtros</Link></section>;
  }
  const activeTab = reportTabs.some(item => item.key === tab) ? tab : 'sales';
  const activeReport = reports.reports[activeTab as keyof typeof reports.reports];
  const auditDenied = activeTab === 'audit' && (reports.reports.audit as typeof reports.reports.audit & { accessStatus?: 'GRANTED' | 'NO_PERMISSION' }).accessStatus === 'NO_PERMISSION';
  const activeRows = auditDenied ? [] : 'rows' in activeReport ? activeReport.rows as Array<Record<string, unknown>> : reports.reports.readiness.modules as Array<Record<string, unknown>>;
  const activeChart = 'chart' in activeReport ? activeReport.chart as Array<Record<string, string | number>> : reports.reports.readiness.chart;
  const countPages = Math.max(1, Math.ceil(activeRows.length / 20));
  const activePage = Math.min(countPages, /^[1-9]\d{0,5}$/.test(page) ? Number(page) : 1);
  const start = (activePage - 1) * 20;
  const visibleRows = activeRows.slice(start, start + 20);
  const title = reportTabs.find(item => item.key === activeTab)!.label;
  const columns = reportColumns[activeTab];
  const kpis = [
    { title: 'Ventas', value: metric(reports.summary.totalSalesAmount, true), context: `${label(reports.summary.orderCount)} órdenes de todos los estados` },
    { title: 'Ticket promedio', value: metric(reports.summary.averageOrderValue, true), context: String(reports.summary.marginStatus ?? 'NO_DATA') },
    { title: 'Pagos pendientes', value: metric(reports.summary.pendingPayments), context: 'Incluye COD pendiente' },
    { title: 'Pedidos sin guía', value: metric(reports.summary.ordersWithoutGuide), context: 'Pedidos del periodo y filtros' },
    { title: 'Registros con pendientes', value: metric(reports.summary.nonSellableProducts), context: 'Variantes y productos sin variantes; estado actual' },
    { title: 'Bloqueadores', value: metric(reports.summary.productionBlockers), context: reports.reports.readiness.globalStatus },
  ];
  return <ControlNavigation context="reports"><div className={`${styles.root} space-y-5`}>
    <section className="rounded-3xl border border-[var(--color-border)] bg-[#0d0d0d] p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-industrial-yellow)]">Centro operativo</p>
      <h1 className="mt-2 text-3xl font-semibold">Reportes admin</h1>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{reports.range.label} · actualizado {dateLabel(reports.refreshedAt)} UTC</p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Fuente: pedidos, pagos, envíos y auditoría · {dateLabel(reports.range.from)} – {dateLabel(reports.range.to)} UTC</p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Inventario y notificaciones: estado actual. Ventas: valor de pedidos de todos los estados del periodo.</p>
      <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Selector de rango">{rangeOptions.map(option => <Link key={option.value} href={reportHref(option.value, activeTab, filters)} aria-current={reports.range.key === option.value ? 'page' : undefined} className={`rounded-full border px-3 py-2 text-sm font-semibold ${reports.range.key === option.value ? 'bg-[var(--color-industrial-yellow)] text-black' : 'border-white/20'}`}>{option.label}</Link>)}<Link href={`${reportHref(reports.range.key, activeTab, filters, activePage)}&refresh=${encodeURIComponent(reports.refreshedAt)}`} className="rounded-full border border-white/20 px-3 py-2 text-sm">Refrescar</Link></div>
      <div className="mt-3 flex flex-wrap items-center gap-2">{reports.export.enabled ? <><ExportLink href={exportHref(reports.range.key, activeTab, 'csv', filters)} format="csv" /><ExportLink href={exportHref(reports.range.key, activeTab, 'pdf', filters)} format="pdf" /></> : <span>Export bloqueado: reports.export</span>}<Badge variant={statusVariant(reports.reports.readiness.globalStatus)}>{reports.reports.readiness.globalStatus}</Badge></div>
      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Exportación sin datos personales completos. CSV: muestra del servicio{activeTab === 'sales' ? ' agregada por día' : ''}; PDF: primeras 18 filas, hasta 190 caracteres por línea. No incluye el historial completo.</p>
    </section>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{kpis.map(kpi => <KpiCard key={kpi.title} {...kpi} />)}</section>
    <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-[var(--color-border)] bg-[#0d0d0d] p-2" aria-label="Reportes">{reportTabs.map(item => <Link key={item.key} href={reportHref(reports.range.key, item.key, filters)} aria-current={activeTab === item.key ? 'page' : undefined} className={`shrink-0 rounded-full px-3 py-2 text-sm font-semibold ${activeTab === item.key ? 'bg-[var(--color-industrial-yellow)] text-black' : ''}`}>{item.label}</Link>)}</nav>
    {activeTab === 'inventory' ? <ControlLink href="/admin/productos" className="inline-flex rounded-xl border border-white/20 px-4 py-2 text-sm text-[var(--color-industrial-yellow)]">Auditar catálogo completo</ControlLink> : null}
    <form key={reportHref(reports.range.key, activeTab, filters, activePage)} action="/admin/reportes" className="grid gap-3 rounded-2xl border border-white/15 p-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Filtros de reportes">
      <input type="hidden" name="range" value={reports.range.key} /><input type="hidden" name="tab" value={activeTab} />
      <FilterSelect name="status" title="Estado de pedido" value={filters.status} values={orderStatuses} />
      <FilterSelect name="paymentStatus" title="Pago de pedido" value={filters.paymentStatus} values={paymentStatuses} />
      <FilterSelect name="shippingStatus" title="Envío de pedido" value={filters.shippingStatus} values={shipmentStatuses} />
      <label className="grid gap-1 text-sm">Entidad de auditoría<input name="module" defaultValue={filters.module ?? ''} maxLength={80} placeholder="Todas" className="min-h-10 rounded-lg border border-white/20 bg-[#111] p-2" /></label>
      <p className="text-xs text-[var(--color-text-secondary)] sm:col-span-2 lg:col-span-4">Filtros de pago y envío: cualquier registro relacionado del pedido. La tabla de pedidos muestra el último registro persistido. Pagos: sólo registros del estado elegido. Envíos: registros del periodo y del estado elegido; sin filtro de envío incluye pedidos sin guía como filas derivadas. Entidad: sólo auditoría. Inventario y notificaciones conservan su alcance actual.</p>
      <button type="submit" className="min-h-10 rounded-lg bg-[var(--color-industrial-yellow)] px-4 py-2 font-semibold text-black">Aplicar filtros</button><Link href={reportHref(reports.range.key, activeTab, {})} className="inline-flex min-h-10 items-center px-4 py-2 text-sm">Limpiar filtros</Link>
    </form>
    <section className="grid gap-4 xl:grid-cols-2">{auditDenied ? <section className="rounded-2xl border border-white/15 p-4"><h2 className="font-semibold">Gráfica: {title}</h2><p className="mt-2 text-sm">Auditoría no disponible para este permiso.</p></section> : <MiniBars title={`Gráfica: ${title}`} data={activeChart} />}<section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h2 className="font-semibold">Bloqueadores de producción</h2><div className="mt-4 space-y-3">{reports.reports.blockers.length ? reports.reports.blockers.map(blocker => <ControlLink key={`${blocker.module}-${blocker.status}`} href={blocker.href} className="block rounded-xl border border-white/10 p-3"><span className="font-semibold">{blocker.module}</span><Badge className="ml-2" variant={statusVariant(blocker.status)}>{blocker.status}</Badge><p className="mt-2 text-sm">{blocker.blocker}</p><p className="mt-1 text-xs text-[var(--color-industrial-yellow)]">{blocker.nextAction}</p></ControlLink>) : <p>Sin bloqueadores de producción.</p>}</div></section></section>
    <section className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[#0d0d0d]">
      <div className="border-b border-white/10 p-4"><h2 className="font-semibold">Tabla: {title}</h2>{auditDenied ? <p role="alert" className="mt-2 text-sm">Requiere audit.read para consultar filas de auditoría. La exportación conserva su permiso audit.export independiente.</p> : <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{activeRows.length ? `${start + 1}–${start + visibleRows.length} de ${activeRows.length}` : '0 filas'} · muestra limitada del servicio ({activeTab === 'sales' ? '20 productos principales' : activeTab === 'readiness' ? 'módulos configurados' : 'hasta 80 filas'}). Los KPI conservan su alcance indicado.</p>}</div>
      {auditDenied ? null : visibleRows.length ? <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`Resultados: ${title}`}><table className="min-w-full text-left text-sm"><thead><tr>{columns.map(([key, name]) => <th key={key} scope="col" className="px-4 py-3">{name}</th>)}</tr></thead><tbody className="divide-y divide-white/10">{visibleRows.map((row, index) => <tr key={index}>{columns.map(([key]) => {
        const absentVariant = activeTab === 'inventory' && row.sku === 'NO_DATA' && Array.isArray(row.reasons) && row.reasons.includes('Sin variantes');
        const href = absentVariant && key === 'sku' ? null : typeof row.href === 'string' && row.href.startsWith('/admin/') ? row.href : activeTab === 'inventory' && key === 'sku' ? `/admin/productos?search=${encodeURIComponent(String(row.sku))}` : null;
        const value = ['total', 'amount', 'revenue'].includes(key) ? metric(row[key], true)
          : (['paymentStatus', 'shippingStatus'].includes(key) && row[key] === 'NO_DATA') || (key === 'sku' && absentVariant) ? 'Sin registro persistido'
          : activeTab === 'shipping' && key === 'status' && row.status === 'NO_GUIDE_RECORDED' && row.recordType === 'DERIVED_ORDER_WITHOUT_GUIDE' ? 'Pedido sin guía registrada (derivado)'
          : key === 'createdAt' && typeof row[key] === 'string' ? `${dateLabel(row[key])} UTC` : label(row[key]);
        return <td key={key} className="min-w-32 max-w-72 px-4 py-3 align-top">{href && ['orderNumber', 'label', 'sku'].includes(key) ? <ControlLink href={href} className="font-semibold text-[var(--color-industrial-yellow)]">{value}</ControlLink> : value}</td>;
      })}</tr>)}</tbody></table></div> : <p className="p-5 text-sm">Sin datos para este reporte.</p>}
      {countPages > 1 ? <nav aria-label="Paginación de muestra" className="flex flex-wrap items-center gap-4 border-t border-white/10 p-4">{activePage > 1 ? <Link href={reportHref(reports.range.key, activeTab, filters, activePage - 1)} className="text-[var(--color-industrial-yellow)]">Anterior</Link> : null}<span className="text-sm">Página {activePage} de {countPages}</span>{activePage < countPages ? <Link href={reportHref(reports.range.key, activeTab, filters, activePage + 1)} className="text-[var(--color-industrial-yellow)]">Siguiente</Link> : null}</nav> : null}
    </section>
  </div></ControlNavigation>;
}
