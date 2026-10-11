import { cookies } from 'next/headers';
import { env } from '@/config/env';
import { isDevAdminAuthDisabled } from '@/lib/admin/dev-auth-bypass';

import { adminFailure, adminContractFailure, AdminReadError, type AdminApiResult } from '@/lib/admin/transport/result';
export { AdminReadError, type AdminApiResult } from '@/lib/admin/transport/result';

interface PaginatedResponse<T> {
  data: T[];
  meta?: {
    page: number;
    limit: number;
    total: number;
  };
  operationalState?: {
    status: string;
    message: string;
  };
}

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  shippingCity: string;
  itemsCount: number;
  paymentStatus: string | null;
  paymentMethod: string | null;
  grandTotal: string;
  createdAt: string;
}

export interface AdminPaymentRow {
  id: string;
  orderNumber: string;
  gateway: string;
  status: string;
  amount: string;
  currency: string;
  providerReference: string | null;
  createdAt: string;
}

export interface AdminCustomerRow {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  ordersCount: number;
  totalSpent: string;
  lastOrderAt: string | null;
}

export interface AdminQuoteRow {
  id: string;
  quoteNumber: string;
  status: string;
  subtotal: string | null;
  currency: string;
  customer: { fullName: string; email: string | null; phone: string | null };
  items: Array<{ id: string; nameSnapshot: string; quantity: number; unitPrice: string | null }>;
  createdAt: string;
  updatedAt: string;
}

export interface AdminShipmentRow {
  id: string;
  orderId: string;
  orderNumber: string;
  provider: string;
  providerMode?: string;
  guideSource?: string;
  guideNotice?: string;
  productionState?: string;
  autoShippingStatus?: string | null;
  selectedCarrierReason?: string | null;
  labelStatus?: string | null;
  status: string;
  trackingNumber: string | null;
  routeNumber: string | null;
  quotedAmount: string | null;
  packageSnapshot?: Record<string, unknown> | null;
  customer: { fullName: string; email: string | null; phone: string | null };
  events: Array<{ id: string; status: string; description: string; occurredAt: string }>;
  createdAt: string;
}

export interface AdminUserRow {
  id: string;
  fullName: string;
  email: string;
  role: { name: string; slug: string } | null;
  isActive: boolean;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
}

export interface AdminRoleRow {
  id: string;
  name: string;
  slug: string;
  usersCount: number;
  permissions: Array<{ slug: string; module: string }>;
}

export interface AdminAuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  createdAt: string;
}

export interface AdminOperationalSnapshot {
  orders: PaginatedResponse<AdminOrderRow>;
  quotes: PaginatedResponse<AdminQuoteRow>;
  payments: PaginatedResponse<AdminPaymentRow>;
  shipments: PaginatedResponse<AdminShipmentRow>;
  customers: PaginatedResponse<AdminCustomerRow>;
  users: { data: AdminUserRow[] };
  roles: { data: AdminRoleRow[] };
  audit: { data: AdminAuditRow[] };
  notifications: { data: AdminNotificationRow[] };
  shippingCapabilities: Record<string, unknown>;
  inventoryOverview: { summary?: Record<string, unknown>; data: Array<Record<string, unknown>> };
  inventoryWarehouses: { data: Array<Record<string, unknown>> };
  inventoryHistory: { data: Array<Record<string, unknown>> };
  inventoryAlerts: { data: Array<Record<string, unknown>> };
  inventoryValuation: Record<string, unknown> & { data?: Array<Record<string, unknown>> };
  inventoryReservations: { data: Array<Record<string, unknown>> };
  priceHistory: { data: Array<Record<string, unknown>> };
  legal: { data: Array<Record<string, unknown>> };
  footer: Record<string, unknown>;
  settings: Record<string, unknown>;
  errors: Record<string, string>;
}

export interface CatalogSellability {
  sellable: boolean;
  status: string;
  blockers: string[];
  warnings: string[];
  requiredActions: string[];
}

export interface AdminCatalogProductRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  isActive: boolean;
  brand: { id: string; name: string; slug: string; isActive?: boolean } | null;
  category: { id: string; name: string; slug: string; isActive?: boolean; parentId?: string | null } | null;
  variantsCount: number;
  activeVariantsCount: number;
  primarySku: string | null;
  priceFrom: number | null;
  availableStock: number;
  hasApprovedImage: boolean;
  hasDimensions: boolean;
  sellability: CatalogSellability;
  updatedAt: string;
}

export interface AdminCatalogTaxonomyRow {
  id: string;
  parentId?: string | null;
  parent?: { id: string; name: string; slug: string } | null;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  productCount: number;
  sellableProductCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminCatalogPriceRow {
  id: string;
  productId: string;
  product: string;
  sku: string;
  variant: string;
  status: string;
  currentPrice: string;
  currency: string;
  availableStock: number;
  missingCost: boolean;
  updatedAt: string;
}

export interface AdminCatalogData {
  generatedAt: string;
  range: string;
  metrics: Record<string, number>;
  readiness: {
    products: string;
    brands: string;
    categories: string;
    inventory: string;
    prices: string;
    status: string;
    blockers: Array<Record<string, unknown>>;
    warnings: Array<Record<string, unknown>>;
  };
  products: AdminCatalogProductRow[];
  brands: AdminCatalogTaxonomyRow[];
  categories: AdminCatalogTaxonomyRow[];
  prices: AdminCatalogPriceRow[];
  priceHistory: Array<Record<string, unknown>>;
}

async function getAdminAccessToken() {
  try {
    const cookieStore = await cookies();
    return cookieStore.get('dt_admin_access')?.value ?? null;
  } catch {
    return null;
  }
}

export async function adminFetch<T>(path: string): Promise<AdminApiResult<T>> {
  const token = await getAdminAccessToken();
  const authDisabled = isDevAdminAuthDisabled();
  if (!token && !authDisabled) {
    return adminFailure(401);
  }

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}/api/v1${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
  } catch {
    return adminFailure(0);
  }
  let payload: unknown;
  try { payload = await response.json(); }
  catch { return response.ok ? adminContractFailure(response.status) : adminFailure(response.status); }
  if (!response.ok) return adminFailure(response.status, payload);
  if (payload === null || typeof payload !== 'object') return adminContractFailure(response.status);
  return { ok: true, kind: 'success', status: response.status, data: payload as T, error: null };
}

async function read<T>(path: string): Promise<T> {
  const result = await adminFetch<T>(path);
  if (!result.ok) throw new AdminReadError(result);
  return result.data;
}

export const operationalEndpoints = {
  orders: { path: '/admin/orders', query: ['page', 'limit', 'search', 'direction', 'status', 'paymentStatus'] },
  quotes: { path: '/admin/quotes', query: ['page', 'limit', 'search', 'direction', 'status'] },
  payments: { path: '/admin/payments', query: ['page', 'limit', 'direction', 'status', 'gateway'] },
  shipments: { path: '/admin/shipments', query: ['page', 'limit', 'search', 'direction', 'status'] },
  customers: { path: '/admin/customers', query: ['page', 'limit', 'search', 'direction'] },
  users: { path: '/admin/users', query: [] },
  roles: { path: '/admin/roles', query: [] },
  audit: { path: '/admin/audit', query: ['action', 'entityType', 'entityId', 'limit'] },
  notifications: { path: '/admin/notifications', query: ['limit'] },
  shippingCapabilities: { path: '/admin/shipping/capabilities', query: [] },
  inventoryOverview: { path: '/admin/inventory/overview', query: ['search'] },
  inventoryWarehouses: { path: '/admin/inventory/warehouses', query: [] },
  inventoryHistory: { path: '/admin/inventory/history', query: ['variantId', 'sku', 'warehouseId', 'movementType', 'referenceType', 'referenceId'] },
  inventoryAlerts: { path: '/admin/inventory/alerts', query: [] },
  inventoryValuation: { path: '/admin/inventory/valuation', query: [] },
  inventoryReservations: { path: '/admin/inventory/reservations', query: [] },
  priceHistory: { path: '/admin/prices/history', query: ['variantId'] },
  legal: { path: '/admin/content/legal', query: [] },
  footer: { path: '/admin/content/footer', query: [] },
  settings: { path: '/admin/settings', query: [] },
} as const;
export type OperationalKey = keyof typeof operationalEndpoints;
export type AdminReadQuery = Readonly<Record<string, string | undefined>>;

export function getAdminOperationalSnapshot(): Promise<AdminOperationalSnapshot>;
export function getAdminOperationalSnapshot<K extends OperationalKey>(keys: readonly K[], query?: AdminReadQuery): Promise<Pick<AdminOperationalSnapshot, K> & { errors: Record<string, string> }>;
export async function getAdminOperationalSnapshot(keys: readonly OperationalKey[] = Object.keys(operationalEndpoints) as OperationalKey[], query: AdminReadQuery = {}) {
  const entries = await Promise.all([...new Set(keys)].map(async (key) => {
    const endpoint = operationalEndpoints[key];
    const params = new URLSearchParams();
    for (const name of endpoint.query) if (query[name]) params.set(name, query[name]!);
    if (!('limit' in query) && (endpoint.query as readonly string[]).includes('limit')) params.set('limit', '20');
    const path = `${endpoint.path}${params.size ? `?${params}` : ''}`;
    const data = await read<AdminOperationalSnapshot[typeof key]>(path);
    const objectKeys: readonly OperationalKey[] = ['shippingCapabilities', 'inventoryValuation', 'footer', 'settings'];
    if (!objectKeys.includes(key) && (!data || typeof data !== 'object' || !('data' in data) || !Array.isArray(data.data))) {
      throw new AdminReadError(adminContractFailure(200));
    }
    return [key, data];
  }));
  return { ...Object.fromEntries(entries), errors: {} };
}

export interface AdminSalesSummary {
  orderCount: number;
  grossRevenue: string;
  discountTotal: string;
  netRevenue: string;
}

export interface AdminTopProduct {
  variantId: string;
  variantName: string;
  quantitySold: number;
  revenue: string;
}

export interface AdminOperationalMetrics {
  orderStatusCounts: Record<string, number>;
  paymentStatusCounts: Record<string, number>;
  inventoryStatus: { lowStock: number; totalTracked: number };
  executive?: {
    salesTotal: string;
    orderCount: number;
    pendingOrders: number;
    confirmedOrders: number;
    cancelledOrders: number;
    averageTicket: string;
    productsSold: number;
    activeProducts: number;
    activeVariants: number;
    productsWithoutStock: number;
    lowStockProducts: number;
    ordersPendingGuide: number;
    ordersWithInternalTracking: number;
    notificationsPending: number;
    notificationsFailed: number;
    customersCount: number;
    stockMovementsCount: number;
    auditEventsCount: number;
  };
  catalogHealth?: {
    totalProducts: number;
    activeProducts: number;
    sellableProducts: number;
    sellableRate: number;
    productsWithoutVariants: number;
    variantsWithoutSku: number;
    variantsWithoutPrice: number;
    productsWithoutStock: number;
    lowStockProducts: number;
    productsWithoutImage: number;
    incompleteProducts: Array<{
      id: string;
      name: string;
      slug: string;
      reasons: string[];
    }>;
  };
  orderHealth?: {
    totalOrders: number;
    ordersPendingGuide: number;
    ordersWithCarrierGuide: number;
    ordersWithInternalTracking: number;
    ordersByStatus: Record<string, number>;
    paymentsByStatus: Record<string, number>;
    paymentMethods: Record<string, number>;
    topCities: Array<{ city: string; count: number }>;
  };
  inventoryIntelligence?: {
    totalTracked: number;
    lowStock: number;
    withoutStock: number;
    healthyStock: number;
    topProducts: Array<{
      productId: string;
      name: string;
      brand: string | null;
      category: string | null;
      quantitySold: number;
      availableStock: number;
    }>;
    productsWithoutMovement: Array<{
      id: string;
      name: string;
      availableStock: number;
    }>;
  };
  conversion?: {
    persistedEvents: boolean;
    message: string;
    checkoutCompleted: number;
    checkoutFailed: number;
  };
  notifications?: {
    statusCounts: Record<string, number>;
  };
  recommendations?: Array<{
    severity: 'critical' | 'warning' | 'info';
    title: string;
    action: string;
    count?: number;
  }>;
  providerReadiness?: {
    email: string;
    payments: { cashOnDelivery: boolean; pse: string };
    shipping: { internalTracking: boolean; externalCarrier: string };
  };
}

export interface AdminNotificationRow {
  id: string;
  eventName: string;
  channel: string;
  recipient: string;
  subject: string | null;
  content: string;
  provider: string;
  status: string;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
  failedAt: string | null;
  createdAt: string;
}

export interface AdminDashboardKpiGroup {
  [key: string]: string | number;
}

export interface AdminDashboardChartPoint {
  label?: string;
  date?: string;
  value?: number;
  amount?: number;
  orders?: number;
  status?: string;
}

export interface AdminDashboardAlert {
  severity: 'critical' | 'warning' | 'info';
  module: string;
  message: string;
  actionLabel: string;
  href: string;
  status: string;
  createdAt: string;
}

export interface AdminDashboardQuickAction {
  label: string;
  href: string;
  permission: string;
  status: 'enabled' | 'disabled';
  reason: string | null;
}

export interface AdminDashboardModuleReadiness {
  key: string;
  label: string;
  status: string;
  blockers: string[];
  href: string;
}

export interface AdminDashboardData {
  range: { key: string; label: string; from: string; to: string };
  refreshedAt: string;
  readiness: {
    globalStatus: string;
    counts: Record<string, number>;
    modules: AdminDashboardModuleReadiness[];
    blockedModules: AdminDashboardModuleReadiness[];
  };
  kpis: {
    sales: {
      totalSalesAmount: string;
      orderCount: number;
      averageOrderValue: string;
      ordersToday: number;
      pendingOrders: number;
      confirmedOrders: number;
      cancelledOrders: number;
      ordersWithoutGuide: number;
      ordersWithAlerts: number;
    };
    payments: {
      pendingPayments: number;
      paidPayments: number;
      failedPayments: number;
      manualReviewPayments: number;
      codPendingReconciliation: number;
      paymentProviderStatus: string;
    };
    inventory: {
      activeProducts: number;
      activeVariants: number;
      sellableProducts: number;
      incompleteProducts: number;
      outOfStockProducts: number;
      lowStockProducts: number;
      missingCostProducts: number;
      healthyStockProducts: number;
      inventoryReadiness: string;
    };
    shipping: {
      shipmentsCreated: number;
      shipmentsPendingGuide: number;
      autoShippingFailed: number;
      shippingProviderStatus: string;
      mockGuidesCount: number;
      realGuidesCount: number;
      trackingPublicStatus: string;
    };
    customers: {
      totalCustomers: number;
      customersWithOrders: number;
      newCustomersInPeriod: number;
    };
    notifications: {
      queuedNotifications: number;
      sentNotifications: number;
      failedNotifications: number;
      pendingProviderNotifications: number;
    };
    system: {
      globalReadinessStatus: string;
      blockedModulesCount: number;
      partialModulesCount: number;
      readyModulesCount: number;
      productionBlockersCount: number;
      lastAuditEventsCount: number;
    };
  };
  charts: {
    salesByDay: AdminDashboardChartPoint[];
    ordersByStatus: AdminDashboardChartPoint[];
    paymentsByStatus: AdminDashboardChartPoint[];
    inventoryByStatus: AdminDashboardChartPoint[];
    readinessByStatus: AdminDashboardChartPoint[];
  };
  alerts: AdminDashboardAlert[];
  quickActions: AdminDashboardQuickAction[];
  recentActivity: {
    orders: Array<{
      orderNumber: string;
      status: string;
      paymentStatus: string;
      shippingStatus: string;
      total: string;
      createdAt: string;
      href: string;
    }>;
    payments: Array<{
      orderNumber: string;
      status: string;
      method: string;
      amount: string;
      createdAt: string;
      href: string;
    }>;
    audit: Array<{
      actor: string;
      module: string;
      action: string;
      createdAt: string;
      href: string;
    }>;
    failedNotifications: Array<{
      type: string;
      reference: string;
      reason: string;
      createdAt: string;
      href: string;
    }>;
  };
  errors: Record<string, string>;
}

export async function getAdminDashboardData(range: string = '30d'): Promise<AdminDashboardData> {
  const data = await read<AdminDashboardData>(`/admin/dashboard?range=${encodeURIComponent(range)}`);
  return { ...data, errors: {} };
}

export interface AdminReportsData {
  range: { key: string; label: string; from: string; to: string };
  filters: {
    status: string | null;
    module: string | null;
    paymentStatus: string | null;
    shippingStatus: string | null;
  };
  refreshedAt: string;
  summary: Record<string, string | number>;
  reports: {
    sales: {
      kpis: Record<string, string | number>;
      chart: Array<Record<string, string | number>>;
      rows: Array<Record<string, string | number>>;
      empty: boolean;
    };
    orders: {
      kpis: Record<string, string | number>;
      chart: Array<Record<string, string | number>>;
      rows: Array<Record<string, string | number>>;
      empty: boolean;
    };
    payments: {
      kpis: Record<string, string | number>;
      chart: Array<Record<string, string | number>>;
      rows: Array<Record<string, string | number>>;
      empty: boolean;
    };
    inventory: {
      kpis: Record<string, string | number>;
      chart: Array<Record<string, string | number>>;
      rows: Array<Record<string, string | number | string[] | boolean>>;
      empty: boolean;
    };
    shipping: {
      kpis: Record<string, string | number>;
      chart: Array<Record<string, string | number>>;
      rows: Array<Record<string, string | number>>;
      empty: boolean;
    };
    notifications: {
      kpis: Record<string, string | number>;
      chart: Array<Record<string, string | number>>;
      rows: Array<Record<string, string | number>>;
      empty: boolean;
    };
    readiness: {
      globalStatus: string;
      counts: Record<string, number>;
      modules: Array<{
        key: string;
        label: string;
        status: string;
        blockers: string[];
        productionImpact: string;
        nextAction: string;
        href: string;
      }>;
      chart: Array<Record<string, string | number>>;
    };
    audit: {
      kpis: Record<string, string | number>;
      chart: Array<Record<string, string | number>>;
      rows: Array<Record<string, string | number>>;
      empty: boolean;
    };
    blockers: Array<{
      module: string;
      status: string;
      blocker: string;
      nextAction: string;
      impact: string;
      href: string;
    }>;
  };
  export: {
    formats: string[];
    maxRows: number;
    standardExportContainsPii: boolean;
    piiExportRequires: string;
    enabled: boolean;
  };
  errors: Record<string, string>;
}

export async function getAdminReportsData(range: string = '30d'): Promise<AdminReportsData> {
  const data = await read<AdminReportsData>(`/admin/reports/summary?range=${encodeURIComponent(range)}`);
  return { ...data, errors: {} };
}

export async function getAdminCatalogOperationsData(range: string = '30d'): Promise<AdminCatalogData> {
  return read<AdminCatalogData>(`/admin/catalog/overview?range=${encodeURIComponent(range)}`);
}
