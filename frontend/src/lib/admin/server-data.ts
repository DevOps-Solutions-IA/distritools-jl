import { cookies } from 'next/headers';
import { env } from '@/config/env';

interface AdminApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: string | null;
}

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

function isAdminAuthDisabled() {
  return process.env.APP_ENV !== 'production' && process.env.ADMIN_AUTH_DISABLED === 'true';
}

export async function adminFetch<T>(path: string): Promise<AdminApiResult<T>> {
  const token = await getAdminAccessToken();
  const authDisabled = isAdminAuthDisabled();
  if (!token && !authDisabled) {
    return { ok: false, status: 401, data: null, error: 'Sesión administrativa requerida.' };
  }

  const response = await fetch(`${env.apiBaseUrl}/api/v1${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  });
  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: null,
      error: payload.message ?? 'No se pudo leer el módulo admin.',
    };
  }

  return { ok: true, status: response.status, data: payload, error: null };
}

async function read<T>(path: string, fallback: T, errors: Record<string, string>, key: string) {
  const result = await adminFetch<T>(path);
  if (!result.ok || !result.data) {
    errors[key] = result.error ?? `Error ${result.status}`;
    return fallback;
  }
  return result.data;
}

export async function getAdminOperationalSnapshot(): Promise<AdminOperationalSnapshot> {
  const errors: Record<string, string> = {};
  const emptyPaginated = { data: [], meta: { page: 1, limit: 20, total: 0 } };

  const [
    orders,
    quotes,
    payments,
    shipments,
    customers,
    users,
    roles,
    audit,
    notifications,
    shippingCapabilities,
    inventoryOverview,
    inventoryWarehouses,
    inventoryHistory,
    inventoryAlerts,
    inventoryValuation,
    inventoryReservations,
    priceHistory,
    legal,
    footer,
    settings,
  ] = await Promise.all([
    read('/admin/orders?limit=50', emptyPaginated, errors, 'orders'),
    read('/admin/quotes?limit=50', emptyPaginated, errors, 'quotes'),
    read('/admin/payments?limit=50', emptyPaginated, errors, 'payments'),
    read('/admin/shipments?limit=50', emptyPaginated, errors, 'shipments'),
    read('/admin/customers?limit=50', emptyPaginated, errors, 'customers'),
    read('/admin/users', { data: [] }, errors, 'users'),
    read('/admin/roles', { data: [] }, errors, 'roles'),
    read('/admin/audit?limit=50', { data: [] }, errors, 'audit'),
    read('/admin/notifications?limit=50', { data: [] }, errors, 'notifications'),
    read('/admin/shipping/capabilities', {}, errors, 'shippingCapabilities'),
    read('/admin/inventory/overview', { data: [], summary: {} }, errors, 'inventoryOverview'),
    read('/admin/inventory/warehouses', { data: [] }, errors, 'inventoryWarehouses'),
    read('/admin/inventory/history', { data: [] }, errors, 'inventoryHistory'),
    read('/admin/inventory/alerts', { data: [] }, errors, 'inventoryAlerts'),
    read('/admin/inventory/valuation', { data: [] }, errors, 'inventoryValuation'),
    read('/admin/inventory/reservations', { data: [] }, errors, 'inventoryReservations'),
    read('/admin/prices/history', { data: [] }, errors, 'priceHistory'),
    read('/admin/content/legal', { data: [] }, errors, 'legal'),
    read('/admin/content/footer', {}, errors, 'footer'),
    read('/admin/settings', {}, errors, 'settings'),
  ]);

  return {
    orders,
    quotes,
    payments,
    shipments,
    customers,
    users,
    roles,
    audit,
    notifications,
    shippingCapabilities,
    inventoryOverview,
    inventoryWarehouses,
    inventoryHistory,
    inventoryAlerts,
    inventoryValuation,
    inventoryReservations,
    priceHistory,
    legal,
    footer,
    settings,
    errors,
  };
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

function emptyDashboard(range: string): AdminDashboardData {
  const now = new Date().toISOString();
  return {
    range: { key: range, label: 'Sin datos', from: now, to: now },
    refreshedAt: now,
    readiness: { globalStatus: 'NO_GO', counts: {}, modules: [], blockedModules: [] },
    kpis: {
      sales: {
        totalSalesAmount: '0.00',
        orderCount: 0,
        averageOrderValue: '0.00',
        ordersToday: 0,
        pendingOrders: 0,
        confirmedOrders: 0,
        cancelledOrders: 0,
        ordersWithoutGuide: 0,
        ordersWithAlerts: 0,
      },
      payments: {
        pendingPayments: 0,
        paidPayments: 0,
        failedPayments: 0,
        manualReviewPayments: 0,
        codPendingReconciliation: 0,
        paymentProviderStatus: 'NO_DATA',
      },
      inventory: {
        activeProducts: 0,
        activeVariants: 0,
        sellableProducts: 0,
        incompleteProducts: 0,
        outOfStockProducts: 0,
        lowStockProducts: 0,
        missingCostProducts: 0,
        healthyStockProducts: 0,
        inventoryReadiness: 'NO_DATA',
      },
      shipping: {
        shipmentsCreated: 0,
        shipmentsPendingGuide: 0,
        autoShippingFailed: 0,
        shippingProviderStatus: 'NO_DATA',
        mockGuidesCount: 0,
        realGuidesCount: 0,
        trackingPublicStatus: 'NO_DATA',
      },
      customers: {
        totalCustomers: 0,
        customersWithOrders: 0,
        newCustomersInPeriod: 0,
      },
      notifications: {
        queuedNotifications: 0,
        sentNotifications: 0,
        failedNotifications: 0,
        pendingProviderNotifications: 0,
      },
      system: {
        globalReadinessStatus: 'NO_GO',
        blockedModulesCount: 0,
        partialModulesCount: 0,
        readyModulesCount: 0,
        productionBlockersCount: 0,
        lastAuditEventsCount: 0,
      },
    },
    charts: {
      salesByDay: [],
      ordersByStatus: [],
      paymentsByStatus: [],
      inventoryByStatus: [],
      readinessByStatus: [],
    },
    alerts: [],
    quickActions: [],
    recentActivity: { orders: [], payments: [], audit: [], failedNotifications: [] },
    errors: {},
  };
}

export async function getAdminDashboardData(range: string = '30d'): Promise<AdminDashboardData> {
  const errors: Record<string, string> = {};
  const data = await read<AdminDashboardData | null>(
    `/admin/dashboard?range=${encodeURIComponent(range)}`,
    null,
    errors,
    'dashboard',
  );
  if (!data) {
    return { ...emptyDashboard(range), errors };
  }
  return { ...data, errors };
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

function emptyReports(range: string): AdminReportsData {
  const now = new Date().toISOString();
  const emptyReport = { kpis: {}, chart: [], rows: [], empty: true };
  return {
    range: { key: range, label: 'Sin datos', from: now, to: now },
    filters: { status: null, module: null, paymentStatus: null, shippingStatus: null },
    refreshedAt: now,
    summary: {},
    reports: {
      sales: emptyReport,
      orders: emptyReport,
      payments: emptyReport,
      inventory: emptyReport,
      shipping: emptyReport,
      notifications: emptyReport,
      readiness: { globalStatus: 'NO_GO', counts: {}, modules: [], chart: [] },
      audit: emptyReport,
      blockers: [],
    },
    export: {
      formats: ['csv', 'pdf'],
      maxRows: 0,
      standardExportContainsPii: false,
      piiExportRequires: 'customers.read_sensitive',
      enabled: false,
    },
    errors: {},
  };
}

export async function getAdminReportsData(range: string = '30d'): Promise<AdminReportsData> {
  const errors: Record<string, string> = {};
  const data = await read<AdminReportsData | null>(
    `/admin/reports/summary?range=${encodeURIComponent(range)}`,
    null,
    errors,
    'reports',
  );
  if (!data) {
    return { ...emptyReports(range), errors };
  }
  return { ...data, errors };
}

export async function getAdminCatalogOperationsData(range: string = '30d'): Promise<AdminCatalogData> {
  const errors: Record<string, string> = {};
  const fallback: AdminCatalogData = {
    generatedAt: new Date().toISOString(),
    range,
    metrics: {},
    readiness: {
      products: 'NO_GO',
      brands: 'NO_GO',
      categories: 'NO_GO',
      inventory: 'NO_GO',
      prices: 'NO_GO',
      status: 'NO_GO',
      blockers: [],
      warnings: [],
    },
    products: [],
    brands: [],
    categories: [],
    prices: [],
    priceHistory: [],
  };
  return read(
    `/admin/catalog/overview?range=${encodeURIComponent(range)}`,
    fallback,
    errors,
    'catalog',
  );
}
