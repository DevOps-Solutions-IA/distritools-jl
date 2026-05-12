import { ConflictException, Injectable } from '@nestjs/common';
import { NullShippingAdapter } from 'src/modules/shipping/infrastructure/providers/null-shipping.adapter';
import type {
  CreateShipmentInput,
  ShipmentQuote,
  ShipmentQuoteInput,
  ShipmentResult,
  ShippingLabelInput,
  ShippingProviderPort,
} from 'src/modules/shipping/application/ports/shipping-provider.port';

type JsonRecord = Record<string, unknown>;

const DANE_PATTERN = /^[0-9]{8}$/;
const DOCUMENTED_CARRIERS = ['interrapidisimo', 'tcc', 'servientrega', 'coordinadora', 'envia'];
const QUOTE_LIMIT = 300;
const QUOTE_WINDOW_MS = 60 * 60 * 1000;
const quoteWindows = new Map<string, { startedAt: number; used: number; blockedUntil: number | null; retryAfter: string | null }>();

export class NinetyNineEnviosError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly safeDetails: JsonRecord | null = null,
  ) {
    super(message);
  }
}

function config() {
  return {
    baseUrl: (process.env.NINETY_NINE_ENVIOS_API_BASE_URL || 'https://integration.99envios.app').replace(/\/$/, ''),
    email: process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL,
    password: process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD,
    integrationToken: process.env.NINETY_NINE_ENVIOS_INTEGRATION_TOKEN,
    integrationId: process.env.NINETY_NINE_ENVIOS_INTEGRATION_ID,
    branchCode: process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE,
    originDaneCode: process.env.NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_DANE_CODE,
    pdfType: process.env.NINETY_NINE_ENVIOS_DEFAULT_PDF_TYPE === '1' ? 1 : 2,
    codEnabled: process.env.NINETY_NINE_ENVIOS_ENABLE_COD === 'true',
    seguro99: process.env.NINETY_NINE_ENVIOS_DEFAULT_SEGURO99 === 'true',
    seguro99plus: process.env.NINETY_NINE_ENVIOS_DEFAULT_SEGURO99PLUS === 'true',
  };
}

function hasCredentials() {
  const env = config();
  return Boolean(env.baseUrl && env.email && env.password);
}

function assertDane(value: string | undefined, label: string) {
  if (!value || !DANE_PATTERN.test(value)) {
    throw new ConflictException(`${label} debe ser un código DANE de 8 dígitos.`);
  }
}

function assertPositive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ConflictException(`${label} debe ser mayor que cero.`);
  }
}

function formatDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${date.getFullYear()}`;
}

function redact(input: unknown): JsonRecord | null {
  if (!input || typeof input !== 'object') return null;
  const output: JsonRecord = {};
  for (const [key, value] of Object.entries(input as JsonRecord)) {
    if (/token|password|authorization|telefono|correo|direccion|documento/i.test(key)) {
      output[key] = '[redacted]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = redact(value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

function mapError(status: number, body: unknown): NinetyNineEnviosError {
  const safeDetails = redact(body);
  const map: Record<number, { code: string; message: string; retryable: boolean }> = {
    401: { code: '99ENVIOS_UNAUTHORIZED', message: 'Credenciales 99 Envíos inválidas o token no autorizado.', retryable: true },
    403: { code: '99ENVIOS_FORBIDDEN', message: 'Sucursal bloqueada, usuario sin permisos o sucursal no activa.', retryable: false },
    404: { code: '99ENVIOS_NOT_FOUND', message: 'Sucursal, guía o novedad no encontrada en 99 Envíos.', retryable: false },
    422: { code: '99ENVIOS_VALIDATION', message: 'Datos inválidos para 99 Envíos.', retryable: false },
    429: { code: '99ENVIOS_RATE_LIMIT', message: 'Límite de 300 cotizaciones por hora alcanzado.', retryable: true },
    500: { code: '99ENVIOS_SERVER_ERROR', message: '99 Envíos no respondió correctamente.', retryable: true },
  };
  const mapped = map[status] ?? { code: '99ENVIOS_ERROR', message: 'Error no controlado de 99 Envíos.', retryable: status >= 500 };
  return new NinetyNineEnviosError(status, mapped.code, mapped.message, mapped.retryable, safeDetails);
}

function unsupported(feature: string) {
  return {
    status: 'pending_documentation',
    message: `${feature} no está documentado en OpenAPI actual de 99 Envíos.`,
  };
}

@Injectable()
export class NinetyNineEnviosAdapter extends NullShippingAdapter {
  private jwtToken: string | null = null;
  private tokenCreatedAt = 0;

  override async getCapabilities(): Promise<Awaited<ReturnType<ShippingProviderPort['getCapabilities']>>> {
    const ready = hasCredentials();
    return {
      provider: '99envios',
      ready,
      mode: ready ? (process.env.NINETY_NINE_ENVIOS_ENV === 'production' ? 'production' : 'sandbox') : 'pending_provider',
      supportsQuote: ready,
      supportsCreateShipment: ready,
      supportsTracking: false,
      supportsLabels: ready,
      supportsPickup: false,
      supportsCashOnDelivery: ready && config().codEnabled,
      supportsWallet: false,
      supportsIssues: ready,
      supportsReturns: false,
      warnings: ready
        ? ['OpenAPI documentado activo: login, cotizar, preenvío, PDF y novedades. Tracking directo/webhooks/wallet/recolecciones no documentados.']
        : ['blocked_missing_credentials: faltan email/password/base URL para 99 Envíos.'],
    };
  }

  override async getCarriers() {
    return DOCUMENTED_CARRIERS.map((carrier) => ({ id: carrier, name: carrier, services: ['standard'] }));
  }

  override async testConnection() {
    const token = await this.authenticate(true);
    return {
      ok: true,
      status: 'authenticated',
      message: 'Login JWT documentado validado contra 99 Envíos.',
      tokenPresent: Boolean(token),
    };
  }

  override async getRateLimitStatus() {
    const key = config().branchCode ?? 'default';
    const window = this.currentWindow(key);
    return {
      used: window.used,
      limit: QUOTE_LIMIT,
      remaining: Math.max(QUOTE_LIMIT - window.used, 0),
      blockedUntil: window.blockedUntil ? new Date(window.blockedUntil).toISOString() : null,
      retryAfter: window.retryAfter,
    };
  }

  invalidateToken() {
    this.jwtToken = null;
    this.tokenCreatedAt = 0;
  }

  async authenticate(force = false): Promise<string> {
    const env = config();
    if (!hasCredentials()) {
      throw new ConflictException('blocked_missing_credentials: faltan credenciales 99 Envíos.');
    }
    if (!force && this.jwtToken && Date.now() - this.tokenCreatedAt < 45 * 60 * 1000) {
      return this.jwtToken;
    }
    const response = await fetch(`${env.baseUrl}/api/integration/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: env.email, password: env.password }),
      signal: AbortSignal.timeout(12_000),
    });
    const body = await this.readBody(response);
    if (!response.ok) throw mapError(response.status, body);
    const token = typeof (body as JsonRecord)?.token === 'string' ? String((body as JsonRecord).token) : null;
    if (!token) throw new NinetyNineEnviosError(500, '99ENVIOS_TOKEN_MISSING', '99 Envíos no devolvió token JWT.', true, null);
    this.jwtToken = token;
    this.tokenCreatedAt = Date.now();
    return token;
  }

  override async quoteShipment(input: ShipmentQuoteInput): Promise<ShipmentQuote> {
    this.assertQuoteLimit();
    const body = this.buildQuoteBody(input);
    try {
      const response = await this.request('/api/integration/v1/cotizar', { method: 'POST', body });
      this.incrementQuoteCount();
      return this.mapQuoteResponse(response);
    } catch (error) {
      if (error instanceof NinetyNineEnviosError && error.status === 429) this.blockQuoteWindow(error.safeDetails);
      throw error;
    }
  }

  override async createShipment(input: CreateShipmentInput): Promise<ShipmentResult> {
    const body = this.buildPreenvioBody(input);
    const response = await this.request('/api/integration/v1/preenvio', {
      method: 'POST',
      body,
      integrationHeaders: true,
    }) as JsonRecord;
    const guideNumber = String(response.numeroPreenvio ?? '');
    if (!guideNumber) {
      throw new NinetyNineEnviosError(500, '99ENVIOS_GUIDE_MISSING', '99 Envíos no devolvió numeroPreenvio.', true, redact(response));
    }
    return {
      id: guideNumber,
      provider: '99envios',
      status: 'guide_generated',
      quotedAmount: response.valorFlete === undefined ? null : String(response.valorFlete),
      carrier: input.service?.carrier ?? 'pending_carrier',
      trackingNumber: guideNumber,
      routeNumber: response.numeroRecogida === undefined ? null : String(response.numeroRecogida),
      labelUrl: null,
      pickupStatus: response.estadoRecogida ? 'scheduled' : 'pending',
      cashOnDeliveryStatus: input.cashOnDelivery?.enabled ? 'pending' : 'not_enabled',
      estimatedDeliveryDate: null,
      rawStatus: typeof response.mensaje === 'string' ? response.mensaje : 'preenvio_created',
      warnings: ['Preenvío documentado creado. Tracking directo y recolección quedan pending_documentation.'],
    };
  }

  override async generateLabel(input: ShippingLabelInput): Promise<Awaited<ReturnType<ShippingProviderPort['generateLabel']>>> {
    if (!/^[0-9]+$/.test(input.guideNumber)) {
      throw new ConflictException('La guía de 99 Envíos para PDF debe ser numérica.');
    }
    const pdfType = input.pdfType ?? config().pdfType;
    const response = await this.request(`/api/integration/v1/pdf/${pdfType}`, {
      method: 'POST',
      body: {
        guia: Number(input.guideNumber),
        transportadora: { pais: 'colombia', nombre: input.carrier },
        AplicaContrapago: input.cashOnDelivery,
      },
      expectPdf: true,
    });
    if (Buffer.isBuffer(response)) {
      return {
        labelUrl: null,
        pdfBase64: response.toString('base64'),
        contentType: 'application/pdf',
        labelFormat: pdfType === 1 ? 'PDF_STICKER' : 'PDF_NORMAL',
        status: 'pdf_ready',
      };
    }
    return {
      labelUrl: null,
      pdfBase64: null,
      contentType: null,
      labelFormat: pdfType === 1 ? 'PDF_STICKER' : 'PDF_NORMAL',
      status: 'provider_returned_json',
    };
  }

  override async getShipmentStatus(trackingNumber: string): Promise<ShipmentResult> {
    return {
      id: trackingNumber,
      provider: '99envios',
      status: 'pending_provider',
      quotedAmount: null,
      carrier: null,
      trackingNumber,
      routeNumber: null,
      labelUrl: null,
      pickupStatus: 'pending',
      cashOnDeliveryStatus: 'pending',
      estimatedDeliveryDate: null,
      rawStatus: 'unsupported_by_current_docs',
      warnings: [unsupported('Tracking directo por guía').message],
    };
  }

  override async cancelShipment(): Promise<ShipmentResult> {
    throw new ConflictException(unsupported('Cancelación de guía').message);
  }

  override async schedulePickup(): Promise<Awaited<ReturnType<ShippingProviderPort['schedulePickup']>>> {
    throw new ConflictException(unsupported('Recolecciones').message);
  }

  override async getWalletBalance() {
    return { status: 'pending_provider' as const, available: null, pending: null, currency: 'COP' };
  }

  override async getWalletTransactions() {
    return { data: [], operationalState: unsupported('Wallet/transacciones') };
  }

  override async getSettlements() {
    return { data: [], operationalState: unsupported('Liquidaciones') };
  }

  override async getReturns(shipmentId: string) {
    return { shipmentId, data: [], operationalState: unsupported('Devoluciones') };
  }

  override async handleWebhook() {
    return {
      accepted: false,
      duplicate: false,
      eventId: null,
      eventName: 'unsupported_by_current_docs',
      externalShipmentId: null,
      status: null,
      rawStatus: 'pending_documentation',
    };
  }

  override async getBranchIssues(branchCode: string) {
    if (!branchCode) throw new ConflictException('NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE requerido para novedades.');
    const response = await this.request(`/api/integration/sucursal/novedades/${encodeURIComponent(branchCode)}`, { method: 'GET' }) as JsonRecord;
    const novedades = Array.isArray(response.novedades) ? response.novedades : [];
    return {
      branchCode,
      data: novedades.map((issue) => this.mapIssue(issue as JsonRecord)),
    };
  }

  override async getShipmentIssues(shipmentId: string) {
    const branchCode = config().branchCode;
    if (!branchCode) {
      return { shipmentId, data: [], operationalState: { status: 'blocked_missing_branch_code', message: 'Código de sucursal requerido.' } };
    }
    const issues = await this.getBranchIssues(branchCode);
    return { shipmentId, data: issues.data };
  }

  override async updateBranchIssue(issueId: string, input: { guideNumber: string; issue: string; observations?: string }) {
    if (!issueId || !input.guideNumber || !input.issue) {
      throw new ConflictException('id, numero_guia y novedad_sucursal son obligatorios.');
    }
    return this.request(`/api/integration/sucursal/novedades/${encodeURIComponent(issueId)}`, {
      method: 'POST',
      body: {
        numero_guia: Number(input.guideNumber),
        novedad_sucursal: input.issue,
        observaciones: input.observations,
      },
    }) as Promise<JsonRecord>;
  }

  override async resolveShipmentIssue(issueId: string) {
    return { id: issueId, status: 'requires_update_issue_payload' };
  }

  private async request(path: string, options: {
    method: 'GET' | 'POST';
    body?: JsonRecord;
    integrationHeaders?: boolean;
    expectPdf?: boolean;
    retry?: boolean;
  }): Promise<unknown> {
    const env = config();
    const token = await this.authenticate();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (options.body) headers['Content-Type'] = 'application/json';
    if (options.integrationHeaders && env.integrationToken) headers['X-Integration-Token'] = env.integrationToken;
    if (options.integrationHeaders && env.integrationId) headers['X-Integration-Id'] = env.integrationId;
    const response = await fetch(`${env.baseUrl}${path}`, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(18_000),
    });
    const body = options.expectPdf ? await this.readPdfOrJson(response) : await this.readBody(response);
    if (response.status === 401 && options.retry !== false) {
      this.invalidateToken();
      return this.request(path, { ...options, retry: false });
    }
    if (!response.ok) throw mapError(response.status, body);
    return body;
  }

  private async readBody(response: Response): Promise<unknown> {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { message: text.slice(0, 500) };
    }
  }

  private async readPdfOrJson(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/pdf')) {
      return Buffer.from(await response.arrayBuffer());
    }
    return this.readBody(response);
  }

  private buildQuoteBody(input: ShipmentQuoteInput): JsonRecord {
    const env = config();
    const destinationDane = input.destination.daneCode;
    assertDane(destinationDane, 'Destino');
    if (env.originDaneCode) assertDane(env.originDaneCode, 'Origen');
    const pkg = input.packages[0];
    if (!pkg) throw new ConflictException('Paquete requerido para cotizar.');
    assertPositive(pkg.weightKg, 'peso');
    assertPositive(pkg.heightCm, 'alto');
    assertPositive(pkg.lengthCm, 'largo');
    assertPositive(pkg.widthCm, 'ancho');
    const seguro99plus = input.insurance?.seguro99plus ?? env.seguro99plus;
    const seguro99 = seguro99plus ? false : input.insurance?.seguro99 ?? env.seguro99;
    return {
      destino: { nombre: input.destination.city, codigo: destinationDane },
      origen: { nombre: input.origin?.city ?? '', codigo: env.originDaneCode ?? input.origin?.daneCode ?? '' },
      IdTipoEntrega: input.service?.idTipoEntrega ?? 1,
      IdServicio: input.service?.idServicio ?? 1,
      valorDeclarado: Number(pkg.declaredValue),
      peso: pkg.weightKg,
      alto: pkg.heightCm,
      largo: pkg.lengthCm,
      ancho: pkg.widthCm,
      fecha: formatDate(),
      seguro99,
      seguro99plus,
      AplicaContrapago: Boolean(input.cashOnDelivery?.enabled),
    };
  }

  private buildPreenvioBody(input: CreateShipmentInput): JsonRecord {
    const pkg = input.packages[0];
    if (!pkg) throw new ConflictException('Paquete requerido para crear preenvío.');
    assertDane(input.destination.daneCode, 'Destinatario.idLocalidad');
    assertPositive(pkg.weightKg, 'peso');
    assertPositive(pkg.lengthCm, 'largo');
    assertPositive(pkg.widthCm, 'ancho');
    assertPositive(pkg.heightCm, 'alto');
    const carrier = input.service?.carrier;
    if (!carrier) throw new ConflictException('transportadora.nombre es obligatorio para preenvío.');
    const nameParts = input.destination.recipientName.trim().split(/\s+/);
    const seguro99plus = input.insurance?.seguro99plus ?? config().seguro99plus;
    const seguro99 = seguro99plus ? false : input.insurance?.seguro99 ?? config().seguro99;
    return {
      IdTipoEntrega: input.service?.idTipoEntrega ?? 1,
      IdServicio: input.service?.idServicio ?? 1,
      AplicaContrapago: Boolean(input.cashOnDelivery?.enabled),
      peso: pkg.weightKg,
      largo: pkg.lengthCm,
      ancho: pkg.widthCm,
      alto: pkg.heightCm,
      diceContener: pkg.contentDescription,
      valorDeclarado: Number(pkg.declaredValue),
      seguro99,
      seguro99plus,
      Destinatario: {
        tipoDocumento: input.recipient?.documentType ?? 'CC',
        numeroDocumento: input.recipient?.documentNumber ?? null,
        nombre: input.recipient?.firstName ?? nameParts[0] ?? 'Cliente',
        primerApellido: input.recipient?.firstLastName ?? (nameParts.slice(1).join(' ') || 'DistriTools'),
        segundoApellido: input.recipient?.secondLastName ?? null,
        telefono: input.destination.recipientPhone,
        direccion: input.destination.addressLine1,
        idLocalidad: input.destination.daneCode,
        correo: input.recipient?.email ?? null,
      },
      Observaciones: input.observations ?? input.destination.notes ?? null,
      transportadora: { pais: input.service?.country ?? 'colombia', nombre: carrier },
      origenCreacion: input.service?.creationOrigin ?? 1,
    };
  }

  private mapQuoteResponse(response: unknown): ShipmentQuote {
    const source = response as JsonRecord;
    const carrierOptions = DOCUMENTED_CARRIERS
      .filter((name) => source[name])
      .map((name) => this.mapCarrierOption(name, source[name] as JsonRecord));
    const carrier = DOCUMENTED_CARRIERS.find((name) => source[name]);
    if (!carrier) {
      return {
        provider: '99envios',
        status: 'quoted',
        carrier: null,
        service: null,
        quotedAmount: null,
        currency: 'COP',
        estimatedDays: null,
        expiresAt: null,
        warnings: ['Cotización recibida sin transportadoras conocidas.'],
        rawReference: redact(source),
        carrierOptions: [],
      };
    }
    return {
      ...this.mapCarrierQuote(carrier, source[carrier] as JsonRecord, source),
      carrierOptions,
    };
  }

  private mapCarrierQuote(carrier: string, item: JsonRecord, full: JsonRecord): ShipmentQuote {
    const success = item.exito !== false;
    return {
      provider: '99envios',
      status: success ? 'quoted' : 'pending_provider',
      carrier,
      carrierLabel: carrier,
      service: item.IdServicio === undefined ? null : String(item.IdServicio),
      quotedAmount: item.valor === undefined ? null : String(item.valor),
      cashOnDeliveryAmount: item.valor_contrapago === undefined ? null : String(item.valor_contrapago),
      internalCommission: item.comision_interna === undefined && item.valor_interna === undefined ? null : String(item.comision_interna ?? item.valor_interna),
      surcharge: item.sobreflete === undefined ? null : String(item.sobreflete),
      insuranceAmount: item.seguro99 === undefined ? null : String(item.seguro99),
      success,
      message: typeof item.mensaje === 'string' ? item.mensaje : null,
      currency: 'COP',
      estimatedDays: item.dias === undefined || Number.isNaN(Number(item.dias)) ? null : Number(item.dias),
      estimatedDeliveryDate: item.fecha_entrega ? new Date(String(item.fecha_entrega)) : null,
      expiresAt: null,
      warnings: success ? [] : [typeof item.mensaje === 'string' ? item.mensaje : 'Transportadora no disponible.'],
      rawReference: redact(full),
    };
  }

  private mapCarrierOption(carrier: string, item: JsonRecord) {
    return {
      carrier,
      carrierLabel: carrier,
      success: item.exito !== false,
      message: typeof item.mensaje === 'string' ? item.mensaje : null,
      quotedAmount: item.valor === undefined ? null : String(item.valor),
      cashOnDeliveryAmount: item.valor_contrapago === undefined ? null : String(item.valor_contrapago),
      internalCommission: item.comision_interna === undefined && item.valor_interna === undefined ? null : String(item.comision_interna ?? item.valor_interna),
      surcharge: item.sobreflete === undefined ? null : String(item.sobreflete),
      insuranceAmount: item.seguro99 === undefined ? null : String(item.seguro99),
      estimatedDays: item.dias === undefined || Number.isNaN(Number(item.dias)) ? null : Number(item.dias),
      estimatedDeliveryDate: item.fecha_entrega ? new Date(String(item.fecha_entrega)) : null,
      serviceId: item.IdServicio === undefined ? null : String(item.IdServicio),
    };
  }

  private mapIssue(issue: JsonRecord): JsonRecord {
    return {
      externalIssueId: String(issue.id ?? ''),
      branchCode: String(issue.codigo_sucursal ?? ''),
      guideNumber: String(issue.numero_preenvio ?? ''),
      carrierId: String(issue.id_transportadora ?? ''),
      issueType: String(issue.tipo_novedad ?? ''),
      description: String(issue.novedad ?? ''),
      observations: issue.observaciones ?? null,
      recipientMasked: issue.nombre_destinatario ? `${String(issue.nombre_destinatario).slice(0, 2)}***` : null,
      addressMasked: issue.direccion_destinatario ? '[redacted]' : null,
      phoneMasked: issue.telefono_destinatario ? `${String(issue.telefono_destinatario).slice(0, 2)}***` : null,
      city: issue.ciudad_destinatario ?? null,
      officeClaim: Boolean(issue.reclamo_oficina),
      providerCreatedAt: issue.created_at ?? null,
      providerUpdatedAt: issue.updated_at ?? null,
      rawRedacted: redact(issue),
    };
  }

  private currentWindow(key = config().branchCode ?? 'default') {
    const now = Date.now();
    const existing = quoteWindows.get(key);
    if (!existing || now - existing.startedAt >= QUOTE_WINDOW_MS) {
      const fresh = { startedAt: now, used: 0, blockedUntil: null, retryAfter: null };
      quoteWindows.set(key, fresh);
      return fresh;
    }
    return existing;
  }

  private assertQuoteLimit() {
    const window = this.currentWindow();
    if ((window.blockedUntil && Date.now() < window.blockedUntil) || window.used >= QUOTE_LIMIT) {
      throw new NinetyNineEnviosError(429, '99ENVIOS_RATE_LIMIT_LOCAL', 'Límite de 300 cotizaciones por hora alcanzado.', true, {
        retry_after: window.retryAfter,
      });
    }
  }

  private incrementQuoteCount() {
    this.currentWindow().used += 1;
  }

  private blockQuoteWindow(details: JsonRecord | null) {
    const window = this.currentWindow();
    window.blockedUntil = Date.now() + 15 * 60 * 1000;
    window.retryAfter = typeof details?.retry_after === 'string' ? details.retry_after : '15 minutos';
  }
}
