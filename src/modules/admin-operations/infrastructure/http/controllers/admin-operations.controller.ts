import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Ip,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AdminSettingCategory,
  FooterRevisionStatus,
  LegalVersionStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
  QuoteStatus,
  ShipmentStatus,
} from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';

type SortDirection = 'asc' | 'desc';

interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
  sort?: string;
  direction?: string;
}

interface OrderStatusBody {
  status?: OrderStatus;
  reason?: string;
}

interface InternalNoteBody {
  note?: string;
}

interface ReconcileCodBody {
  reference?: string;
  note?: string;
}

interface CustomerUpdateBody {
  fullName?: string;
  email?: string;
  phone?: string;
  defaultAddress?: string;
  city?: string;
  department?: string;
  country?: string;
  marketingConsent?: boolean;
  dataTreatmentConsent?: boolean;
}

interface PriceUpdateBody {
  variantId?: string;
  price?: string;
  reason?: string;
}

interface FooterUpdateBody {
  groups?: Array<{
    title: string;
    links: Array<{ label: string; href: string; isVisible?: boolean }>;
  }>;
  status?: 'draft' | 'pending_legal_review' | 'approved' | 'published' | 'archived';
}

interface LegalUpdateBody {
  pageKey?: string;
  title?: string;
  slug?: string;
  content?: unknown;
  body?: string;
  checklist?: Record<string, boolean>;
  status?: 'draft' | 'pending_legal_review' | 'approved' | 'published' | 'archived';
  legalOverride?: boolean;
}

interface SettingsUpdateBody {
  general?: Record<string, unknown>;
  payments?: Record<string, unknown>;
  shipping?: Record<string, unknown>;
  notifications?: Record<string, unknown>;
  legal?: Record<string, unknown>;
  seo?: Record<string, unknown>;
  security?: Record<string, unknown>;
}

interface CreateQuoteBody {
  customerId?: string;
  customer?: {
    fullName?: string;
    email?: string;
    phone?: string;
    defaultAddress?: string;
    city?: string;
    department?: string;
    country?: string;
    dataTreatmentConsent?: boolean;
    marketingConsent?: boolean;
  };
  notes?: string;
  internalNotes?: string;
  expiresAt?: string;
  items?: Array<{
    productId: string;
    variantId?: string;
    nameSnapshot?: string;
    skuSnapshot?: string;
    quantity: number;
    unitPrice?: string | number;
    notes?: string;
  }>;
}

interface PatchQuoteBody {
  notes?: string;
  internalNotes?: string;
  expiresAt?: string | null;
  status?: QuoteStatus;
}

interface QuotePriceItemsBody {
  items?: Array<{
    id?: string;
    productId?: string;
    variantId?: string | null;
    nameSnapshot?: string;
    skuSnapshot?: string | null;
    quantity?: number;
    unitPrice?: string | number;
    notes?: string | null;
  }>;
}

interface RejectBody {
  reason?: string;
}

interface ShipmentRequestBody {
  packageSnapshot?: Record<string, unknown>;
  addressSnapshot?: Record<string, unknown>;
}

const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['pending_payment', 'cancelled'],
  pending_payment: ['paid', 'cancelled'],
  paid: ['packed', 'refunded'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

const INTERNAL_LINK_PATTERN = /^\/(?!\/)[a-z0-9\-/?=&%#]*$/i;
const LEGAL_PLACEHOLDER_PATTERN = /\[(RAZÓN SOCIAL|NIT|DIRECCIÓN|CORREO DE PRIVACIDAD|TELÉFONO OFICIAL|RESPONSABLE DEL TRATAMIENTO|CANAL DE RECLAMOS|DOMICILIO PRINCIPAL) PENDIENTE\]/i;

const LEGAL_PAGE_REQUIREMENTS: Record<string, string[]> = {
  'politica-de-privacidad': [
    'responsable identificado',
    'datos recolectados',
    'finalidades',
    'terceros/encargados',
    'derechos titulares',
    'canal de contacto',
    'cookies',
    'vigencia',
  ],
  'tratamiento-de-datos': [
    'responsable',
    'encargado',
    'principios',
    'finalidades',
    'consultas/reclamos',
    'vigencia base de datos',
    'transmisión/transferencia',
  ],
  'terminos-y-condiciones': [
    'proceso compra',
    'proceso cotización',
    'pagos',
    'envíos',
    'garantías',
    'retracto/cambios',
    'responsabilidades',
  ],
  'politica-de-envios': [
    'cobertura',
    'costos',
    'guía/rastreo',
    'contra entrega',
    'dirección incorrecta',
    'tiempos',
  ],
  'cambios-devoluciones-y-garantias': [
    'garantía',
    'cambios',
    'devoluciones',
    'retracto',
    'procedimiento',
    'exclusiones',
  ],
};

const DEFAULT_LEGAL_PAGES = [
  ['politica-de-privacidad', 'Política de privacidad'],
  ['tratamiento-de-datos', 'Tratamiento de datos personales'],
  ['terminos-y-condiciones', 'Términos y condiciones'],
  ['politica-de-envios', 'Política de envíos'],
  ['cambios-devoluciones-y-garantias', 'Cambios, devoluciones, garantías y retracto'],
] as const;

const DEFAULT_FOOTER_GROUPS = [
  {
    title: 'Legal',
    links: [
      { label: 'Política de privacidad', href: '/politica-de-privacidad' },
      { label: 'Tratamiento de datos', href: '/tratamiento-de-datos' },
      { label: 'Términos y condiciones', href: '/terminos-y-condiciones' },
      { label: 'Política de envíos', href: '/politica-de-envios' },
      { label: 'Cambios y garantías', href: '/cambios-devoluciones-y-garantias' },
    ],
  },
  {
    title: 'Soporte',
    links: [
      { label: 'Rastreo de pedido', href: '/rastreo-de-pedido' },
      { label: 'Contacto', href: '/contacto' },
    ],
  },
];

@ApiTags('admin-operations')
@ApiBearerAuth()
@Controller('admin')
export class AdminOperationsController {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  private pagination(query: PaginationQuery) {
    const page = Math.max(Number(query.page ?? 1) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit ?? 20) || 20, 1), 100);
    return { page, limit, skip: (page - 1) * limit };
  }

  private direction(direction?: string): SortDirection {
    return direction === 'asc' ? 'asc' : 'desc';
  }

  private maskEmail(email: string | null | undefined) {
    if (!email) return null;
    const [name, domain] = email.split('@');
    if (!domain) return '***';
    return `${name.slice(0, 2)}***@${domain}`;
  }

  private maskPhone(phone: string | null | undefined) {
    if (!phone) return null;
    return phone.length <= 4 ? '****' : `${phone.slice(0, 3)}***${phone.slice(-2)}`;
  }

  private sanitizeSettings(payload: Record<string, unknown>) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.includes('secret') ||
        normalizedKey.includes('private') ||
        normalizedKey.includes('token') ||
        normalizedKey.includes('key')
      ) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      if (value && typeof value === 'object' && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeSettings(value as Record<string, unknown>);
        continue;
      }

      sanitized[key] = value;
    }

    return sanitized;
  }

  private decimalString(value: Prisma.Decimal | number | null | undefined) {
    if (value === null || value === undefined) return null;
    return value instanceof Prisma.Decimal ? value.toFixed(2) : Number(value).toFixed(2);
  }

  private asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private appEnv() {
    return process.env.APP_ENV ?? process.env.NODE_ENV ?? 'local';
  }

  private isProductionEnv() {
    return this.appEnv() === 'production';
  }

  private hasStableDomain() {
    const value = [
      process.env.APP_BASE_URL,
      process.env.STOREFRONT_PUBLIC_URL,
      process.env.NEXT_PUBLIC_SITE_URL,
    ].filter(Boolean).join(' ');
    return Boolean(value) && !/trycloudflare|localhost|127\.0\.0\.1/i.test(value);
  }

  private shipmentGuideSource(shipment: {
    provider: string;
    trackingNumber: string | null;
    packageSnapshot: Prisma.JsonValue | null;
  }) {
    const packageSnapshot = this.asRecord(shipment.packageSnapshot);
    const guide = this.asRecord(packageSnapshot.guide);
    const providerMode = typeof guide.providerMode === 'string' ? guide.providerMode : null;

    if (
      providerMode === 'created_in_mock'
      || shipment.provider === 'mock_99envios'
      || shipment.trackingNumber?.startsWith('MOCK99-')
    ) {
      return {
        providerMode: 'mock_local',
        guideSource: 'mock_99envios',
        productionState: 'mock_local',
        warning: 'Guía simulada local/test. No existe en panel real 99 Envíos.',
      };
    }

    if (shipment.provider === '99envios' && shipment.trackingNumber) {
      return {
        providerMode: 'created_in_99envios_real',
        guideSource: 'real_99envios',
        productionState: 'production_ready',
        warning: 'Guía creada en 99 Envíos.',
      };
    }

    if (shipment.provider === 'internal' || shipment.provider === 'none') {
      return {
        providerMode: 'internal',
        guideSource: 'internal',
        productionState: 'pending_credentials',
        warning: 'Seguimiento interno. Guía externa pendiente.',
      };
    }

    return {
      providerMode: 'pending_provider',
      guideSource: 'pending',
      productionState: 'pending_credentials',
      warning: 'Guía externa pendiente de provider real.',
    };
  }

  private selectedCarrierReason(packageSnapshot: Prisma.JsonValue | null) {
    const snapshot = this.asRecord(packageSnapshot);
    const selected = this.asRecord(snapshot.selectedCarrier);
    const carrier = typeof selected.carrier === 'string' ? selected.carrier : null;
    const totalComparable = selected.totalComparable;

    if (!carrier) return null;

    return `Más económica disponible: ${carrier}${totalComparable !== undefined ? ` (${totalComparable} COP comparables)` : ''}.`;
  }

  private buildProductionReadiness() {
    const appEnv = this.appEnv();
    const production = this.isProductionEnv();
    const shippingProvider = process.env.SHIPPING_PROVIDER ?? 'internal';
    const autoShippingMode = process.env.AUTO_SHIPPING_MODE ?? 'disabled';
    const adminAuthDisabled = process.env.ADMIN_AUTH_DISABLED === 'true';
    const has99Credentials = Boolean(
      process.env.NINETY_NINE_ENVIOS_API_BASE_URL
      && process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL
      && process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD,
    );
    const checks = [
      {
        key: 'app_env_production',
        label: 'APP_ENV=production',
        status: production ? 'pass' : 'fail',
        message: production ? 'Entorno declarado como producción.' : `Entorno actual: ${appEnv}.`,
      },
      {
        key: 'admin_auth_enabled',
        label: 'ADMIN_AUTH_DISABLED=false',
        status: !adminAuthDisabled ? 'pass' : 'fail',
        message: !adminAuthDisabled ? 'Login admin requerido.' : 'Login admin desactivado; bloquea producción.',
      },
      {
        key: 'stable_domain',
        label: 'Dominio estable sin trycloudflare/local',
        status: this.hasStableDomain() ? 'pass' : 'fail',
        message: this.hasStableDomain() ? 'Dominio estable detectado.' : 'Dominio estable pendiente o URL temporal/local.',
      },
      {
        key: 'no_mock_shipping',
        label: 'Mock 99 Envíos desactivado en producción',
        status: shippingProvider !== 'mock_99envios' ? 'pass' : 'fail',
        message: shippingProvider === 'mock_99envios'
          ? 'mock_99envios no puede operar como producción.'
          : `Provider actual: ${shippingProvider}.`,
      },
      {
        key: 'shipping_provider_real',
        label: 'SHIPPING_PROVIDER=99envios para logística real',
        status: shippingProvider === '99envios' ? 'pass' : 'fail',
        message: shippingProvider === '99envios' ? 'Provider real seleccionado.' : 'Logística real bloqueada hasta seleccionar 99envios.',
      },
      {
        key: '99envios_credentials',
        label: 'Credenciales 99 Envíos configuradas',
        status: has99Credentials ? 'pass' : 'fail',
        message: has99Credentials ? 'Credenciales base configuradas.' : 'Faltan base URL, email o password 99 Envíos.',
      },
      {
        key: '99envios_branch',
        label: 'Branch code configurado',
        status: process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE ? 'pass' : 'fail',
        message: process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE ? 'Sucursal configurada.' : 'Sucursal 99 Envíos pendiente.',
      },
      {
        key: 'origin_dane',
        label: 'Origin DANE configurado',
        status: process.env.NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_DANE_CODE ? 'pass' : 'fail',
        message: process.env.NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_DANE_CODE ? 'DANE origen configurado.' : 'DANE origen pendiente.',
      },
      {
        key: 'auto_shipping_real_provider',
        label: 'Auto-shipping no usa mock en creación de guía',
        status: autoShippingMode !== 'quote_and_create_guide' || shippingProvider === '99envios' ? 'pass' : 'fail',
        message: autoShippingMode === 'quote_and_create_guide' && shippingProvider !== '99envios'
          ? 'Creación automática de guía requiere provider real.'
          : `AUTO_SHIPPING_MODE=${autoShippingMode}.`,
      },
      {
        key: 'email_productive',
        label: 'Email productivo configurado',
        status: process.env.EMAIL_PROVIDER && process.env.EMAIL_PROVIDER !== 'none' && process.env.EMAIL_PROVIDER !== 'mock' ? 'pass' : 'fail',
        message: 'Email productivo pendiente si es requisito de salida.',
      },
      {
        key: 'payment_provider',
        label: 'Payment provider configurado si aplica',
        status: process.env.PAYMENT_PROVIDER && process.env.PAYMENT_PROVIDER !== 'none' ? 'pass' : 'fail',
        message: 'PSE/pasarela real pendiente; contraentrega puede seguir operativo.',
      },
      {
        key: 'rbac_audit',
        label: 'RBAC y audit log activos',
        status: 'pass',
        message: 'Endpoints admin usan guards de permisos y auditoría en acciones críticas.',
      },
      {
        key: 'public_tracking_pii',
        label: 'Tracking público sin PII',
        status: 'pass',
        message: 'El rastreo público expone estados, no email/teléfono/dirección.',
      },
    ];
    const failed = checks.filter((check) => check.status === 'fail');
    return {
      status: failed.length === 0 ? 'READY_FOR_PRODUCTION' : 'BLOCKED_FOR_PRODUCTION',
      mode: production
        ? failed.length === 0 ? 'production_ready' : 'production_blocked'
        : shippingProvider === 'mock_99envios' ? 'mock_local' : 'sandbox_ready',
      checks,
      blockers: failed.map((check) => check.message),
    };
  }

  private featureFlag(key: string, fallback = false) {
    const value = process.env[key];
    if (value === undefined) return fallback;
    return value === 'true';
  }

  private buildFeatureFlags() {
    return {
      CATALOG_ADVANCED_ENABLED: this.featureFlag('CATALOG_ADVANCED_ENABLED', true),
      INVENTORY_ADVANCED_ENABLED: this.featureFlag('INVENTORY_ADVANCED_ENABLED', true),
      INVENTORY_IMPORT_ENABLED: this.featureFlag('INVENTORY_IMPORT_ENABLED', true),
      INVENTORY_EXPORT_ENABLED: this.featureFlag('INVENTORY_EXPORT_ENABLED', true),
      INVENTORY_RETURNS_ENABLED: this.featureFlag('INVENTORY_RETURNS_ENABLED', true),
      INVENTORY_COUNTS_ENABLED: this.featureFlag('INVENTORY_COUNTS_ENABLED', true),
      INVENTORY_VALUATION_ENABLED: this.featureFlag('INVENTORY_VALUATION_ENABLED', true),
      ORDERS_ADVANCED_ENABLED: this.featureFlag('ORDERS_ADVANCED_ENABLED', true),
      FULFILLMENT_ADVANCED_ENABLED: this.featureFlag('FULFILLMENT_ADVANCED_ENABLED', false),
      QUOTES_ENABLED: this.featureFlag('QUOTES_ENABLED', true),
      CUSTOMERS_ADVANCED_ENABLED: this.featureFlag('CUSTOMERS_ADVANCED_ENABLED', true),
      PAYMENTS_MANUAL_ENABLED: this.featureFlag('PAYMENTS_MANUAL_ENABLED', true),
      PAYMENTS_REAL_PROVIDER_ENABLED: this.featureFlag('PAYMENTS_REAL_PROVIDER_ENABLED', false),
      PSE_ENABLED: this.featureFlag('PSE_ENABLED', false),
      SHIPPING_REAL_PROVIDER_ENABLED: this.featureFlag('SHIPPING_REAL_PROVIDER_ENABLED', false),
      AUTO_SHIPPING_ENABLED: this.featureFlag('AUTO_SHIPPING_ENABLED', false),
      TRACKING_EXTERNAL_ENABLED: this.featureFlag('TRACKING_EXTERNAL_ENABLED', false),
      NOTIFICATIONS_LOCAL_ENABLED: this.featureFlag('NOTIFICATIONS_LOCAL_ENABLED', true),
      NOTIFICATIONS_REAL_PROVIDER_ENABLED: this.featureFlag('NOTIFICATIONS_REAL_PROVIDER_ENABLED', false),
      REPORTS_ADVANCED_ENABLED: this.featureFlag('REPORTS_ADVANCED_ENABLED', true),
      ADMIN_EXPORTS_ENABLED: this.featureFlag('ADMIN_EXPORTS_ENABLED', true),
      LEGAL_WORKFLOW_ENABLED: this.featureFlag('LEGAL_WORKFLOW_ENABLED', true),
      FOOTER_EDITOR_ENABLED: this.featureFlag('FOOTER_EDITOR_ENABLED', true),
    };
  }

  private buildModuleReadiness() {
    const shippingProvider = process.env.SHIPPING_PROVIDER ?? 'internal';
    const has99Credentials = Boolean(
      process.env.NINETY_NINE_ENVIOS_API_BASE_URL
      && process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL
      && process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD,
    );
    const emailProvider = process.env.EMAIL_PROVIDER ?? process.env.NOTIFICATION_PROVIDER ?? 'none';
    const paymentProvider = process.env.PAYMENT_PROVIDER ?? 'none';
    const readiness = this.buildProductionReadiness();

    const item = (
      module: string,
      status: string,
      blockers: string[] = [],
      warnings: string[] = [],
      productionImpact = 'operational',
      nextAction = 'Mantener monitoreo y auditoria.',
    ) => ({
      module,
      status,
      blockers,
      warnings,
      requiredConfig: [],
      providerStatus: status,
      lastValidationAt: new Date().toISOString(),
      evidence: 'admin-operational-closure',
      productionImpact,
      nextAction,
    });

    return [
      item('dashboard', 'READY'),
      item('reports', 'GO_WITH_RISKS', [], ['Margen no disponible si faltan costos.']),
      item('catalog', 'GO_WITH_RISKS', [], ['Productos/marcas/categorias operan con permisos legacy y alias granulares.']),
      item('products', 'GO_WITH_RISKS'),
      item('brands', 'GO_WITH_RISKS'),
      item('categories', 'GO_WITH_RISKS'),
      item('inventory', 'READY'),
      item('prices', 'PARTIAL', [], ['Historial basico; aprobacion formal queda por flujo de precios avanzado.']),
      item('orders', 'READY'),
      item('quotes', 'PARTIAL', [], ['Conversion a pedido queda manual para no inventar checkout.']),
      item('customers', 'READY', [], ['PII sensible requiere customers.read_sensitive.']),
      item('payments', paymentProvider === 'none' ? 'BLOCKED_PROVIDER' : 'GO_WITH_RISKS', paymentProvider === 'none' ? ['Proveedor de pagos real pendiente.'] : [], ['COD/manual operativo.'], 'blocks_online_payments', 'Configurar Wompi/PayU/PSE real si se habilitan pagos online.'),
      item('shipping', shippingProvider === '99envios' && has99Credentials ? 'GO_WITH_RISKS' : 'BLOCKED_PROVIDER', shippingProvider === '99envios' && has99Credentials ? [] : ['99 Envios real pendiente de credenciales/proveedor activo.'], [shippingProvider === 'mock_99envios' ? 'Mock local/test no es produccion.' : `Provider actual: ${shippingProvider}.`], 'blocks_external_guides', 'Configurar credenciales 99 Envios reales/sandbox.'),
      item('tracking', 'GO_WITH_RISKS', [], ['Tracking interno operativo; tracking externo depende de shipping real.']),
      item('notifications', emailProvider !== 'none' && emailProvider !== 'mock' ? 'GO_WITH_RISKS' : 'BLOCKED_PROVIDER', emailProvider === 'none' || emailProvider === 'mock' ? ['Email productivo pendiente.'] : [], ['Local/test no equivale a proveedor productivo.'], 'blocks_productive_email', 'Configurar proveedor email real.'),
      item('legal', 'PARTIAL', [], ['Faltan datos legales finales de empresa.']),
      item('footer', 'PARTIAL', [], ['Editor operativo con publicacion auditada.']),
      item('settings', readiness.status === 'READY_FOR_PRODUCTION' ? 'READY' : 'BLOCKED_CONFIGURATION', readiness.blockers, [], 'blocks_production', 'Cerrar blockers de production readiness.'),
      item('users', 'GO_WITH_RISKS'),
      item('roles', 'GO_WITH_RISKS'),
      item('audit', 'READY'),
      item('production', readiness.status === 'READY_FOR_PRODUCTION' ? 'READY' : 'BLOCKED_CONFIGURATION', readiness.blockers, [], 'blocks_production', 'Completar credenciales, dominio, email y pagos reales.'),
    ];
  }

  private parseMoney(value: string | number | undefined | null, field: string) {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException(`${field} debe ser un valor monetario no negativo.`);
    }

    return parsed;
  }

  private normalizeEmail(email: string | undefined | null) {
    return email?.trim().toLowerCase() ?? null;
  }

  private publicCustomer(customer: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    city: string | null;
    department: string | null;
    country: string;
    marketingConsent: boolean;
    dataTreatmentConsent: boolean;
    lastOrderAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: customer.id,
      fullName: customer.fullName,
      email: this.maskEmail(customer.email),
      phone: this.maskPhone(customer.phone),
      city: customer.city,
      department: customer.department,
      country: customer.country,
      marketingConsent: customer.marketingConsent,
      dataTreatmentConsent: customer.dataTreatmentConsent,
      lastOrderAt: customer.lastOrderAt,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }

  private privateCustomer(customer: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
    documentType: string | null;
    documentNumber: string | null;
    defaultAddress: string | null;
    city: string | null;
    department: string | null;
    country: string;
    marketingConsent: boolean;
    dataTreatmentConsent: boolean;
    lastOrderAt: Date | null;
  }) {
    return {
      ...customer,
      documentNumber: customer.documentNumber ? '[PROTECTED]' : null,
    };
  }

  private async ensureCustomerFromOrder(order: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: string;
    shippingCity: string;
    createdAt: Date;
  }) {
    const email = this.normalizeEmail(order.customerEmail);
    if (!email) {
      throw new BadRequestException('El pedido no tiene email de cliente válido.');
    }

    return this.prisma.customer.upsert({
      where: { email },
      create: {
        id: uuidv7(),
        fullName: order.customerName,
        email,
        phone: order.customerPhone,
        defaultAddress: order.shippingAddress,
        city: order.shippingCity,
        country: 'CO',
        lastOrderAt: order.createdAt,
      },
      update: {
        fullName: order.customerName,
        phone: order.customerPhone,
        defaultAddress: order.shippingAddress,
        city: order.shippingCity,
        lastOrderAt: order.createdAt,
      },
    });
  }

  private async ensureCustomerFromBody(body: CreateQuoteBody) {
    if (body.customerId) {
      const customer = await this.prisma.customer.findUnique({ where: { id: body.customerId } });
      if (!customer) {
        throw new NotFoundException('Cliente no encontrado.');
      }
      return customer;
    }

    const email = this.normalizeEmail(body.customer?.email);
    const fullName = body.customer?.fullName?.trim();
    if (!email || !fullName) {
      throw new BadRequestException('Cliente con nombre y email es obligatorio para la cotización.');
    }

    return this.prisma.customer.upsert({
      where: { email },
      create: {
        id: uuidv7(),
        fullName,
        email,
        phone: body.customer?.phone?.trim() || null,
        defaultAddress: body.customer?.defaultAddress?.trim() || null,
        city: body.customer?.city?.trim() || null,
        department: body.customer?.department?.trim() || null,
        country: body.customer?.country?.trim() || 'CO',
        marketingConsent: Boolean(body.customer?.marketingConsent),
        dataTreatmentConsent: Boolean(body.customer?.dataTreatmentConsent),
      },
      update: {
        fullName,
        phone: body.customer?.phone?.trim() || null,
        defaultAddress: body.customer?.defaultAddress?.trim() || null,
        city: body.customer?.city?.trim() || null,
        department: body.customer?.department?.trim() || null,
        country: body.customer?.country?.trim() || 'CO',
        marketingConsent: Boolean(body.customer?.marketingConsent),
        dataTreatmentConsent: Boolean(body.customer?.dataTreatmentConsent),
      },
    });
  }

  private async nextSequence(prefix: string, model: 'quote' | 'footerRevision') {
    if (model === 'quote') {
      const total = await this.prisma.quote.count();
      return `${prefix}-${String(total + 1).padStart(6, '0')}`;
    }

    return (await this.prisma.footerRevision.count()) + 1;
  }

  private serializeQuote(quote: Prisma.QuoteGetPayload<{
    include: { customer: true; items: true; order: true };
  }>) {
    return {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      status: quote.status,
      subtotal: this.decimalString(quote.subtotal),
      currency: quote.currency,
      notes: quote.notes,
      internalNotes: quote.internalNotes,
      expiresAt: quote.expiresAt,
      sentAt: quote.sentAt,
      acceptedAt: quote.acceptedAt,
      rejectedAt: quote.rejectedAt,
      convertedAt: quote.convertedAt,
      customer: this.publicCustomer(quote.customer),
      order: quote.order
        ? { id: quote.order.id, orderNumber: quote.order.orderNumber, status: quote.order.status }
        : null,
      items: quote.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        variantId: item.variantId,
        nameSnapshot: item.nameSnapshot,
        skuSnapshot: item.skuSnapshot,
        quantity: item.quantity,
        unitPrice: this.decimalString(item.unitPrice),
        totalPrice: this.decimalString(item.totalPrice),
        notes: item.notes,
      })),
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };
  }

  private serializeShipment(shipment: Prisma.ShipmentGetPayload<{
    include: { customer: true; order: true; events: true };
  }>) {
    const guide = this.shipmentGuideSource(shipment);
    const packageSnapshot = this.asRecord(shipment.packageSnapshot);
    return {
      id: shipment.id,
      orderId: shipment.orderId,
      orderNumber: shipment.order.orderNumber,
      customer: this.publicCustomer(shipment.customer),
      provider: shipment.provider,
      providerMode: guide.providerMode,
      guideSource: guide.guideSource,
      guideNotice: guide.warning,
      productionState: guide.productionState,
      autoShippingStatus: typeof packageSnapshot.autoShippingStatus === 'string'
        ? packageSnapshot.autoShippingStatus
        : shipment.rawProviderStatus,
      selectedCarrierReason: this.selectedCarrierReason(shipment.packageSnapshot),
      labelStatus: this.asRecord(packageSnapshot.guide).labelStatus ?? null,
      status: shipment.status,
      quotedAmount: this.decimalString(shipment.quotedAmount),
      currency: shipment.currency,
      trackingNumber: shipment.trackingNumber,
      routeNumber: shipment.routeNumber,
      labelUrl: shipment.labelUrl,
      providerShipmentId: shipment.providerShipmentId,
      providerReference: shipment.providerReference,
      estimatedDeliveryDate: shipment.estimatedDeliveryDate,
      rawProviderStatus: shipment.rawProviderStatus,
      addressSnapshot: shipment.addressSnapshot,
      packageSnapshot: shipment.packageSnapshot,
      lastSyncAt: shipment.lastSyncAt,
      events: shipment.events.map((event) => ({
        id: event.id,
        status: event.status,
        providerStatus: event.providerStatus,
        description: event.description,
        location: event.location,
        occurredAt: event.occurredAt,
        createdAt: event.createdAt,
      })),
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    };
  }

  private sanitizeLegalContent(content: unknown) {
    const asText = JSON.stringify(content ?? {});
    if (/<script|javascript:/i.test(asText)) {
      throw new BadRequestException('El contenido legal no puede incluir scripts ni links peligrosos.');
    }
    return content ?? {};
  }

  private legalChecklistComplete(pageKey: string, checklist: Record<string, boolean> | null | undefined) {
    const required = LEGAL_PAGE_REQUIREMENTS[pageKey] ?? [];
    return required.every((item) => checklist?.[item] === true);
  }

  private validateFooterGroups(groups: FooterUpdateBody['groups']) {
    if (!Array.isArray(groups) || groups.length === 0) {
      throw new BadRequestException('Los grupos de footer son obligatorios.');
    }

    for (const group of groups) {
      if (!group.title?.trim()) {
        throw new BadRequestException('Cada grupo de footer requiere título.');
      }
      for (const link of group.links ?? []) {
        if (!link.label?.trim() || !INTERNAL_LINK_PATTERN.test(link.href) || link.href === '#') {
          throw new BadRequestException('El footer solo acepta links internos visibles y válidos.');
        }
      }
    }
  }

  private async audit(
    actor: CurrentUser,
    action: string,
    entityType: string,
    entityId: string,
    beforeData: unknown,
    afterData: unknown,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.auditRepository.write({
      actorUserId: actor.sub,
      action,
      entityType,
      entityId,
      beforeData,
      afterData,
      ipAddress,
      userAgent,
    });
  }

  @Permissions('orders.read')
  @Get('orders')
  async listOrders(@Query() query: PaginationQuery & {
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    customer?: string;
  }) {
    const { page, limit, skip } = this.pagination(query);
    const search = query.search?.trim();
    const where = {
      status: query.status,
      payments: query.paymentStatus
        ? {
            some: {
              status: query.paymentStatus,
            },
          }
        : undefined,
      OR: search
        ? [
            { orderNumber: { contains: search, mode: 'insensitive' as const } },
            { customerName: { contains: search, mode: 'insensitive' as const } },
            { customerEmail: { contains: search, mode: 'insensitive' as const } },
          ]
        : undefined,
    };

    const [total, orders] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: {
          orderItems: { include: { variant: true } },
          payments: true,
        },
        orderBy: { createdAt: this.direction(query.direction) },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        customerName: order.customerName,
        customerEmail: this.maskEmail(order.customerEmail),
        customerPhone: this.maskPhone(order.customerPhone),
        shippingCity: order.shippingCity,
        itemsCount: order.orderItems.length,
        paymentStatus: order.payments[0]?.status ?? null,
        paymentMethod: order.payments[0]?.gateway ?? null,
        grandTotal: order.grandTotal.toFixed(2),
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      })),
      meta: { page, limit, total },
    };
  }

  @Permissions('orders.read')
  @Get('orders/:orderId')
  async getAdminOrder(@Param('orderId') orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        orderItems: { include: { variant: true } },
        payments: true,
        quotes: true,
        shipments: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      customerName: order.customerName,
      customerEmail: this.maskEmail(order.customerEmail),
      customerPhone: this.maskPhone(order.customerPhone),
      shippingAddress: order.shippingAddress,
      shippingCity: order.shippingCity,
      shippingNotes: order.shippingNotes,
      subtotal: order.subtotal.toFixed(2),
      discountTotal: order.discountTotal.toFixed(2),
      taxTotal: order.taxTotal.toFixed(2),
      shippingTotal: order.shippingTotal.toFixed(2),
      grandTotal: order.grandTotal.toFixed(2),
      items: order.orderItems.map((item) => ({
        id: item.id,
        sku: item.skuSnapshot,
        name: item.variantNameSnapshot,
        quantity: item.quantity,
        unitPrice: item.unitPrice.toFixed(2),
        lineGrandTotal: item.lineGrandTotal.toFixed(2),
      })),
      payments: order.payments.map((payment) => ({
        id: payment.id,
        gateway: payment.gateway,
        status: payment.status,
        amount: payment.amount.toFixed(2),
        currency: payment.currency,
        providerReference: payment.gatewayReference,
      })),
      quotes: order.quotes.map((quote) => ({
        id: quote.id,
        quoteNumber: quote.quoteNumber,
        status: quote.status,
      })),
      shipments: order.shipments.map((shipment) => ({
        id: shipment.id,
        provider: shipment.provider,
        status: shipment.status,
        trackingNumber: shipment.trackingNumber,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  @Permissions('orders.status.write')
  @Patch('orders/:orderId/status')
  async updateOrderStatus(
    @Param('orderId') orderId: string,
    @Body() body: OrderStatusBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (!body.status || !Object.values(OrderStatus).includes(body.status)) {
      throw new BadRequestException('Estado de pedido inválido.');
    }

    const current = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!current) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    const allowed = ORDER_TRANSITIONS[current.status];
    if (!allowed.includes(body.status)) {
      throw new BadRequestException('Transición de pedido no permitida.');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: body.status,
        shippingNotes: body.reason
          ? `${current.shippingNotes ?? ''}\nNota interna: ${body.reason}`.trim()
          : current.shippingNotes,
      },
    });

    await this.audit(
      actor,
      'order.status_updated',
      'order',
      orderId,
      { status: current.status },
      { status: updated.status, reason: body.reason ?? null },
      ipAddress,
      userAgent,
    );

    return {
      id: updated.id,
      orderNumber: updated.orderNumber,
      status: updated.status,
      updatedAt: updated.updatedAt,
    };
  }

  @Permissions('orders.cancel')
  @Post('orders/:orderId/cancel')
  async cancelOrderById(
    @Param('orderId') orderId: string,
    @Body() body: OrderStatusBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const current = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!current) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    if (!ORDER_TRANSITIONS[current.status].includes('cancelled')) {
      throw new BadRequestException('Este pedido no puede cancelarse desde su estado actual.');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'cancelled',
        shippingNotes: body.reason
          ? `${current.shippingNotes ?? ''}\nCancelación: ${body.reason}`.trim()
          : current.shippingNotes,
      },
    });

    await this.audit(
      actor,
      'order.cancelled',
      'order',
      orderId,
      { status: current.status },
      { status: updated.status, reason: body.reason ?? null },
      ipAddress,
      userAgent,
    );

    return { id: updated.id, orderNumber: updated.orderNumber, status: updated.status };
  }

  @Permissions('orders.notes.write')
  @Post('orders/:orderId/internal-note')
  async addInternalOrderNote(
    @Param('orderId') orderId: string,
    @Body() body: InternalNoteBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const note = body.note?.trim();
    if (!note) {
      throw new BadRequestException('La nota interna es obligatoria.');
    }

    const current = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!current) {
      throw new NotFoundException('Pedido no encontrado.');
    }

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        shippingNotes: `${current.shippingNotes ?? ''}\nNota interna: ${note}`.trim(),
      },
    });

    await this.audit(
      actor,
      'order.internal_note_added',
      'order',
      orderId,
      null,
      { note },
      ipAddress,
      userAgent,
    );

    return { id: updated.id, orderNumber: updated.orderNumber, updatedAt: updated.updatedAt };
  }

  @Permissions('quotes.read')
  @Get('quotes')
  async listQuotes(@Query() query: PaginationQuery & { status?: QuoteStatus }) {
    const { page, limit, skip } = this.pagination(query);
    const search = query.search?.trim();
    const where = {
      status: query.status,
      OR: search
        ? [
            { quoteNumber: { contains: search, mode: 'insensitive' as const } },
            { customer: { fullName: { contains: search, mode: 'insensitive' as const } } },
            { customer: { email: { contains: search, mode: 'insensitive' as const } } },
          ]
        : undefined,
    };

    const [total, quotes] = await Promise.all([
      this.prisma.quote.count({ where }),
      this.prisma.quote.findMany({
        where,
        include: { customer: true, order: true, items: true },
        orderBy: { createdAt: this.direction(query.direction) },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: quotes.map((quote) => this.serializeQuote(quote)),
      meta: { page, limit, total },
    };
  }

  @Permissions('quotes.read')
  @Get('quotes/:quoteId')
  async getQuote(@Param('quoteId') quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { customer: true, order: true, items: true },
    });
    if (!quote) {
      throw new NotFoundException('Cotización no encontrada.');
    }

    const audit = await this.auditRepository.list({
      entityType: 'quote',
      entityId: quoteId,
      limit: 50,
    });

    return { ...this.serializeQuote(quote), timeline: audit };
  }

  @Permissions('quotes.write')
  @Post('quotes')
  async createQuote(
    @Body() body: CreateQuoteBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const customer = await this.ensureCustomerFromBody(body);
    const quoteNumber = await this.nextSequence('QTE', 'quote') as string;
    const items = body.items ?? [];
    const subtotal = items.reduce((sum, item) => {
      const price = this.parseMoney(item.unitPrice, 'Precio unitario') ?? 0;
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestException('La cantidad de cotización debe ser mayor a cero.');
      }
      return sum + price * quantity;
    }, 0);

    const quote = await this.prisma.quote.create({
      data: {
        id: uuidv7(),
        quoteNumber,
        customerId: customer.id,
        status: items.some((item) => item.unitPrice !== undefined) ? 'quoted' : 'requested',
        subtotal,
        notes: body.notes?.trim() || null,
        internalNotes: body.internalNotes?.trim() || null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdById: actor.sub,
        updatedById: actor.sub,
        items: {
          create: items.map((item) => {
            const price = this.parseMoney(item.unitPrice, 'Precio unitario');
            const quantity = Number(item.quantity);
            return {
              id: uuidv7(),
              productId: item.productId,
              variantId: item.variantId ?? null,
              nameSnapshot: item.nameSnapshot?.trim() || 'Producto por cotizar',
              skuSnapshot: item.skuSnapshot?.trim() || null,
              quantity,
              unitPrice: price,
              totalPrice: price === null ? null : price * quantity,
              notes: item.notes?.trim() || null,
            };
          }),
        },
      },
      include: { customer: true, order: true, items: true },
    });

    await this.audit(actor, 'quote.created', 'quote', quote.id, null, this.serializeQuote(quote), ipAddress, userAgent);
    return this.serializeQuote(quote);
  }

  @Permissions('quotes.write')
  @Patch('quotes/:quoteId')
  async updateQuote(
    @Param('quoteId') quoteId: string,
    @Body() body: PatchQuoteBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const current = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { customer: true, order: true, items: true },
    });
    if (!current) {
      throw new NotFoundException('Cotización no encontrada.');
    }
    if (body.status && !['requested', 'in_review', 'quoted', 'cancelled'].includes(body.status)) {
      throw new BadRequestException('Use las acciones dedicadas para cambiar este estado.');
    }

    const updated = await this.prisma.quote.update({
      where: { id: quoteId },
      data: {
        notes: body.notes ?? current.notes,
        internalNotes: body.internalNotes ?? current.internalNotes,
        expiresAt: body.expiresAt === undefined ? current.expiresAt : body.expiresAt ? new Date(body.expiresAt) : null,
        status: body.status ?? current.status,
        updatedById: actor.sub,
      },
      include: { customer: true, order: true, items: true },
    });

    await this.audit(actor, 'quote.updated', 'quote', quoteId, this.serializeQuote(current), this.serializeQuote(updated), ipAddress, userAgent);
    return this.serializeQuote(updated);
  }

  @Permissions('quotes.write')
  @Post('quotes/:quoteId/price-items')
  async priceQuoteItems(
    @Param('quoteId') quoteId: string,
    @Body() body: QuotePriceItemsBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new BadRequestException('Debe enviar al menos un item con precio.');
    }
    const current = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { customer: true, order: true, items: true },
    });
    if (!current) {
      throw new NotFoundException('Cotización no encontrada.');
    }
    if (['accepted', 'rejected', 'converted_to_order', 'cancelled'].includes(current.status)) {
      throw new BadRequestException('No se pueden modificar precios en una cotización cerrada.');
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of body.items ?? []) {
        const unitPrice = this.parseMoney(item.unitPrice, 'Precio unitario');
        if (unitPrice === null) {
          throw new BadRequestException('Cada item requiere precio unitario.');
        }
        const quantity = Number(item.quantity ?? 1);
        if (!Number.isInteger(quantity) || quantity <= 0) {
          throw new BadRequestException('La cantidad debe ser mayor a cero.');
        }

        if (item.id) {
          await tx.quoteItem.update({
            where: { id: item.id },
            data: {
              quantity,
              unitPrice,
              totalPrice: unitPrice * quantity,
              notes: item.notes ?? undefined,
            },
          });
        } else {
          if (!item.productId || !item.nameSnapshot) {
            throw new BadRequestException('Items nuevos requieren producto y nombre snapshot.');
          }
          await tx.quoteItem.create({
            data: {
              id: uuidv7(),
              quoteId,
              productId: item.productId,
              variantId: item.variantId ?? null,
              nameSnapshot: item.nameSnapshot,
              skuSnapshot: item.skuSnapshot ?? null,
              quantity,
              unitPrice,
              totalPrice: unitPrice * quantity,
              notes: item.notes ?? null,
            },
          });
        }
      }
      const aggregate = await tx.quoteItem.aggregate({
        where: { quoteId },
        _sum: { totalPrice: true },
      });
      await tx.quote.update({
        where: { id: quoteId },
        data: {
          subtotal: aggregate._sum.totalPrice ?? 0,
          status: 'quoted',
          updatedById: actor.sub,
        },
      });
    });

    const updated = await this.prisma.quote.findUniqueOrThrow({
      where: { id: quoteId },
      include: { customer: true, order: true, items: true },
    });
    await this.audit(actor, 'quote.items_priced', 'quote', quoteId, this.serializeQuote(current), this.serializeQuote(updated), ipAddress, userAgent);
    return this.serializeQuote(updated);
  }

  @Permissions('quotes.write')
  @Post('quotes/:quoteId/submit-review')
  async submitQuoteReview(
    @Param('quoteId') quoteId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.transitionQuote(quoteId, actor, 'in_review', 'quote.submitted_review', ipAddress, userAgent);
  }

  @Permissions('quotes.write')
  @Post('quotes/:quoteId/send')
  async sendQuote(
    @Param('quoteId') quoteId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const notificationProvider = process.env.NOTIFICATION_PROVIDER ?? process.env.EMAIL_PROVIDER ?? 'none';
    if (notificationProvider === 'none') {
      const quote = await this.transitionQuote(quoteId, actor, 'quoted', 'quote.manual_send_required', ipAddress, userAgent);
      await this.prisma.notificationEvent.create({
        data: {
          id: uuidv7(),
          entityType: 'quote',
          entityId: quoteId,
          provider: 'none',
          channel: 'email',
          status: 'skipped_provider_not_configured',
          recipientMasked: quote.customer.email,
          errorMessage: 'Proveedor de notificaciones no configurado; no se marcó como enviado.',
        },
      });
      return {
        ...quote,
        operationalState: {
          status: 'pending_manual_send',
          message: 'No se marcó como enviada porque no hay provider real de notificaciones configurado.',
        },
      };
    }
    return this.transitionQuote(quoteId, actor, 'sent', 'quote.sent', ipAddress, userAgent, { sentAt: new Date() });
  }

  @Permissions('quotes.approve')
  @Post('quotes/:quoteId/accept')
  acceptQuote(
    @Param('quoteId') quoteId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.transitionQuote(quoteId, actor, 'accepted', 'quote.accepted', ipAddress, userAgent, { acceptedAt: new Date() });
  }

  @Permissions('quotes.approve')
  @Post('quotes/:quoteId/reject')
  rejectQuote(
    @Param('quoteId') quoteId: string,
    @Body() body: RejectBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.transitionQuote(quoteId, actor, 'rejected', 'quote.rejected', ipAddress, userAgent, {
      rejectedAt: new Date(),
      internalNotes: body.reason ? `Rechazada: ${body.reason}` : undefined,
    });
  }

  @Permissions('quotes.convert')
  @Post('quotes/:quoteId/convert-to-order')
  async convertQuote(
    @Param('quoteId') quoteId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { customer: true, order: true, items: true },
    });
    if (!quote) {
      throw new NotFoundException('Cotización no encontrada.');
    }
    if (quote.orderId) {
      return { ...this.serializeQuote(quote), alreadyConverted: true };
    }
    if (quote.items.length === 0 || quote.items.some((item) => !item.unitPrice || !item.totalPrice)) {
      throw new BadRequestException('No se puede convertir una cotización sin items con precio.');
    }

    const updated = await this.prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'converted_to_order',
        convertedAt: new Date(),
        updatedById: actor.sub,
      },
      include: { customer: true, order: true, items: true },
    });
    await this.audit(actor, 'quote.convert_requested', 'quote', quoteId, this.serializeQuote(quote), this.serializeQuote(updated), ipAddress, userAgent);
    return {
      ...this.serializeQuote(updated),
      operationalState: {
        status: 'manual_order_creation_required',
        message: 'La cotización quedó lista para conversión; no se inventó pedido ni inventario sin checkout real.',
      },
    };
  }

  @Permissions('quotes.write')
  @Post('quotes/:quoteId/cancel')
  cancelQuote(
    @Param('quoteId') quoteId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.transitionQuote(quoteId, actor, 'cancelled', 'quote.cancelled', ipAddress, userAgent);
  }

  private async transitionQuote(
    quoteId: string,
    actor: CurrentUser,
    status: QuoteStatus,
    action: string,
    ipAddress?: string,
    userAgent?: string,
    extra: Partial<Prisma.QuoteUncheckedUpdateInput> = {},
  ) {
    const current = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: { customer: true, order: true, items: true },
    });
    if (!current) {
      throw new NotFoundException('Cotización no encontrada.');
    }

    const valid: Record<QuoteStatus, QuoteStatus[]> = {
      requested: ['in_review', 'quoted', 'cancelled'],
      in_review: ['quoted', 'cancelled'],
      quoted: ['sent', 'accepted', 'rejected', 'cancelled', 'converted_to_order'],
      sent: ['accepted', 'rejected', 'expired', 'cancelled'],
      accepted: ['converted_to_order', 'cancelled'],
      rejected: [],
      expired: [],
      converted_to_order: [],
      cancelled: [],
    };
    if (!valid[current.status].includes(status) && current.status !== status) {
      throw new BadRequestException('Transición de cotización no permitida.');
    }

    const updated = await this.prisma.quote.update({
      where: { id: quoteId },
      data: { ...extra, status, updatedById: actor.sub } as Prisma.QuoteUncheckedUpdateInput,
      include: { customer: true, order: true, items: true },
    });
    await this.audit(actor, action, 'quote', quoteId, this.serializeQuote(current), this.serializeQuote(updated), ipAddress, userAgent);
    return this.serializeQuote(updated);
  }

  @Permissions('payments.read')
  @Get('payments')
  async listPayments(@Query() query: PaginationQuery & {
    status?: PaymentStatus;
    gateway?: string;
  }) {
    const { page, limit, skip } = this.pagination(query);
    const [total, payments] = await Promise.all([
      this.prisma.payment.count({
        where: { status: query.status, gateway: query.gateway },
      }),
      this.prisma.payment.findMany({
        where: { status: query.status, gateway: query.gateway },
        include: { order: true },
        orderBy: { createdAt: this.direction(query.direction) },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: payments.map((payment) => ({
        id: payment.id,
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        gateway: payment.gateway,
        status: payment.status,
        amount: payment.amount.toFixed(2),
        currency: payment.currency,
        providerReference: payment.gatewayReference,
        createdAt: payment.createdAt,
        updatedAt: payment.updatedAt,
      })),
      meta: { page, limit, total },
    };
  }

  @Permissions('payments.reconcile')
  @Post('payments/:paymentId/reconcile-cod')
  async reconcileCod(
    @Param('paymentId') paymentId: string,
    @Body() body: ReconcileCodBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Pago no encontrado.');
    }

    if (payment.gateway !== 'cash_on_delivery') {
      throw new BadRequestException('Solo se puede conciliar pago contra entrega en este flujo.');
    }

    if (payment.status === 'approved') {
      return { id: payment.id, status: payment.status, alreadyReconciled: true };
    }

    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'approved',
        gatewayReference: body.reference ?? payment.gatewayReference,
      },
    });

    await this.audit(
      actor,
      'payment.cod_reconciled',
      'payment',
      paymentId,
      { status: payment.status },
      { status: updated.status, note: body.note ?? null },
      ipAddress,
      userAgent,
    );

    return { id: updated.id, status: updated.status, updatedAt: updated.updatedAt };
  }

  @Permissions('payments.write')
  @Post('payments/:paymentId/refresh-status')
  async refreshPaymentStatus(@Param('paymentId') paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Pago no encontrado.');
    }

    return {
      id: payment.id,
      status: payment.status,
      refreshed: false,
      operationalState: {
        status: 'provider_not_configured',
        message: 'No se consultó proveedor externo porque PSE no está configurado.',
      },
    };
  }

  @Permissions('payments.read')
  @Get('payments/:paymentId/events')
  async getPaymentEvents(@Param('paymentId') paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Pago no encontrado.');
    }

    const events = await this.prisma.webhookReceipt.findMany({
      where: { gateway: payment.gateway },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      data: events.map((event) => ({
        id: event.id,
        gateway: event.gateway,
        providerEventId: event.externalEventId,
        processedAt: event.processedAt,
        receivedAt: event.createdAt,
      })),
    };
  }

  @Permissions('shipping.read')
  @Get('shipments')
  async listShipments(@Query() query: PaginationQuery & { status?: ShipmentStatus }) {
    const { page, limit, skip } = this.pagination(query);
    const search = query.search?.trim();
    const where = {
      status: query.status,
      OR: search
        ? [
            { trackingNumber: { contains: search, mode: 'insensitive' as const } },
            { routeNumber: { contains: search, mode: 'insensitive' as const } },
            { order: { orderNumber: { contains: search, mode: 'insensitive' as const } } },
            { customer: { fullName: { contains: search, mode: 'insensitive' as const } } },
          ]
        : undefined,
    };
    const [total, shipments] = await Promise.all([
      this.prisma.shipment.count({ where }),
      this.prisma.shipment.findMany({
        where,
        include: { customer: true, order: true, events: { orderBy: { occurredAt: 'desc' } } },
        orderBy: { createdAt: this.direction(query.direction) },
        skip,
        take: limit,
      }),
    ]);
    return {
      data: shipments.map((shipment) => this.serializeShipment(shipment)),
      meta: { page, limit, total },
      operationalState: total === 0
        ? {
            status: 'empty',
            message: 'No hay envíos persistentes todavía. No se inventan guías ni tracking.',
          }
        : undefined,
    };
  }

  @Permissions('shipping.read')
  @Get('shipments/:shipmentId')
  async getShipment(@Param('shipmentId') shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { customer: true, order: true, events: { orderBy: { occurredAt: 'desc' } } },
    });
    if (!shipment) {
      throw new NotFoundException('Envío no encontrado.');
    }
    return this.serializeShipment(shipment);
  }

  @Permissions('shipping.quote')
  @Post('shipments/:orderId/quote')
  async quoteShipment(
    @Param('orderId') orderId: string,
    @Body() body: ShipmentRequestBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const provider = process.env.SHIPPING_PROVIDER ?? 'none';
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Pedido no encontrado.');
    }
    const customer = await this.ensureCustomerFromOrder(order);
    const addressSnapshot = (body.addressSnapshot ?? {
      address: order.shippingAddress,
      city: order.shippingCity,
      customer: this.maskEmail(order.customerEmail),
    }) as Prisma.InputJsonValue;
    const packageSnapshot = (body.packageSnapshot ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull;
    const shipment = await this.prisma.shipment.upsert({
      where: { orderId_provider: { orderId, provider } },
      create: {
        id: uuidv7(),
        orderId,
        customerId: customer.id,
        provider,
        status: provider === 'none' ? 'pending_provider' : 'pending_quote',
        addressSnapshot,
        packageSnapshot,
        createdById: actor.sub,
        updatedById: actor.sub,
      },
      update: {
        status: provider === 'none' ? 'pending_provider' : 'pending_quote',
        addressSnapshot,
        packageSnapshot,
        updatedById: actor.sub,
      },
      include: { customer: true, order: true, events: true },
    });
    await this.prisma.shipmentEvent.create({
      data: {
        id: uuidv7(),
        shipmentId: shipment.id,
        status: shipment.status,
        description: provider === 'none'
          ? 'Cotización logística bloqueada: transportadora no configurada.'
          : 'Solicitud de cotización logística preparada para provider real.',
        occurredAt: new Date(),
      },
    });
    await this.audit(actor, 'shipment.quote_requested', 'shipment', shipment.id, null, this.serializeShipment(shipment), ipAddress, userAgent);

    if (provider === 'none') {
      return {
        ...this.serializeShipment(shipment),
        quoted: false,
        trackingNumber: null,
        routeNumber: null,
        operationalState: {
          status: 'provider_not_configured',
          message: 'Transportadora no configurada. No se inventó tarifa, guía ni tracking.',
        },
      };
    }

    return this.serializeShipment(shipment);
  }

  @Permissions('shipping.create_guide')
  @Post('shipments/:orderId/create')
  async createShipment(
    @Param('orderId') orderId: string,
    @Body() body: ShipmentRequestBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const provider = process.env.SHIPPING_PROVIDER ?? 'none';
    if (provider === 'none') {
      const skipped = await this.quoteShipment(orderId, body, actor, ipAddress, userAgent);
      return {
        ...skipped,
        created: false,
        operationalState: {
          status: 'provider_not_configured',
          message: 'createShipment bloqueado: no hay transportadora configurada ni credenciales reales.',
        },
      };
    }
    throw new BadRequestException('Provider de envío activo requiere adapter real antes de crear guías.');
  }

  @Permissions('shipping.cancel')
  @Post('shipments/:shipmentId/cancel')
  async cancelShipment(
    @Param('shipmentId') shipmentId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.updateShipmentStatus(shipmentId, actor, 'cancelled', 'shipment.cancelled', ipAddress, userAgent);
  }

  @Permissions('tracking.write')
  @Post('shipments/:shipmentId/sync-status')
  async syncShipment(
    @Param('shipmentId') shipmentId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { customer: true, order: true, events: true },
    });
    if (!shipment) {
      throw new NotFoundException('Envío no encontrado.');
    }
    if (shipment.provider === 'none') {
      await this.prisma.shipmentEvent.create({
        data: {
          id: uuidv7(),
          shipmentId,
          status: shipment.status,
          description: 'Sync omitido: proveedor de envío no configurado.',
          occurredAt: new Date(),
        },
      });
      await this.audit(actor, 'shipment.sync_skipped', 'shipment', shipmentId, null, { provider: 'none' }, ipAddress, userAgent);
      return {
        ...this.serializeShipment(shipment),
        synced: false,
        operationalState: {
          status: 'provider_not_configured',
          message: 'No se consultó tracking porque no hay provider real configurado.',
        },
      };
    }
    throw new BadRequestException('Sync requiere adapter real del provider configurado.');
  }

  @Permissions('tracking.read')
  @Get('shipments/:shipmentId/events')
  async getShipmentEvents(@Param('shipmentId') shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) {
      throw new NotFoundException('Envío no encontrado.');
    }
    const events = await this.prisma.shipmentEvent.findMany({
      where: { shipmentId },
      orderBy: { occurredAt: 'desc' },
    });
    return { data: events };
  }

  private async updateShipmentStatus(
    shipmentId: string,
    actor: CurrentUser,
    status: ShipmentStatus,
    action: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const current = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { customer: true, order: true, events: true },
    });
    if (!current) {
      throw new NotFoundException('Envío no encontrado.');
    }
    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status, updatedById: actor.sub },
      include: { customer: true, order: true, events: true },
    });
    await this.prisma.shipmentEvent.create({
      data: {
        id: uuidv7(),
        shipmentId,
        status,
        description: `Estado actualizado a ${status}.`,
        occurredAt: new Date(),
      },
    });
    await this.audit(actor, action, 'shipment', shipmentId, this.serializeShipment(current), this.serializeShipment(updated), ipAddress, userAgent);
    return this.serializeShipment(updated);
  }

  @Permissions('customers.read')
  @Get('customers')
  async listCustomers(@Query() query: PaginationQuery) {
    const { page, limit, skip } = this.pagination(query);
    const search = query.search?.trim();
    const recentOrders = await this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    for (const order of recentOrders) {
      await this.ensureCustomerFromOrder(order);
    }

    const where = {
      OR: search
        ? [
            { fullName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
          ]
        : undefined,
    };

    const [total, customers] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        orderBy: { lastOrderAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);
    const orderStats = await this.prisma.order.groupBy({
      by: ['customerEmail'],
      _count: { _all: true },
      _sum: { grandTotal: true },
      where: { customerEmail: { in: customers.map((customer) => customer.email) } },
    });
    const statsByEmail = new Map(orderStats.map((row) => [row.customerEmail.toLowerCase(), row]));

    return {
      data: customers.map((customer) => ({
        ...this.publicCustomer(customer),
        ordersCount: statsByEmail.get(customer.email)?._count._all ?? 0,
        totalSpent: statsByEmail.get(customer.email)?._sum.grandTotal?.toFixed(2) ?? '0.00',
      })),
      meta: { page, limit, total },
    };
  }

  @Permissions('customers.read')
  @Get('customers/:customerId')
  async getCustomer(@Param('customerId') customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { consents: { orderBy: { createdAt: 'desc' } } },
    });

    if (!customer) {
      throw new NotFoundException('Cliente no encontrado.');
    }

    const orders = await this.prisma.order.findMany({
      where: { customerEmail: customer.email },
      include: { payments: true, orderItems: { include: { variant: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      ...this.publicCustomer(customer),
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        grandTotal: order.grandTotal.toFixed(2),
        createdAt: order.createdAt,
      })),
      consents: customer.consents.map((consent) => ({
        id: consent.id,
        type: consent.type,
        accepted: consent.accepted,
        source: consent.source,
        createdAt: consent.createdAt,
      })),
    };
  }

  @Permissions('customers.notes.write')
  @Patch('customers/:customerId')
  async updateCustomer(
    @Param('customerId') customerId: string,
    @Body() body: CustomerUpdateBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const current = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!current) {
      throw new NotFoundException('Cliente no encontrado.');
    }
    const email = this.normalizeEmail(body.email);
    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        fullName: body.fullName?.trim() ?? current.fullName,
        email: email ?? current.email,
        phone: body.phone?.trim() ?? current.phone,
        defaultAddress: body.defaultAddress?.trim() ?? current.defaultAddress,
        city: body.city?.trim() ?? current.city,
        department: body.department?.trim() ?? current.department,
        country: body.country?.trim() ?? current.country,
        marketingConsent: body.marketingConsent ?? current.marketingConsent,
        dataTreatmentConsent: body.dataTreatmentConsent ?? current.dataTreatmentConsent,
      },
    });
    await this.audit(actor, 'customer.updated', 'customer', customerId, this.publicCustomer(current), this.publicCustomer(updated), ipAddress, userAgent);
    return this.publicCustomer(updated);
  }

  @Permissions('customers.read')
  @Get('customers/:customerId/orders')
  async getCustomerOrders(@Param('customerId') customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado.');
    }
    const orders = await this.prisma.order.findMany({
      where: { customerEmail: customer.email },
      orderBy: { createdAt: 'desc' },
    });
    return {
      data: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        grandTotal: order.grandTotal.toFixed(2),
        createdAt: order.createdAt,
      })),
    };
  }

  @Permissions('customers.read')
  @Get('customers/:customerId/quotes')
  async getCustomerQuotes(@Param('customerId') customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado.');
    }
    const quotes = await this.prisma.quote.findMany({
      where: { customerId },
      include: { customer: true, order: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
    return { customer: this.publicCustomer(customer), data: quotes.map((quote) => this.serializeQuote(quote)) };
  }

  @Permissions('customers.read_sensitive')
  @Post('customers/:customerId/view-sensitive')
  async viewSensitiveCustomer(
    @Param('customerId') customerId: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      throw new NotFoundException('Cliente no encontrado.');
    }
    await this.audit(actor, 'customer.view_sensitive', 'customer', customerId, null, { reason: 'admin_sensitive_view' }, ipAddress, userAgent);
    return this.privateCustomer(customer);
  }

  @Permissions('customers.export')
  @Post('customers/export')
  async exportCustomers(
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    await this.audit(actor, 'customer.export_blocked', 'customer', 'export', null, { exported: false }, ipAddress, userAgent);
    return {
      exported: false,
      operationalState: {
        status: 'blocked',
        message: 'Exportación bloqueada hasta definir permiso dedicado y política aprobada de tratamiento de datos.',
      },
    };
  }

  @Permissions('prices.history.read')
  @Get('prices/history')
  async getPriceHistory(@Query('variantId') variantId?: string) {
    const auditLogs = await this.prisma.auditLog.findMany({
      where: {
        entityType: 'variant',
        ...(variantId ? { entityId: variantId } : {}),
        action: { in: ['variant.price_updated', 'variant.updated'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      data: auditLogs.map((log) => ({
        id: log.id,
        variantId: log.entityId,
        beforeData: log.beforeData,
        afterData: log.afterData,
        actorUserId: log.actorUserId,
        createdAt: log.createdAt,
      })),
    };
  }

  @Permissions('prices.write')
  @Post('prices/update')
  async updatePrice(
    @Body() body: PriceUpdateBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.persistPriceUpdate(body.variantId, body.price, body.reason, actor, ipAddress, userAgent);
  }

  @Permissions('prices.write')
  @Patch('prices/:variantId')
  async patchPrice(
    @Param('variantId') variantId: string,
    @Body() body: Omit<PriceUpdateBody, 'variantId'>,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.persistPriceUpdate(variantId, body.price, body.reason, actor, ipAddress, userAgent);
  }

  private async persistPriceUpdate(
    variantId: string | undefined,
    price: string | number | undefined,
    reason: string | undefined,
    actor: CurrentUser,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (!variantId || price === undefined) {
      throw new BadRequestException('Variante y precio son obligatorios.');
    }

    const parsed = Number(price);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new BadRequestException('El precio debe ser mayor a cero.');
    }

    if (!reason?.trim()) {
      throw new BadRequestException('El motivo del cambio de precio es obligatorio.');
    }

    const current = await this.prisma.variant.findUnique({ where: { id: variantId } });
    if (!current) {
      throw new NotFoundException('Variante no encontrada.');
    }

    const updated = await this.prisma.variant.update({
      where: { id: variantId },
      data: { price: parsed },
    });

    await this.audit(
      actor,
      'variant.price_updated',
      'variant',
      variantId,
      { price: current.price.toFixed(2) },
      { price: updated.price.toFixed(2), reason: reason.trim() },
      ipAddress,
      userAgent,
    );

    return { id: updated.id, sku: updated.sku, price: updated.price.toFixed(2) };
  }

  @Permissions('inventory.read')
  @Get('inventory/history')
  async getInventoryHistory(@Query('variantId') variantId?: string) {
    const rows = await this.prisma.stockMovement.findMany({
      where: { variantId },
      include: { warehouse: true, variant: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        variantId: row.variantId,
        sku: row.variant.sku,
        warehouse: row.warehouse.name,
        type: row.movementType,
        quantity: row.quantity,
        reason: row.reason,
        reference: `${row.referenceType}:${row.referenceId}`,
        createdAt: row.createdAt,
      })),
    };
  }

  @Permissions('legal.read')
  @Get('content/legal')
  async listLegalContent() {
    await this.ensureDefaultLegalVersions();
    const rows = await this.prisma.legalVersion.findMany({
      orderBy: [{ pageKey: 'asc' }, { version: 'desc' }],
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        pageKey: row.pageKey,
        title: row.title,
        slug: row.slug,
        status: row.status,
        version: row.version,
        checklistComplete: this.legalChecklistComplete(row.pageKey, row.checklist as Record<string, boolean> | null),
        publishedAt: row.publishedAt,
        updatedAt: row.updatedAt,
      })),
    };
  }

  @Permissions('legal.read')
  @Get('content/legal/:pageKey')
  async getLegalContent(@Param('pageKey') pageKey: string) {
    await this.ensureDefaultLegalVersions();
    const rows = await this.prisma.legalVersion.findMany({
      where: { pageKey },
      orderBy: { version: 'desc' },
    });
    if (rows.length === 0) {
      throw new NotFoundException('Página legal no encontrada.');
    }
    return {
      pageKey,
      published: rows.find((row) => row.status === 'published') ?? null,
      draft: rows.find((row) => row.status === 'draft') ?? rows[0],
      history: rows,
      requirements: LEGAL_PAGE_REQUIREMENTS[pageKey] ?? [],
    };
  }

  @Permissions('legal.write')
  @Post('content/legal')
  async createLegalContent(
    @Body() body: LegalUpdateBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const pageKey = body.pageKey?.trim();
    const title = body.title?.trim();
    const slug = body.slug?.trim() ?? pageKey;
    if (!pageKey || !title || !slug) {
      throw new BadRequestException('pageKey, title y slug son obligatorios.');
    }
    const latest = await this.prisma.legalVersion.findFirst({
      where: { pageKey },
      orderBy: { version: 'desc' },
    });
    const created = await this.prisma.legalVersion.create({
      data: {
        id: uuidv7(),
        pageKey,
        title,
        slug,
        content: this.sanitizeLegalContent(body.content ?? { sections: [], pendingPlaceholders: true }) as Prisma.InputJsonValue,
        checklist: (body.checklist ?? {}) as Prisma.InputJsonValue,
        status: 'draft',
        version: (latest?.version ?? 0) + 1,
        submittedById: actor.sub,
      },
    });
    await this.audit(actor, 'legal.created', 'legalVersion', created.id, null, created, ipAddress, userAgent);
    return created;
  }

  @Permissions('legal.write')
  @Patch('content/legal/:id')
  async updateLegalContent(
    @Param('id') id: string,
    @Body() body: LegalUpdateBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const current = await this.prisma.legalVersion.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Contenido legal no encontrado.');
    }
    if (current.status === 'published' || current.status === 'archived') {
      throw new BadRequestException('No se edita una versión publicada o archivada; cree nueva versión.');
    }

    const updated = await this.prisma.legalVersion.update({
      where: { id },
      data: {
        title: body.title ?? current.title,
        slug: body.slug ?? current.slug,
        content: this.sanitizeLegalContent(body.content ?? (body.body ? { text: body.body } : current.content)) as Prisma.InputJsonValue,
        checklist: (body.checklist ?? current.checklist ?? {}) as Prisma.InputJsonValue,
        status: body.status ?? current.status,
      },
    });

    await this.audit(
      actor,
      'legal.updated',
      'legalVersion',
      id,
      current,
      updated,
      ipAddress,
      userAgent,
    );

    return updated;
  }

  @Permissions('legal.review')
  @Post('content/legal/:id/submit-review')
  async legalSubmitReview(
    @Param('id') id: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.setLegalWorkflow(id, actor, 'pending_legal_review', ipAddress, userAgent);
  }

  @Permissions('legal.approve')
  @Post('content/legal/:id/approve')
  async legalApprove(
    @Param('id') id: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.setLegalWorkflow(id, actor, 'approved', ipAddress, userAgent);
  }

  @Permissions('legal.publish')
  @Post('content/legal/:id/publish')
  async legalPublish(
    @Param('id') id: string,
    @Body() body: LegalUpdateBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const current = await this.prisma.legalVersion.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Contenido legal no encontrado.');
    }
    if (current.status !== 'approved') {
      throw new BadRequestException('El contenido legal requiere aprobación antes de publicar.');
    }
    const checklist = current.checklist as Record<string, boolean> | null;
    if (!this.legalChecklistComplete(current.pageKey, checklist) && !body.legalOverride) {
      throw new BadRequestException('Checklist legal crítico incompleto. Publicación bloqueada.');
    }
    const contentText = JSON.stringify(current.content);
    if (LEGAL_PLACEHOLDER_PATTERN.test(contentText) && !body.legalOverride) {
      throw new BadRequestException('Existen placeholders legales pendientes. Requiere revisión o legal_override auditado.');
    }

    await this.prisma.legalVersion.updateMany({
      where: { pageKey: current.pageKey, status: 'published' },
      data: { status: 'archived' },
    });
    const updated = await this.prisma.legalVersion.update({
      where: { id },
      data: {
        status: 'published',
        publishedAt: new Date(),
        publishedById: actor.sub,
      },
    });
    await this.audit(actor, body.legalOverride ? 'legal.published_with_override' : 'legal.published', 'legalVersion', id, current, updated, ipAddress, userAgent);
    return updated;
  }

  @Permissions('legal.write')
  @Post('content/legal/:id/archive')
  async legalArchive(
    @Param('id') id: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.setLegalWorkflow(id, actor, 'archived', ipAddress, userAgent);
  }

  private async setLegalWorkflow(
    id: string,
    actor: CurrentUser,
    workflowStatus: LegalVersionStatus,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const current = await this.prisma.legalVersion.findUnique({ where: { id } });
    if (!current) {
      throw new NotFoundException('Contenido legal no encontrado.');
    }
    const updated = await this.prisma.legalVersion.update({
      where: { id },
      data: {
        status: workflowStatus,
        submittedAt: workflowStatus === 'pending_legal_review' ? new Date() : current.submittedAt,
        approvedAt: workflowStatus === 'approved' ? new Date() : current.approvedAt,
        submittedById: workflowStatus === 'pending_legal_review' ? actor.sub : current.submittedById,
        approvedById: workflowStatus === 'approved' ? actor.sub : current.approvedById,
      },
    });
    await this.audit(actor, `legal.${workflowStatus}`, 'legalVersion', id, current, updated, ipAddress, userAgent);
    return updated;
  }

  private async ensureDefaultLegalVersions() {
    for (const [pageKey, title] of DEFAULT_LEGAL_PAGES) {
      const exists = await this.prisma.legalVersion.findFirst({ where: { pageKey } });
      if (exists) continue;
      await this.prisma.legalVersion.create({
        data: {
          id: uuidv7(),
          pageKey,
          title,
          slug: pageKey,
          version: 1,
          status: 'draft',
          content: {
            notice: 'Documento base pendiente de revisión legal. No publicado como versión legal final.',
            placeholders: [
              '[RAZÓN SOCIAL PENDIENTE]',
              '[NIT PENDIENTE]',
              '[CORREO DE PRIVACIDAD PENDIENTE]',
              '[CANAL DE RECLAMOS PENDIENTE]',
            ],
          },
          checklist: Object.fromEntries((LEGAL_PAGE_REQUIREMENTS[pageKey] ?? []).map((item) => [item, false])),
        },
      });
    }
  }

  @Permissions('footer.read')
  @Get('content/footer')
  async getFooterContent() {
    await this.ensureDefaultFooterRevision();
    const revisions = await this.prisma.footerRevision.findMany({
      include: { links: { orderBy: { order: 'asc' } } },
      orderBy: { version: 'desc' },
      take: 20,
    });

    return {
      data: revisions[0] ?? null,
      published: revisions.find((revision) => revision.status === 'published') ?? null,
      history: revisions,
    };
  }

  @Permissions('footer.read')
  @Get('content/footer/:id')
  async getFooterRevision(@Param('id') id: string) {
    const revision = await this.prisma.footerRevision.findUnique({
      where: { id },
      include: { links: { orderBy: { order: 'asc' } } },
    });
    if (!revision) {
      throw new NotFoundException('Revisión de footer no encontrada.');
    }
    return revision;
  }

  @Permissions('footer.write')
  @Post('content/footer')
  async createFooterContent(
    @Body() body: FooterUpdateBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    this.validateFooterGroups(body.groups);
    const version = await this.nextSequence('footer', 'footerRevision') as number;
    const created = await this.prisma.footerRevision.create({
      data: {
        id: uuidv7(),
        version,
        status: 'draft',
        groupsJson: body.groups as Prisma.InputJsonValue,
        submittedById: actor.sub,
        links: {
          create: body.groups!.flatMap((group, groupIndex) =>
            group.links.map((link, linkIndex) => ({
              id: uuidv7(),
              group: group.title,
              label: link.label,
              href: link.href,
              order: groupIndex * 100 + linkIndex,
              isVisible: link.isVisible ?? true,
            })),
          ),
        },
      },
      include: { links: true },
    });

    await this.audit(
      actor,
      'footer.created',
      'footerRevision',
      created.id,
      null,
      created,
      ipAddress,
      userAgent,
    );

    return created;
  }

  @Permissions('footer.write')
  @Patch('content/footer/:id')
  async updateFooterContent(
    @Param('id') id: string,
    @Body() body: FooterUpdateBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    this.validateFooterGroups(body.groups);
    const current = await this.prisma.footerRevision.findUnique({ where: { id }, include: { links: true } });
    if (!current) {
      throw new NotFoundException('Revisión de footer no encontrada.');
    }
    if (current.status === 'published' || current.status === 'archived') {
      throw new BadRequestException('No se edita una revisión publicada o archivada.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.footerLink.deleteMany({ where: { revisionId: id } });
      return tx.footerRevision.update({
        where: { id },
        data: {
          groupsJson: body.groups as Prisma.InputJsonValue,
          links: {
            create: body.groups!.flatMap((group, groupIndex) =>
              group.links.map((link, linkIndex) => ({
                id: uuidv7(),
                group: group.title,
                label: link.label,
                href: link.href,
                order: groupIndex * 100 + linkIndex,
                isVisible: link.isVisible ?? true,
              })),
            ),
          },
        },
        include: { links: true },
      });
    });
    await this.audit(actor, 'footer.updated', 'footerRevision', id, current, updated, ipAddress, userAgent);
    return updated;
  }

  @Permissions('footer.write')
  @Post('content/footer/:id/submit-review')
  async footerSubmitReview(
    @Param('id') id: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.setFooterWorkflow(id, actor, 'pending_legal_review', ipAddress, userAgent);
  }

  @Permissions('footer.publish')
  @Post('content/footer/:id/approve')
  async footerApprove(
    @Param('id') id: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.setFooterWorkflow(id, actor, 'approved', ipAddress, userAgent);
  }

  @Permissions('footer.publish')
  @Post('content/footer/:id/publish')
  async footerPublish(
    @Param('id') id: string,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const current = await this.prisma.footerRevision.findUnique({ where: { id }, include: { links: true } });
    if (!current) {
      throw new NotFoundException('Revisión de footer no encontrada.');
    }
    if (current.status !== 'approved') {
      throw new BadRequestException('El footer requiere aprobación antes de publicar.');
    }
    this.validateFooterGroups(current.groupsJson as FooterUpdateBody['groups']);
    await this.prisma.footerRevision.updateMany({
      where: { status: 'published' },
      data: { status: 'archived' },
    });
    const updated = await this.prisma.footerRevision.update({
      where: { id },
      data: { status: 'published', publishedAt: new Date(), publishedById: actor.sub },
      include: { links: true },
    });
    await this.audit(actor, 'footer.published', 'footerRevision', id, current, updated, ipAddress, userAgent);
    return updated;
  }

  private async setFooterWorkflow(
    id: string,
    actor: CurrentUser,
    status: FooterRevisionStatus,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const current = await this.prisma.footerRevision.findUnique({ where: { id }, include: { links: true } });
    if (!current) {
      throw new NotFoundException('Revisión de footer no encontrada.');
    }
    const updated = await this.prisma.footerRevision.update({
      where: { id },
      data: {
        status,
        submittedAt: status === 'pending_legal_review' ? new Date() : current.submittedAt,
        approvedAt: status === 'approved' ? new Date() : current.approvedAt,
        submittedById: status === 'pending_legal_review' ? actor.sub : current.submittedById,
        approvedById: status === 'approved' ? actor.sub : current.approvedById,
      },
      include: { links: true },
    });
    await this.audit(actor, `footer.${status}`, 'footerRevision', id, current, updated, ipAddress, userAgent);
    return updated;
  }

  private async ensureDefaultFooterRevision() {
    const exists = await this.prisma.footerRevision.findFirst();
    if (exists) return;
    await this.prisma.footerRevision.create({
      data: {
        id: uuidv7(),
        version: 1,
        status: 'draft',
        groupsJson: DEFAULT_FOOTER_GROUPS as Prisma.InputJsonValue,
        links: {
          create: DEFAULT_FOOTER_GROUPS.flatMap((group, groupIndex) =>
            group.links.map((link, linkIndex) => ({
              id: uuidv7(),
              group: group.title,
              label: link.label,
              href: link.href,
              order: groupIndex * 100 + linkIndex,
              isVisible: true,
            })),
          ),
        },
      },
    });
  }

  @Permissions('settings.read')
  @Get('settings')
  async getSettings() {
    const rows = await this.prisma.adminSetting.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] });
    const persisted = rows.map((row) => ({
      id: row.id,
      key: row.key,
      category: row.category,
      isSecret: row.isSecret,
      isEditableFromAdmin: row.isEditableFromAdmin,
      value: row.isSecret ? { configured: row.valueJson !== null } : row.valueJson,
      updatedAt: row.updatedAt,
    }));
    return {
      persisted,
      general: {
        storeName: process.env.STORE_NAME ?? 'DistriTools JL',
        currency: process.env.DEFAULT_CURRENCY ?? 'COP',
      },
      payments: {
        codEnabled: process.env.CASH_ON_DELIVERY_ENABLED !== 'false',
        pseProvider: process.env.PAYMENT_PSE_PROVIDER ?? 'none',
        wompiConfigured: Boolean(process.env.WOMPI_PRIVATE_KEY),
        payuConfigured: Boolean(process.env.PAYU_API_KEY),
      },
      shipping: {
        provider: process.env.SHIPPING_PROVIDER ?? 'internal',
        coordinadoraConfigured: Boolean(process.env.COORDINADORA_CLIENT_SECRET),
        servientregaConfigured: Boolean(process.env.SERVIENTREGA_CLIENT_SECRET),
        ninetyNineEnviosConfigured: Boolean(
          process.env.NINETY_NINE_ENVIOS_API_BASE_URL
          && process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL
          && process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD,
        ),
        ninetyNineEnviosEnv: process.env.NINETY_NINE_ENVIOS_ENV ?? 'sandbox',
        ninetyNineEnviosCodEnabled: process.env.NINETY_NINE_ENVIOS_ENABLE_COD === 'true',
        defaultBranchCodeConfigured: Boolean(process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE),
        defaultOriginDaneConfigured: Boolean(process.env.NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_DANE_CODE),
        defaultPdfType: process.env.NINETY_NINE_ENVIOS_DEFAULT_PDF_TYPE ?? '2',
      },
      notifications: {
        emailProvider: process.env.EMAIL_PROVIDER ?? 'none',
        whatsappProvider: process.env.WHATSAPP_PROVIDER ?? 'none',
      },
      legal: {
        reviewStatus: 'pending_real_company_data',
      },
      featureFlags: this.buildFeatureFlags(),
      moduleReadiness: this.buildModuleReadiness(),
      productionReadiness: this.buildProductionReadiness(),
    };
  }

  @Permissions('settings.read')
  @Get('settings/providers')
  getProviderSettings() {
    const paymentProvider = process.env.PAYMENT_PROVIDER ?? 'none';
    const pseProvider = process.env.PAYMENT_PSE_PROVIDER ?? 'none';
    const shippingProvider = process.env.SHIPPING_PROVIDER ?? 'internal';
    const notificationProvider = process.env.NOTIFICATION_PROVIDER ?? 'none';
    const ninetyNineEnviosConfigured = Boolean(
      process.env.NINETY_NINE_ENVIOS_API_BASE_URL
      && process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL
      && process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD,
    );
    const mock99Allowed = !this.isProductionEnv()
      || process.env.ALLOW_MOCK_99ENVIOS_IN_PRODUCTION === 'true';
    const shippingReady = shippingProvider === '99envios'
      ? ninetyNineEnviosConfigured
      : shippingProvider === 'mock_99envios'
        ? mock99Allowed
        : shippingProvider !== 'internal' && shippingProvider !== 'none';
    return {
      payments: {
        provider: paymentProvider,
        pseProvider,
        ready: paymentProvider !== 'none' && pseProvider !== 'none',
        configured: {
          wompi: Boolean(process.env.WOMPI_PRIVATE_KEY),
          payu: Boolean(process.env.PAYU_API_KEY),
        },
      },
      shipping: {
        provider: shippingProvider,
        ready: shippingReady,
        configured: {
          coordinadora: Boolean(process.env.COORDINADORA_CLIENT_SECRET),
          servientrega: Boolean(process.env.SERVIENTREGA_CLIENT_SECRET),
          ninetyNineEnvios: ninetyNineEnviosConfigured,
          authEmail: Boolean(process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL),
          authPassword: Boolean(process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD),
          integrationToken: Boolean(process.env.NINETY_NINE_ENVIOS_INTEGRATION_TOKEN),
          integrationId: Boolean(process.env.NINETY_NINE_ENVIOS_INTEGRATION_ID),
          branchCode: Boolean(process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE),
          originDane: Boolean(process.env.NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_DANE_CODE),
        },
        mode: shippingProvider === '99envios' && !ninetyNineEnviosConfigured
          ? 'pending_provider'
          : shippingProvider,
        env: process.env.NINETY_NINE_ENVIOS_ENV ?? 'sandbox',
        cashOnDelivery: process.env.NINETY_NINE_ENVIOS_ENABLE_COD === 'true',
      },
      notifications: {
        provider: notificationProvider,
        ready: notificationProvider !== 'none',
        configured: {
          email: Boolean(process.env.EMAIL_PROVIDER && process.env.EMAIL_PROVIDER !== 'none'),
          whatsapp: Boolean(process.env.WHATSAPP_PROVIDER && process.env.WHATSAPP_PROVIDER !== 'none'),
        },
      },
      featureFlags: this.buildFeatureFlags(),
      moduleReadiness: this.buildModuleReadiness(),
      productionReadiness: this.buildProductionReadiness(),
      productionGuards: {
        nullProvidersBlocked: this.isProductionEnv()
          ? paymentProvider !== 'none' && shippingReady && notificationProvider !== 'none'
          : false,
      },
    };
  }

  @Permissions('settings.write')
  @Post('settings/providers/validate')
  validateProviderSettings() {
    const providers = this.getProviderSettings();
    const failures: string[] = [];
    if (this.isProductionEnv()) {
      if ((process.env.PAYMENT_PROVIDER ?? 'none') === 'none') failures.push('PAYMENT_PROVIDER none en producción.');
      if ((process.env.SHIPPING_PROVIDER ?? 'none') === 'none') failures.push('SHIPPING_PROVIDER none en producción.');
      if ((process.env.NOTIFICATION_PROVIDER ?? 'none') === 'none') failures.push('NOTIFICATION_PROVIDER none en producción.');
    }
    if ((process.env.PAYMENT_PROVIDER ?? 'none') === 'wompi' && !process.env.WOMPI_PRIVATE_KEY) {
      failures.push('Wompi activo sin WOMPI_PRIVATE_KEY.');
    }
    if ((process.env.PAYMENT_PROVIDER ?? 'none') === 'payu' && !process.env.PAYU_API_KEY) {
      failures.push('PayU activo sin PAYU_API_KEY.');
    }
    if ((process.env.SHIPPING_PROVIDER ?? 'none') === 'coordinadora' && !process.env.COORDINADORA_CLIENT_SECRET) {
      failures.push('Coordinadora activo sin credenciales.');
    }
    if ((process.env.SHIPPING_PROVIDER ?? 'none') === 'servientrega' && !process.env.SERVIENTREGA_CLIENT_SECRET) {
      failures.push('Servientrega activo sin credenciales.');
    }
    if ((process.env.SHIPPING_PROVIDER ?? 'none') === '99envios') {
      const configured = Boolean(
        process.env.NINETY_NINE_ENVIOS_API_BASE_URL
        && process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL
        && process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD,
      );
      if (!configured) {
        failures.push('99 Envíos activo sin base URL, email y password oficiales.');
      }
    }
    if (
      this.isProductionEnv()
      && (process.env.SHIPPING_PROVIDER ?? 'none') === 'mock_99envios'
      && process.env.ALLOW_MOCK_99ENVIOS_IN_PRODUCTION !== 'true'
    ) {
      failures.push('mock_99envios bloqueado en producción.');
    }
    return { valid: failures.length === 0, failures, providers };
  }

  @Permissions('settings.write')
  @Patch('settings')
  async updateSettings(
    @Body() body: SettingsUpdateBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const sanitized = this.sanitizeSettings(body as Record<string, unknown>);
    for (const [category, values] of Object.entries(sanitized)) {
      if (!values || typeof values !== 'object' || Array.isArray(values)) continue;
      for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
        const normalizedKey = `${category}.${key}`;
        const isSecret = normalizedKey.toLowerCase().includes('secret') ||
          normalizedKey.toLowerCase().includes('token') ||
          normalizedKey.toLowerCase().includes('private') ||
          normalizedKey.toLowerCase().includes('key');
        await this.prisma.adminSetting.upsert({
          where: { key: normalizedKey },
          create: {
            id: uuidv7(),
            key: normalizedKey,
            category: category as AdminSettingCategory,
            valueJson: isSecret ? { configured: false } : value as Prisma.InputJsonValue,
            isSecret,
            isEditableFromAdmin: !isSecret,
            updatedById: actor.sub,
          },
          update: {
            valueJson: isSecret ? { configured: true } : value as Prisma.InputJsonValue,
            isSecret,
            isEditableFromAdmin: !isSecret,
            updatedById: actor.sub,
          },
        });
      }
    }
    await this.audit(
      actor,
      'settings.updated',
      'settings',
      'runtime',
      null,
      sanitized,
      ipAddress,
      userAgent,
    );

    return {
      updated: true,
      acceptedForReview: true,
      settings: sanitized,
      operationalState: {
        status: 'requires_secure_secret_flow',
        message: 'No se escribieron variables sensibles desde el frontend.',
      },
    };
  }
}
