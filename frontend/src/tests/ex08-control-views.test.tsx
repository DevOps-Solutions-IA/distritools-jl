import { fireEvent, render, screen, within } from '@testing-library/react';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminReports } from '@/components/admin/AdminReports';
import { AdminReadError } from '@/lib/admin/transport/result';
import { adminFailure } from '@/lib/admin/transport/result';

const readers = vi.hoisted(() => ({ dashboard: vi.fn(), reports: vi.fn(), filtered: vi.fn(), permissions: ['reports.read', 'catalog.read', 'products.read', 'orders.read', 'shipping.read'] }));
vi.mock('@/features/admin/shell/useAdminSession', () => ({ useAdminSession: () => ({ state: { status: 'success', user: { permissions: readers.permissions } }, retry: vi.fn() }) }));
vi.mock('@/lib/admin/server-data', async (original) => ({
  ...await original<typeof import('@/lib/admin/server-data')>(),
  getAdminDashboardData: readers.dashboard, getAdminReportsData: readers.reports, adminFetch: readers.filtered,
}));

const range = { key: '30d', label: 'Últimos 30 días', from: '2026-09-11T00:00:00Z', to: '2026-10-11T00:00:00Z' };
const group = { kpis: {}, chart: [], rows: [], empty: true };
function reportFixture() {
  return {
    range, refreshedAt: range.to, filters: { status: null, module: null, paymentStatus: null, shippingStatus: null },
    summary: { totalSalesAmount: 'NO_PERMISSION', averageOrderValue: 'NO_PERMISSION', orderCount: 0, pendingPayments: 0, ordersWithoutGuide: 0, nonSellableProducts: 0, productionBlockers: 0 },
    reports: { sales: group, payments: group, inventory: group, shipping: group, notifications: group, audit: group, orders: { ...group, rows: Array.from({ length: 25 }, (_, i) => ({ orderNumber: `ORD-${i + 1}`, status: 'paid', total: 'NO_PERMISSION', createdAt: range.to, href: `/admin/pedidos?search=ORD-${i + 1}` })) }, readiness: { globalStatus: 'READY', modules: [], chart: [] }, blockers: [] },
    export: { enabled: true, formats: ['csv', 'pdf'], maxRows: 1000, standardExportContainsPii: false, piiExportRequires: 'customers.read_sensitive' }, errors: {},
  };
}
function dashboardFixture() {
  return { range, refreshedAt: range.to, readiness: { globalStatus: 'READY', modules: [], counts: {} },
    kpis: { sales: { totalSalesAmount: 'NO_PERMISSION', averageOrderValue: 'NO_PERMISSION', orderCount: 0, ordersToday: 0, pendingOrders: 0, cancelledOrders: 0 }, payments: { pendingPayments: 2, codPendingReconciliation: 1, paymentProviderStatus: 'BLOCKED_PROVIDER' }, shipping: { shipmentsPendingGuide: 0, shippingProviderStatus: 'BLOCKED_PROVIDER' }, inventory: { outOfStockProducts: 0, lowStockProducts: 0 }, system: { globalReadinessStatus: 'READY', productionBlockersCount: 0 } },
    charts: { salesByDay: [{ date: '2026-10-10', amount: 'NO_PERMISSION' }], ordersByStatus: [], paymentsByStatus: [], inventoryByStatus: [] }, alerts: [], quickActions: [], recentActivity: { orders: [], payments: [], audit: [], failedNotifications: [] }, errors: {} };
}
beforeEach(() => { readers.permissions = ['reports.read', 'catalog.read', 'products.read', 'orders.read', 'shipping.read']; readers.dashboard.mockResolvedValue(dashboardFixture()); readers.reports.mockResolvedValue(reportFixture()); readers.filtered.mockResolvedValue({ ok: true, kind: 'success', data: reportFixture(), status: 200, error: null }); });
afterEach(() => vi.unstubAllGlobals());
it('ofrece las tres acciones nativas del dashboard con rango y ancla de foco real', async () => {
  const fixture = dashboardFixture(); fixture.range = { ...range, key: '7d', label: 'Últimos 7 días' };
  readers.dashboard.mockResolvedValueOnce(fixture);
  render(await AdminDashboard({ range: '7d' }));
  expect(screen.getByRole('link', { name: 'Abrir reportes' })).toHaveAttribute('href', '/admin/reportes?range=7d');
  expect(screen.getByRole('link', { name: 'Auditar catálogo' })).toHaveAttribute('href', '/admin/productos');
  const anchor = screen.getByRole('link', { name: 'Revisar alertas' });
  const heading = screen.getByRole('heading', { name: 'Alertas críticas' });
  expect(anchor).toHaveAttribute('href', `#${heading.id}`);
  expect(heading.id).not.toBe(''); expect(heading).toHaveAttribute('tabindex', '-1');
});
it('mantiene alertas disponibles pero no habilita reportes ni catálogo sin autoridad efectiva', async () => {
  readers.permissions = ['dashboard.read'];
  render(await AdminDashboard());
  expect(screen.getByRole('link', { name: 'Revisar alertas' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Abrir reportes' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Auditar catálogo' })).not.toBeInTheDocument();
});

it('indica descarga en curso y conserva un error RBAC sin descargar un archivo', async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
  render(await AdminReports());
  fireEvent.click(screen.getByRole('link', { name: 'Export CSV' }));
  expect(await screen.findByRole('link', { name: 'Descargando…' })).toHaveAttribute('aria-disabled', 'true');
  finish(Response.json({}, { status: 403 }));
  expect(await screen.findByRole('alert')).toHaveTextContent('No tiene permiso');
  expect(screen.getByRole('link', { name: 'Export CSV' })).toHaveAttribute('aria-disabled', 'false');
});

it('muestra restricciones financieras y nunca NaN ni una barra financiera inventada', async () => {
  render(await AdminDashboard());
  expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  expect(screen.getAllByText(/Sin permiso financiero/).length).toBeGreaterThan(0);
  expect(document.querySelector('[style*="NaN"]')).toBeNull();
});
it('cuenta COD dentro de pagos pendientes sin sumarlo por segunda vez', async () => {
  render(await AdminDashboard());
  const card = screen.getByText('Pagos pendientes').closest('article') ?? screen.getByText('Pagos pendientes').closest('[data-control-kpi]');
  expect(card).not.toBeNull();
  expect(within(card as HTMLElement).getByText('2')).toBeInTheDocument();
});
it('identifica fuente y ventana reales, incluyendo que inventario es una foto actual', async () => {
  render(await AdminReports());
  expect(screen.getByText(/Fuente: pedidos, pagos, envíos y auditoría/)).toBeInTheDocument();
  expect(screen.getByText(/Inventario y notificaciones: estado actual/)).toBeInTheDocument();
  expect(screen.getByText(/11\/09\/2026/)).toBeInTheDocument();
});
it('pagina la muestra devuelta y permite abrir el pedido de la segunda página', async () => {
  render(await AdminReports({ tab: 'orders', page: '2' }));
  expect(screen.queryByText('ORD-1')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'ORD-21' })).toHaveAttribute('href', '/admin/pedidos?search=ORD-21');
  expect(screen.getByText(/21–25 de 25/)).toBeInTheDocument();
  expect(screen.getByText(/muestra limitada/)).toBeInTheDocument();
});
it('mantiene filtros URL en consulta, tabs, paginación y exportación', async () => {
  render(await AdminReports({ tab: 'orders', status: 'paid', paymentStatus: 'approved', shippingStatus: 'delivered', module: 'order' }));
  expect(readers.filtered).toHaveBeenCalledWith('/admin/reports/summary?range=30d&status=paid&paymentStatus=approved&shippingStatus=delivered&module=order');
  expect(screen.getByRole('link', { name: 'Export CSV' }).getAttribute('href')).toContain('status=paid');
  expect(screen.getByRole('link', { name: 'Pagos' }).getAttribute('href')).toContain('paymentStatus=approved');
});
it('al limpiar la consulta restablece los campos y no reenvía filtros de una edición anterior', async () => {
  const query = { tab: 'orders', status: 'paid', paymentStatus: 'pending', shippingStatus: 'delivered', module: 'order' };
  const page = render(await AdminReports(query));
  fireEvent.change(screen.getByLabelText('Pago de pedido'), { target: { value: 'approved' } });
  fireEvent.change(screen.getByLabelText('Entidad de auditoría'), { target: { value: 'notification' } });
  // Rendering the same canonical query must preserve unsubmitted operator edits.
  page.rerender(await AdminReports({ ...query }));
  expect(screen.getByLabelText('Pago de pedido')).toHaveValue('approved');
  expect(screen.getByLabelText('Entidad de auditoría')).toHaveValue('notification');
  page.rerender(await AdminReports({ tab: 'orders' }));
  expect(screen.getByLabelText('Estado de pedido')).toHaveValue('');
  expect(screen.getByLabelText('Pago de pedido')).toHaveValue('');
  expect(screen.getByLabelText('Envío de pedido')).toHaveValue('');
  expect(screen.getByLabelText('Entidad de auditoría')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Envío de pedido'), { target: { value: 'delivered' } });
  const submission = new FormData(screen.getByRole('form', { name: 'Filtros de reportes' }) as HTMLFormElement);
  expect(submission.get('paymentStatus')).toBe(''); expect(submission.get('module')).toBe('');
  expect(submission.get('shippingStatus')).toBe('delivered');
});
it.each(['tab', 'range', 'page'])('restaura la consulta efectiva después de navegar por %s', async transition => {
  const query = { tab: 'orders', range: '30d', page: '1', paymentStatus: 'pending', module: 'order' };
  const page = render(await AdminReports(query));
  fireEvent.change(screen.getByLabelText('Pago de pedido'), { target: { value: 'approved' } });
  fireEvent.change(screen.getByLabelText('Entidad de auditoría'), { target: { value: 'notification' } });
  const next = { ...query, ...(transition === 'tab' ? { tab: 'payments' } : transition === 'range' ? { range: '7d' } : { page: '2' }) };
  const response = reportFixture(); response.range = { ...range, key: next.range };
  readers.filtered.mockResolvedValueOnce({ ok: true, kind: 'success', data: response, status: 200, error: null });
  page.rerender(await AdminReports(next));
  expect(screen.getByLabelText('Pago de pedido')).toHaveValue('pending');
  expect(screen.getByLabelText('Entidad de auditoría')).toHaveValue('order');
  const submission = new FormData(screen.getByRole('form', { name: 'Filtros de reportes' }) as HTMLFormElement);
  expect(submission.get('paymentStatus')).toBe('pending'); expect(submission.get('module')).toBe('order');
});
it('distingue un fallo de lectura de un reporte vacío y permite reintentar', async () => {
  readers.reports.mockRejectedValueOnce(new AdminReadError(adminFailure(503)));
  render(await AdminReports());
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo leer');
  expect(screen.queryByText('Sin datos para este reporte.')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Reintentar/ })).toBeInTheDocument();
});
it('una lectura restringida no ofrece exportación', async () => {
  const fixture = reportFixture(); fixture.export.enabled = false; readers.reports.mockResolvedValueOnce(fixture);
  render(await AdminReports());
  expect(screen.queryByRole('link', { name: 'Export CSV' })).not.toBeInTheDocument();
  expect(screen.getByText(/Export bloqueado/)).toBeInTheDocument();
});
it('una respuesta exitosa incompleta se presenta como fallo de contrato, no como cero', async () => {
  readers.reports.mockResolvedValueOnce({ range, summary: {} });
  render(await AdminReports());
  expect(screen.getByRole('alert')).toHaveTextContent('respuesta inválida');
  expect(screen.queryByText('Ventas')).not.toBeInTheDocument();
});
it('un dashboard incompleto se recupera con error visible', async () => {
  readers.dashboard.mockResolvedValueOnce({ range });
  render(await AdminDashboard());
  expect(screen.getByRole('alert')).toHaveTextContent('respuesta inválida');
  expect(screen.queryByText('Pagos pendientes')).not.toBeInTheDocument();
});
it.each(['null-row', 'bad-date', 'null-chart'])('rechaza un reporte anidado inválido: %s', async variant => {
  const fixture = reportFixture();
  if (variant === 'null-row') Object.assign(fixture.reports.orders, { rows: [null] });
  if (variant === 'bad-date') Object.assign(fixture.reports.orders.rows[0], { createdAt: 'not-a-date' });
  if (variant === 'null-chart') Object.assign(fixture.reports.orders, { chart: [null] });
  readers.reports.mockResolvedValueOnce(fixture);
  render(await AdminReports({ tab: 'orders' }));
  expect(screen.getByRole('alert')).toHaveTextContent('respuesta inválida');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});
it('un enlace de alerta malformado no interrumpe el dashboard ni se ofrece como destino', async () => {
  const fixture = dashboardFixture();
  Object.assign(fixture, { alerts: [{ module: 'Catálogo', message: 'Pendientes', href: null }] });
  readers.dashboard.mockResolvedValueOnce(fixture);
  render(await AdminDashboard());
  expect(screen.getByRole('alert')).toHaveTextContent('respuesta inválida');
});
it.each(['count-object', 'missing-destination', 'boolean-metric'])('rechaza datos consumidos inválidos del dashboard: %s', async variant => {
  const fixture = dashboardFixture();
  if (variant === 'count-object') Object.assign(fixture.readiness, { counts: { READY: { bad: true } } });
  if (variant === 'missing-destination') Object.assign(fixture.recentActivity, { orders: [{ orderNumber: 'CONTROL-1', status: 'paid', paymentStatus: 'approved', shippingStatus: 'delivered', total: 100, createdAt: range.to }] });
  if (variant === 'boolean-metric') Object.assign(fixture.kpis.inventory, { outOfStockProducts: false });
  readers.dashboard.mockResolvedValueOnce(fixture);
  render(await AdminDashboard());
  expect(screen.getByRole('alert')).toHaveTextContent('respuesta inválida');
  expect(screen.queryByText('Pagos pendientes')).not.toBeInTheDocument();
});
it('abre alertas en vistas reales sin filtros ignorados ni estados de envío inexistentes', async () => {
  const fixture = dashboardFixture();
  Object.assign(fixture, { alerts: [{ module: 'Catálogo', message: '1 productos incompletos.', actionLabel: 'Ver productos', href: '/admin/productos?filter=incomplete', status: 'PARTIAL', severity: 'info' }], quickActions: [{ label: 'Ver pedidos sin guía', href: '/admin/envios?status=pending_guide', status: 'enabled' }] });
  readers.dashboard.mockResolvedValueOnce(fixture);
  render(await AdminDashboard());
  expect(screen.getByRole('link', { name: 'Ver productos' })).toHaveAttribute('href', '/admin/reportes?tab=inventory');
  expect(screen.getByRole('link', { name: 'Ver envíos y pedidos sin guía' })).toHaveAttribute('href', '/admin/reportes?tab=shipping');
});
it('la alerta sin stock abre pendientes de inventario sin excluir causas por precedencia CAT', async () => {
  const fixture = dashboardFixture();
  Object.assign(fixture, { alerts: [{ module: 'Inventario', message: '3 productos sin stock.', actionLabel: 'Ver inventario', href: '/admin/inventario?filter=out_of_stock', status: 'NO_GO', severity: 'critical' }] });
  readers.dashboard.mockResolvedValueOnce(fixture);
  render(await AdminDashboard());
  expect(screen.getByRole('link', { name: 'Ver pendientes de inventario' })).toHaveAttribute('href', '/admin/reportes?tab=inventory');
  expect(screen.queryByRole('link', { name: 'Ver productos sin stock' })).not.toBeInTheDocument();
});
it('la acción heredada de reintento ofrece sólo consultar el estado real de envíos', async () => {
  readers.permissions = ['dashboard.read', 'shipping.read', 'shipping.retry'];
  const fixture = dashboardFixture();
  Object.assign(fixture, { quickActions: [{ label: 'Reintentar envío', href: '/admin/envios?action=retry', status: 'enabled' }] });
  readers.dashboard.mockResolvedValueOnce(fixture);
  render(await AdminDashboard());
  expect(screen.getByRole('link', { name: 'Ver estado de envíos' })).toHaveAttribute('href', '/admin/envios');
  expect(screen.queryByRole('link', { name: 'Reintentar envío' })).not.toBeInTheDocument();
});
it('no ofrece el análisis de pendientes sin permiso efectivo para reportes', async () => {
  readers.permissions = ['catalog.read', 'products.read']; const fixture = dashboardFixture();
  Object.assign(fixture, { alerts: [{ module: 'Catálogo', message: '1 productos incompletos.', actionLabel: 'Ver productos', href: '/admin/productos?filter=incomplete', status: 'PARTIAL', severity: 'info' }] });
  readers.dashboard.mockResolvedValueOnce(fixture); render(await AdminDashboard());
  expect(screen.queryByRole('link', { name: 'Ver productos' })).not.toBeInTheDocument();
  expect(within(screen.getByText('1 productos incompletos.').closest('section')!).getByText(/Requiere reports.read/)).toBeInTheDocument();
});
it('distingue auditoría denegada de una tabla vacía sin impedir audit.export independiente', async () => {
  const fixture = reportFixture();
  Object.assign(fixture.reports.audit, { accessStatus: 'NO_PERMISSION', kpis: { eventCount: 'NO_PERMISSION' } });
  readers.reports.mockResolvedValueOnce(fixture);
  render(await AdminReports({ tab: 'audit' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Requiere audit.read');
  expect(screen.queryByText('Sin datos para este reporte.')).not.toBeInTheDocument();
  expect(screen.queryByText(/0 filas/)).not.toBeInTheDocument();
  expect(screen.queryByText('Sin datos para este filtro.')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Export CSV' })).toBeInTheDocument();
});
it('el dashboard no convierte auditoría denegada en cero eventos', async () => {
  const fixture = dashboardFixture();
  Object.assign(fixture.recentActivity, { auditAccessStatus: 'NO_PERMISSION' });
  readers.dashboard.mockResolvedValueOnce(fixture);
  render(await AdminDashboard());
  const group = screen.getByRole('heading', { name: 'Auditoría reciente' }).parentElement!.parentElement!;
  expect(within(group).getByRole('alert')).toHaveTextContent('Requiere audit.read');
  expect(within(group).queryByText('0')).not.toBeInTheDocument();
  expect(within(group).queryByText('Sin auditoría reciente.')).not.toBeInTheDocument();
});
it('cada filtro de estado tiene una etiqueta exacta asociada a su campo editable', async () => {
  render(await AdminReports({ tab: 'orders' }));
  expect(screen.getByLabelText('Estado de pedido', { exact: true })).toHaveAttribute('name', 'status');
  expect(screen.getByLabelText('Pago de pedido', { exact: true })).toHaveAttribute('name', 'paymentStatus');
  expect(screen.getByLabelText('Envío de pedido', { exact: true })).toHaveAttribute('name', 'shippingStatus');
});
it('permite auditar todo el catálogo sin confundir pendientes con el estado CAT INCOMPLETE', async () => {
  render(await AdminReports({ tab: 'inventory' }));
  expect(screen.getByRole('link', { name: 'Auditar catálogo completo' })).toHaveAttribute('href', '/admin/productos');
});
it.each(['NO_DATA', 'NO_PERMISSION', 'NO_GUIDE_RECORDED'])('conserva el nombre válido %s y permite buscar el SKU literal NO_DATA', async product => {
  const fixture = reportFixture();
  Object.assign(fixture.reports.inventory, { rows: [{ product, sku: 'NO_DATA', availableStock: 0, status: 'PARTIAL', reasons: ['Sin stock'], missingCost: false }] });
  readers.reports.mockResolvedValueOnce(fixture);
  render(await AdminReports({ tab: 'inventory' }));
  const table = screen.getByRole('table');
  expect(within(table).getAllByRole('cell', { name: product })).toHaveLength(product === 'NO_DATA' ? 2 : 1);
  expect(screen.getByRole('link', { name: 'NO_DATA' })).toHaveAttribute('href', '/admin/productos?search=NO_DATA');
});
it('distingue el producto sin variantes de un SKU literal NO_DATA', async () => {
  const fixture = reportFixture();
  Object.assign(fixture.reports.inventory, { rows: [{ product: 'Producto sin variantes', sku: 'NO_DATA', availableStock: 0, status: 'PARTIAL', reasons: ['Sin variantes'], missingCost: false }] });
  readers.reports.mockResolvedValueOnce(fixture);
  render(await AdminReports({ tab: 'inventory' }));
  expect(screen.getByRole('cell', { name: 'Sin registro persistido' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'NO_DATA' })).not.toBeInTheDocument();
});
it('identifica ausencia persistida sin inventar estados pendientes', async () => {
  const fixture = reportFixture();
  Object.assign(fixture.reports.orders.rows[0], { paymentStatus: 'NO_DATA', shippingStatus: 'NO_DATA' });
  readers.reports.mockResolvedValueOnce(fixture);
  render(await AdminReports({ tab: 'orders' }));
  expect(screen.getAllByText('Sin registro persistido')).toHaveLength(2);
});
it('explica que el filtro relaciona cualquier pago y la tabla muestra el último registro', async () => {
  render(await AdminReports({ tab: 'orders', paymentStatus: 'pending' }));
  expect(screen.getByText(/cualquier registro relacionado/)).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Pago (último registro)' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Envío (último registro)' })).toBeInTheDocument();
});
it('identifica el pedido sin guía como un registro derivado y no un estado de transportadora', async () => {
  const fixture = reportFixture();
  Object.assign(fixture.reports.shipping, { rows: [{ orderNumber: 'ORD-1', status: 'NO_GUIDE_RECORDED', recordType: 'DERIVED_ORDER_WITHOUT_GUIDE' }] });
  readers.reports.mockResolvedValueOnce(fixture);
  render(await AdminReports({ tab: 'shipping' }));
  expect(screen.getByText('Pedido sin guía registrada (derivado)')).toBeInTheDocument();
});
it('el dashboard presenta ausencia de relaciones persistidas con texto explícito', async () => {
  const fixture = dashboardFixture();
  Object.assign(fixture.recentActivity, { orders: [{ orderNumber: 'CONTROL-ABSENT', status: 'paid', paymentStatus: 'NO_DATA', shippingStatus: 'NO_DATA', total: 100, createdAt: range.to, href: '/admin/pedidos?search=CONTROL-ABSENT' }] });
  readers.dashboard.mockResolvedValueOnce(fixture);
  render(await AdminDashboard());
  expect(screen.getByText('paid · Sin registro persistido · Sin registro persistido')).toBeInTheDocument();
  expect(screen.queryByText(/NO_DATA/)).not.toBeInTheDocument();
});
it('Auditar catálogo del dashboard abre todas las condiciones del catálogo', async () => {
  const fixture = dashboardFixture();
  Object.assign(fixture, { quickActions: [{ label: 'Auditar catálogo', href: '/admin/productos?filter=incomplete', status: 'enabled' }] });
  readers.dashboard.mockResolvedValueOnce(fixture);
  render(await AdminDashboard());
  expect(screen.getByRole('link', { name: 'Auditar catálogo' })).toHaveAttribute('href', '/admin/productos');
});
it('la actividad reciente conserva filtros de auditoría y fallas en destinos que los soportan', async () => {
  readers.permissions = ['reports.read', 'audit.read'];
  const fixture = dashboardFixture();
  Object.assign(fixture.recentActivity, { audit: [{ module: 'order', action: 'order.created', actor: 'sistema', createdAt: range.to, href: '/admin/auditoria?entity=order' }], failedNotifications: [{ reference: 'synthetic', type: 'order.paid', reason: 'failed', createdAt: range.to, href: '/admin/notificaciones?status=failed' }] });
  readers.dashboard.mockResolvedValueOnce(fixture); render(await AdminDashboard());
  expect(screen.getByRole('link', { name: /order.created/ })).toHaveAttribute('href', '/admin/auditoria?entityType=order');
  expect(screen.getByRole('link', { name: /order.paid/ })).toHaveAttribute('href', '/admin/reportes?tab=notifications');
});
