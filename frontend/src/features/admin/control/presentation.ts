export function metric(value: unknown, currency = false): string {
  if (value === 'NO_PERMISSION') return 'Sin permiso financiero';
  if (value === null || value === undefined || value === '' || value === 'NO_DATA') return 'Sin datos';
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Sin datos';
  return `${currency ? '$ ' : ''}${number.toLocaleString('es-CO', { maximumFractionDigits: currency ? 0 : 2 })}`;
}
export const orderStatuses = ['draft', 'pending_payment', 'paid', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded'];
export const paymentStatuses = ['pending', 'approved', 'rejected', 'expired', 'refunded'];
export const shipmentStatuses = ['pending_provider', 'pending_address', 'pending_quote', 'quoted', 'pending_dispatch', 'shipment_created', 'guide_generated', 'pickup_scheduled', 'in_transit', 'out_for_delivery', 'delivered', 'delivery_failed', 'returned', 'cancelled'];
export const reportTypes = ['summary', 'sales', 'orders', 'payments', 'inventory', 'shipping', 'notifications', 'readiness', 'audit'];
export const ranges = ['today', '7d', '30d', 'month'];
export function controlAction(href: string, label: string): { href: string; label: string } {
  if (href === '/admin/productos?filter=incomplete') return { href: label === 'Auditar catálogo' ? '/admin/productos' : '/admin/reportes?tab=inventory', label };
  if (href === '/admin/inventario?filter=out_of_stock') return { href: '/admin/reportes?tab=inventory', label: 'Ver pendientes de inventario' };
  if (href === '/admin/envios?action=retry') return { href: '/admin/envios', label: 'Ver estado de envíos' };
  if (href === '/admin/inventario?filter=low_stock' || href === '/admin/inventario?tab=valuation') return { href: '/admin/reportes?tab=inventory', label: 'Ver pendientes de inventario' };
  if (href === '/admin/notificaciones?status=failed') return { href: '/admin/reportes?tab=notifications', label: 'Ver fallidas' };
  if (href.startsWith('/admin/auditoria?entity=')) return { href: `/admin/auditoria?entityType=${encodeURIComponent(new URL(href, 'http://control.invalid').searchParams.get('entity') ?? '')}`, label };
  if (href === '/admin/envios?status=pending_guide' || label === 'Ver pedidos sin guía') return { href: '/admin/reportes?tab=shipping', label: 'Ver envíos y pedidos sin guía' };
  return { href, label };
}
export type ReportFilters = { status?: string; paymentStatus?: string; shippingStatus?: string; module?: string };
export function reportParams(range: string, filters: ReportFilters) {
  const params = new URLSearchParams({ range });
  for (const key of ['status', 'paymentStatus', 'shippingStatus', 'module'] as const) if (filters[key]) params.set(key, filters[key]);
  return params;
}
export function reportHref(range: string, tab: string, filters: ReportFilters, page?: number) {
  const params = reportParams(range, filters); params.set('tab', tab);
  if (page && page > 1) params.set('page', String(page));
  return `/admin/reportes?${params}`;
}
export function exportHref(range: string, type: string, format: 'csv' | 'pdf', filters: ReportFilters) {
  const params = new URLSearchParams({ range, type, format });
  for (const [key, value] of reportParams(range, filters)) if (key !== 'range') params.set(key, value);
  return `/api/admin/reports/export?${params}`;
}
export const reportColumns: Record<string, Array<[string, string]>> = {
  sales: [['product', 'Producto'], ['sku', 'SKU'], ['quantity', 'Unidades'], ['revenue', 'Valor de pedidos']],
  orders: [['orderNumber', 'Pedido'], ['status', 'Estado'], ['paymentStatus', 'Pago (último registro)'], ['shippingStatus', 'Envío (último registro)'], ['total', 'Total'], ['createdAt', 'Creado']],
  payments: [['orderNumber', 'Pedido'], ['status', 'Estado'], ['method', 'Método'], ['amount', 'Importe'], ['createdAt', 'Creado']],
  inventory: [['product', 'Producto'], ['sku', 'SKU'], ['availableStock', 'Disponible'], ['status', 'Estado'], ['reasons', 'Pendientes'], ['missingCost', 'Costo faltante']],
  shipping: [['orderNumber', 'Pedido'], ['provider', 'Proveedor'], ['guideSource', 'Origen guía'], ['trackingNumber', 'Guía'], ['status', 'Estado']],
  notifications: [['eventName', 'Evento'], ['status', 'Estado'], ['provider', 'Proveedor'], ['attempts', 'Intentos'], ['lastError', 'Error'], ['createdAt', 'Creado']],
  readiness: [['label', 'Módulo'], ['status', 'Estado'], ['blockers', 'Bloqueadores'], ['nextAction', 'Siguiente acción']],
  audit: [['actor', 'Actor protegido'], ['action', 'Acción'], ['entityType', 'Entidad'], ['entityId', 'Referencia'], ['createdAt', 'Creado']],
};
