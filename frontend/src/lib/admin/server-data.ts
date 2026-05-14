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

export interface AdminDashboardData {
  sales: AdminSalesSummary | null;
  topProducts: { data: AdminTopProduct[] } | null;
  operational: AdminOperationalMetrics | null;
  notifications: { data: AdminNotificationRow[] } | null;
  errors: Record<string, string>;
}

export async function getAdminDashboardData(range: string = '30d'): Promise<AdminDashboardData> {
  const errors: Record<string, string> = {};
  const now = new Date();
  const from = new Date(now);
  if (range === 'today') {
    from.setHours(0, 0, 0, 0);
  } else if (range === '7d') {
    from.setDate(from.getDate() - 7);
  } else if (range === 'month') {
    from.setDate(1);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(from.getDate() - 30);
  }
  const windowQuery = `windowFrom=${encodeURIComponent(from.toISOString())}&windowTo=${encodeURIComponent(now.toISOString())}`;
  const [sales, topProducts, operational, notifications] = await Promise.all([
    read<AdminSalesSummary | null>(`/admin/analytics/sales-summary?${windowQuery}`, null, errors, 'sales'),
    read<{ data: AdminTopProduct[] } | null>(`/admin/analytics/top-products?limit=8&${windowQuery}`, null, errors, 'topProducts'),
    read<AdminOperationalMetrics | null>('/admin/analytics/operational-metrics', null, errors, 'operational'),
    read<{ data: AdminNotificationRow[] } | null>('/admin/notifications?limit=20', null, errors, 'notifications'),
  ]);

  return {
    sales,
    topProducts,
    operational,
    notifications,
    errors,
  };
}
