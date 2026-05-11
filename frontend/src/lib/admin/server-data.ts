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
  status: string;
  trackingNumber: string | null;
  routeNumber: string | null;
  quotedAmount: string | null;
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
  inventoryHistory: { data: Array<Record<string, unknown>> };
  priceHistory: { data: Array<Record<string, unknown>> };
  legal: { data: Array<Record<string, unknown>> };
  footer: Record<string, unknown>;
  settings: Record<string, unknown>;
  errors: Record<string, string>;
}

async function getAdminAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get('dt_admin_access')?.value ?? null;
}

export async function adminFetch<T>(path: string): Promise<AdminApiResult<T>> {
  const token = await getAdminAccessToken();
  if (!token) {
    return { ok: false, status: 401, data: null, error: 'Sesión administrativa requerida.' };
  }

  const response = await fetch(`${env.apiBaseUrl}/api/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
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
    inventoryHistory,
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
    read('/admin/inventory/history', { data: [] }, errors, 'inventoryHistory'),
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
    inventoryHistory,
    priceHistory,
    legal,
    footer,
    settings,
    errors,
  };
}
