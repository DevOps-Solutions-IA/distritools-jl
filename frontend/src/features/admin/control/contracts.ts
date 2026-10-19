import type { AdminDashboardData, AdminReportsData } from '@/lib/admin/server-data';
import { AdminReadError, adminContractFailure } from '@/lib/admin/transport/result';

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function hasArrays(value: unknown, keys: string[]) { const data = object(value); return Boolean(data && keys.every(key => Array.isArray(data[key]))); }
function rangeValid(value: unknown) {
  const range = object(value);
  return Boolean(range && typeof range.key === 'string' && typeof range.label === 'string' && typeof range.from === 'string' && typeof range.to === 'string' && Number.isFinite(Date.parse(range.from)) && Number.isFinite(Date.parse(range.to)));
}
function validRefresh(value: unknown) { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function displayRecord(value: unknown): boolean {
  const data = object(value);
  return Boolean(data && Object.entries(data).every(([key, field]) => {
    if (key === 'createdAt') return validRefresh(field);
    return field == null || typeof field === 'string' || typeof field === 'boolean' ||
      (typeof field === 'number' && Number.isFinite(field)) ||
      (Array.isArray(field) && field.every(item => typeof item === 'string'));
  }));
}
function records(value: unknown): boolean { return Array.isArray(value) && value.every(displayRecord); }
function stringFields(value: unknown, keys: string[]): boolean {
  const data = object(value);
  return Boolean(data && keys.every(key => typeof data[key] === 'string'));
}
function metricFields(value: unknown, keys: string[]): boolean {
  const data = object(value);
  return Boolean(data && keys.every(key => {
    const field = data[key];
    return (typeof field === 'number' && Number.isFinite(field)) ||
      (typeof field === 'string' && (['NO_PERMISSION', 'NO_DATA'].includes(field) || /^-?\d+(?:\.\d+)?$/.test(field)));
  }));
}
function invalid(): never { throw new AdminReadError(adminContractFailure(200)); }
export function assertDashboard(value: unknown): asserts value is AdminDashboardData {
  const data = object(value); const kpis = object(data?.kpis); const readiness = object(data?.readiness);
  if (!data || !rangeValid(data.range) || !validRefresh(data.refreshedAt) || !kpis || !readiness || !hasArrays(readiness, ['modules']) || !object(readiness.counts) || typeof readiness.globalStatus !== 'string' ||
    !['sales', 'payments', 'inventory', 'shipping', 'system'].every(key => object(kpis[key])) ||
    !hasArrays(data.charts, ['salesByDay', 'ordersByStatus', 'paymentsByStatus', 'inventoryByStatus']) ||
    !hasArrays(data.recentActivity, ['orders', 'payments', 'audit', 'failedNotifications']) || !hasArrays(data, ['alerts', 'quickActions'])) invalid();
  const charts = object(data.charts)!; const recent = object(data.recentActivity)!;
  const recentFields: Record<string, string[]> = {
    orders: ['orderNumber', 'status', 'paymentStatus', 'shippingStatus', 'createdAt', 'href'],
    payments: ['orderNumber', 'status', 'method', 'createdAt', 'href'],
    audit: ['module', 'action', 'actor', 'createdAt', 'href'],
    failedNotifications: ['reference', 'type', 'reason', 'createdAt', 'href'],
  };
  if (!Object.values(charts).every(records) ||
    !Object.entries(recentFields).every(([key, fields]) => records(recent[key]) && (recent[key] as unknown[]).every(item => stringFields(item, fields))) ||
    !Object.values(readiness.counts as Record<string, unknown>).every(count => typeof count === 'number' && Number.isSafeInteger(count) && count >= 0) ||
    !metricFields(kpis.sales, ['totalSalesAmount', 'averageOrderValue', 'orderCount', 'ordersToday', 'pendingOrders', 'cancelledOrders']) ||
    !metricFields(kpis.payments, ['pendingPayments', 'codPendingReconciliation']) || !stringFields(kpis.payments, ['paymentProviderStatus']) ||
    !metricFields(kpis.shipping, ['shipmentsPendingGuide']) || !stringFields(kpis.shipping, ['shippingProviderStatus']) ||
    !metricFields(kpis.inventory, ['outOfStockProducts', 'lowStockProducts']) ||
    !metricFields(kpis.system, ['productionBlockersCount']) || !stringFields(kpis.system, ['globalReadinessStatus']) ||
    !object(data.errors) ||
    !(data.alerts as unknown[]).every(item => displayRecord(item) && stringFields(item, ['href', 'module', 'message', 'actionLabel', 'status', 'severity'])) ||
    !(data.quickActions as unknown[]).every(item => displayRecord(item) && stringFields(item, ['href', 'label', 'status'])) ||
    !(readiness.modules as unknown[]).every(item => displayRecord(item) && stringFields(item, ['key', 'label', 'href', 'status']))) invalid();
}
export function assertReports(value: unknown): asserts value is AdminReportsData {
  const data = object(value); const reports = object(data?.reports); const exportData = object(data?.export); const readiness = object(reports?.readiness);
  if (!data || !rangeValid(data.range) || !validRefresh(data.refreshedAt) || !object(data.summary) || !reports || !exportData || typeof exportData.enabled !== 'boolean' || !readiness || typeof readiness.globalStatus !== 'string' || !hasArrays(readiness, ['modules', 'chart']) || !hasArrays(reports, ['blockers']) ||
    !['sales', 'orders', 'payments', 'inventory', 'shipping', 'notifications', 'audit'].every(key => hasArrays(reports[key], ['rows', 'chart']))) invalid();
  if (!['sales', 'orders', 'payments', 'inventory', 'shipping', 'notifications', 'audit'].every(key => {
    const group = object(reports[key])!; return records(group.rows) && records(group.chart);
  }) || !metricFields(data.summary, ['totalSalesAmount', 'averageOrderValue', 'orderCount', 'pendingPayments', 'ordersWithoutGuide', 'nonSellableProducts', 'productionBlockers']) ||
    !records(readiness.modules) || !records(readiness.chart) ||
    !(reports.blockers as unknown[]).every(item => displayRecord(item) && stringFields(item, ['module', 'status', 'href', 'blocker', 'nextAction']))) invalid();
}
