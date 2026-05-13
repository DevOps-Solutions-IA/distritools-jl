import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  Inject,
  Ip,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma, ShipmentStatus as PrismaShipmentStatus } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  SHIPPING_PROVIDER_PORT,
  ShippingProviderPort,
  ShipmentPackage,
  ShipmentQuoteInput,
} from 'src/modules/shipping/application/ports/shipping-provider.port';
import { AutoShippingService } from 'src/modules/shipping/application/services/auto-shipping.service';
import type { ShipmentStatus } from 'src/modules/shipping/domain/shipping-status';

interface QuoteShipmentBody {
  orderId?: string;
  destination?: Record<string, unknown>;
  packages?: ShipmentPackage[];
  declaredValue?: string;
  cashOnDelivery?: { enabled?: boolean; amount?: string };
  service?: {
    idTipoEntrega?: number;
    idServicio?: number;
    carrier?: string;
    country?: string;
    creationOrigin?: number;
  };
  insurance?: {
    seguro99?: boolean;
    seguro99plus?: boolean;
  };
}

interface ShipmentBody extends QuoteShipmentBody {
  quoteReference?: string;
  recipient?: {
    documentType?: string;
    documentNumber?: string;
    firstName?: string;
    firstLastName?: string;
    secondLastName?: string;
    email?: string;
  };
  observations?: string;
}

interface CancelBody {
  reason?: string;
}

interface PickupBody {
  shipmentIds?: string[];
  scheduledDate?: string;
}

const ACTIVE_SHIPMENT_STATUSES: PrismaShipmentStatus[] = [
  'pending_quote',
  'quoted',
  'pending_dispatch',
  'shipment_created',
  'guide_generated',
  'pickup_scheduled',
  'in_transit',
  'out_for_delivery',
];

function toPrismaStatus(status: ShipmentStatus): PrismaShipmentStatus {
  if (status === 'provider_unknown') {
    return 'delivery_failed';
  }
  return status as PrismaShipmentStatus;
}

function safeActorId(actor: CurrentUser): string | null {
  return actor.sub === '00000000-0000-7000-8000-000000000099' ? null : actor.sub;
}

function redactPayload(payload: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (!payload || typeof payload !== 'object') {
    return Prisma.JsonNull;
  }
  const input = payload as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (/secret|token|key|password|phone|email|address/i.test(key)) {
      output[key] = '[redacted]';
    } else {
      output[key] = value as Prisma.InputJsonValue;
    }
  }
  return output as Prisma.InputJsonValue;
}

@ApiTags('shipping')
@Controller()
export class ShippingController {
  constructor(
    @Inject(SHIPPING_PROVIDER_PORT)
    private readonly provider: ShippingProviderPort,
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AutoShippingService)
    private readonly autoShippingService: AutoShippingService,
  ) {}

  @ApiBearerAuth()
  @Permissions('shipping.read')
  @Get('admin/shipping/capabilities')
  async getCapabilities() {
    return {
      ...(await this.provider.getCapabilities()),
      providerConfig: this.providerConfigSummary(),
    };
  }

  @ApiBearerAuth()
  @Permissions('shipping.read')
  @Get('admin/shipping/carriers')
  async getCarriers() {
    return { data: await this.provider.getCarriers() };
  }

  @ApiBearerAuth()
  @Permissions('shipping.read')
  @Get('admin/shipping/login-test')
  async testLogin() {
    return this.provider.testConnection();
  }

  @ApiBearerAuth()
  @Permissions('shipping.read')
  @Get('admin/shipping/rate-limit')
  async getRateLimit() {
    return this.provider.getRateLimitStatus();
  }

  @ApiBearerAuth()
  @Permissions('shipping.write')
  @Post('admin/orders/:orderId/auto-shipping/retry')
  async retryAutoShipping(
    @Param('orderId') orderId: string,
    @Body() body: { paymentMethod?: string; customerDocument?: string; destinationDaneCode?: string },
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.autoShippingService.runAfterCheckout({
      orderId,
      paymentMethod: body.paymentMethod,
      customerDocument: body.customerDocument,
      destinationDaneCode: body.destinationDaneCode,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('shipping.read')
  @Post('admin/shipping/quote')
  async quoteShipment(@Body() body: QuoteShipmentBody) {
    const input = await this.buildQuoteInput(body);
    return this.provider.quoteShipment(input);
  }

  @ApiBearerAuth()
  @Permissions('shipping.write')
  @Post('admin/orders/:orderId/shipment')
  async createOrderShipment(
    @Param('orderId') orderId: string,
    @Body() body: ShipmentBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: true, shipments: true },
    });
    if (!order) throw new NotFoundException('Pedido no encontrado.');

    const activeShipment = order.shipments.find((shipment) =>
      ACTIVE_SHIPMENT_STATUSES.includes(shipment.status),
    );
    if (activeShipment?.trackingNumber) {
      throw new ConflictException('El pedido ya tiene una guía activa. Cancela la guía actual antes de crear otra.');
    }

    const customer = await this.ensureCustomerFromOrder(order);
    const input = await this.buildQuoteInput({ ...body, orderId });
    const result = await this.provider.createShipment({
      ...input,
      quoteReference: body.quoteReference,
      recipient: body.recipient,
      observations: body.observations,
    });

    const status = toPrismaStatus(result.status);
    const shipment = await this.prisma.shipment.upsert({
      where: {
        orderId_provider: {
          orderId,
          provider: result.provider,
        },
      },
      create: {
        id: uuidv7(),
        orderId,
        customerId: customer.id,
        provider: result.provider,
        status,
        quotedAmount: result.quotedAmount ?? undefined,
        trackingNumber: result.trackingNumber,
        routeNumber: result.routeNumber,
        labelUrl: result.labelUrl,
        providerShipmentId: result.id,
        providerReference: result.carrier ?? result.rawStatus,
        estimatedDeliveryDate: result.estimatedDeliveryDate,
        addressSnapshot: this.addressSnapshot(order),
        packageSnapshot: (input.packages as unknown as Prisma.InputJsonValue),
        rawProviderStatus: result.rawStatus,
        lastSyncAt: new Date(),
        createdById: safeActorId(actor),
        updatedById: safeActorId(actor),
      },
      update: {
        status,
        quotedAmount: result.quotedAmount ?? undefined,
        trackingNumber: result.trackingNumber,
        routeNumber: result.routeNumber,
        labelUrl: result.labelUrl,
        providerShipmentId: result.id,
        providerReference: result.carrier ?? result.rawStatus,
        estimatedDeliveryDate: result.estimatedDeliveryDate,
        packageSnapshot: (input.packages as unknown as Prisma.InputJsonValue),
        rawProviderStatus: result.rawStatus,
        lastSyncAt: new Date(),
        updatedById: safeActorId(actor),
      },
      include: { order: true, customer: true, events: true },
    });

    await this.createShipmentEvent(shipment.id, status, result.rawStatus, 'Guía creada o preparada desde provider logístico.');
    await this.audit(actor, 'shipping.shipment_created', 'shipment', shipment.id, null, {
      provider: result.provider,
      status,
      trackingNumber: result.trackingNumber ? '[present]' : null,
      warnings: result.warnings,
    }, ipAddress, userAgent);

    return {
      ...this.serializeShipment(shipment),
      providerWarnings: result.warnings,
    };
  }

  @ApiBearerAuth()
  @Permissions('shipping.read')
  @Get('admin/orders/:orderId/shipment')
  async getOrderShipment(@Param('orderId') orderId: string) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { orderId },
      include: { order: true, customer: true, events: { orderBy: { occurredAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!shipment) {
      return {
        data: null,
        operationalState: {
          status: 'pending_guide',
          message: 'Pedido sin guía externa. Tracking interno sigue disponible.',
        },
      };
    }
    return this.serializeShipment(shipment);
  }

  @ApiBearerAuth()
  @Permissions('shipping.read')
  @Get('admin/shipments/:shipmentId/label')
  async getLabel(@Param('shipmentId') shipmentId: string, @Query('tipoPdf') tipoPdf?: string) {
    const shipment = await this.findShipment(shipmentId);
    const label = shipment.labelUrl
      ? { labelUrl: shipment.labelUrl }
      : await this.provider.generateLabel({
          guideNumber: shipment.trackingNumber ?? shipment.providerShipmentId ?? shipmentId,
          carrier: shipment.provider === '99envios' ? (shipment.providerReference ?? 'servientrega') : shipment.provider,
          pdfType: tipoPdf === '1' ? 1 : 2,
          cashOnDelivery: shipment.rawProviderStatus?.includes('contrapago') ?? false,
        });
    return {
      shipmentId,
      ...label,
      operationalState: label.labelUrl
        ? undefined
        : { status: 'label_pending', message: 'Etiqueta pendiente. No se inventa URL de guía.' },
    };
  }

  @ApiBearerAuth()
  @Permissions('tracking.read')
  @Get('admin/shipments/:shipmentId/tracking')
  async getTracking(@Param('shipmentId') shipmentId: string) {
    const shipment = await this.findShipment(shipmentId);
    if (!shipment.trackingNumber) {
      return {
        shipmentId,
        trackingNumber: null,
        events: shipment.events,
        operationalState: {
          status: 'pending_guide',
          message: 'No hay guía externa. Se conserva tracking interno.',
        },
      };
    }
    return {
      shipmentId,
      providerStatus: await this.provider.getShipmentStatus(shipment.trackingNumber),
      events: shipment.events,
    };
  }

  @ApiBearerAuth()
  @Permissions('shipping.cancel')
  @Post('admin/shipments/:shipmentId/cancel')
  async cancelShipment(
    @Param('shipmentId') shipmentId: string,
    @Body() body: CancelBody,
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const shipment = await this.findShipment(shipmentId);
    if (shipment.status === 'delivered') {
      throw new ConflictException('No se puede cancelar una guía entregada.');
    }
    if (!body.reason?.trim()) {
      throw new BadRequestException('La razón de cancelación es obligatoria.');
    }
    const providerResult = await this.provider.cancelShipment(shipmentId);
    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: 'cancelled', rawProviderStatus: providerResult.rawStatus, updatedById: safeActorId(actor) },
      include: { order: true, customer: true, events: true },
    });
    await this.createShipmentEvent(shipmentId, 'cancelled', providerResult.rawStatus, `Cancelación solicitada: ${body.reason}`);
    await this.audit(actor, 'shipping.shipment_cancelled', 'shipment', shipmentId, this.serializeShipment(shipment), this.serializeShipment(updated), ipAddress, userAgent);
    return this.serializeShipment(updated);
  }

  @ApiBearerAuth()
  @Permissions('tracking.write')
  @Post('admin/shipments/:shipmentId/sync')
  async syncShipment(@Param('shipmentId') shipmentId: string) {
    const shipment = await this.findShipment(shipmentId);
    if (!shipment.trackingNumber) {
      return {
        ...this.serializeShipment(shipment),
        synced: false,
        operationalState: {
          status: 'pending_guide',
          message: 'No hay guía externa para sincronizar.',
        },
      };
    }
    const providerStatus = await this.provider.getShipmentStatus(shipment.trackingNumber);
    const status = toPrismaStatus(providerStatus.status);
    const updated = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { status, rawProviderStatus: providerStatus.rawStatus, lastSyncAt: new Date() },
      include: { order: true, customer: true, events: true },
    });
    await this.createShipmentEvent(shipmentId, status, providerStatus.rawStatus, 'Tracking sincronizado desde provider.');
    return this.serializeShipment(updated);
  }

  @ApiBearerAuth()
  @Permissions('shipping.pickup')
  @Post('admin/pickups')
  async schedulePickup(@Body() body: PickupBody) {
    const shipmentId = body.shipmentIds?.[0];
    if (!shipmentId) throw new BadRequestException('Selecciona al menos una guía.');
    const scheduledDate = body.scheduledDate ? new Date(body.scheduledDate) : new Date();
    return {
      shipmentIds: body.shipmentIds,
      ...(await this.provider.schedulePickup({ shipmentId, scheduledDate })),
      operationalState: {
        status: 'api_ready',
        message: 'Recolección preparada por provider actual. Persistencia externa depende de documentación oficial.',
      },
    };
  }

  @ApiBearerAuth()
  @Permissions('shipping.read')
  @Get('admin/pickups')
  getPickups() {
    return {
      data: [],
      operationalState: { status: 'pending_provider', message: 'Recolecciones persistentes pendientes de documentación de provider.' },
    };
  }

  @ApiBearerAuth()
  @Permissions('shipping.issues.write')
  @Get('admin/shipments/:shipmentId/issues')
  getIssues(@Param('shipmentId') shipmentId: string) {
    return this.provider.getShipmentIssues(shipmentId);
  }

  @ApiBearerAuth()
  @Permissions('shipping.read')
  @Get('admin/shipping/branch-issues')
  getBranchIssues(@Query('branchCode') branchCode?: string) {
    const code = branchCode ?? process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE;
    if (!code) throw new BadRequestException('Código de sucursal requerido para consultar novedades.');
    return this.provider.getBranchIssues(code);
  }

  @ApiBearerAuth()
  @Permissions('shipping.issues.write')
  @Post('admin/shipping/branch-issues/:issueId')
  async updateBranchIssue(
    @Param('issueId') issueId: string,
    @Body() body: { guideNumber?: string; issue?: string; observations?: string },
    @CurrentUserDecorator() actor: CurrentUser,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (!body.guideNumber || !body.issue) {
      throw new BadRequestException('numero_guia y novedad_sucursal son obligatorios.');
    }
    const result = await this.provider.updateBranchIssue(issueId, {
      guideNumber: body.guideNumber,
      issue: body.issue,
      observations: body.observations,
    });
    await this.audit(actor, 'shipping.issue_updated', 'shipment_issue', issueId, null, result, ipAddress, userAgent);
    return result;
  }

  @ApiBearerAuth()
  @Permissions('shipping.issues.write')
  @Post('admin/shipment-issues/:issueId/resolve')
  resolveIssue(@Param('issueId') issueId: string) {
    return this.provider.resolveShipmentIssue(issueId);
  }

  @ApiBearerAuth()
  @Permissions('shipping.returns.read')
  @Get('admin/shipments/:shipmentId/returns')
  getReturns(@Param('shipmentId') shipmentId: string) {
    return this.provider.getReturns(shipmentId);
  }

  @ApiBearerAuth()
  @Permissions('shipping.cod.read')
  @Get('admin/cod')
  getCod(@Query('shipmentId') shipmentId?: string) {
    if (!shipmentId) {
      return {
        data: [],
        operationalState: { status: 'api_ready', message: 'Consulta COD disponible por shipmentId cuando exista provider.' },
      };
    }
    return this.provider.getCashOnDeliveryStatus(shipmentId);
  }

  @ApiBearerAuth()
  @Permissions('shipping.wallet.read')
  @Get('admin/wallet')
  getWallet() {
    return this.provider.getWalletBalance();
  }

  @ApiBearerAuth()
  @Permissions('shipping.wallet.read')
  @Get('admin/wallet/transactions')
  getWalletTransactions() {
    return this.provider.getWalletTransactions();
  }

  @ApiBearerAuth()
  @Permissions('shipping.wallet.read')
  @Get('admin/settlements')
  getSettlements() {
    return this.provider.getSettlements();
  }

  @Public()
  @Post('webhooks/99envios')
  async handle99EnviosWebhook(
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const secret = process.env.NINETY_NINE_ENVIOS_WEBHOOK_SECRET;
    if (secret) {
      const signature = headers['x-99envios-signature'] ?? headers['x-webhook-secret'];
      if (signature !== secret) {
        throw new UnauthorizedException('Firma de webhook inválida.');
      }
    }

    const result = await this.provider.handleWebhook({ headers, body });
    if (!result.accepted) {
      return {
        accepted: false,
        operationalState: {
          status: 'pending_provider',
          message: 'Webhook recibido pero provider real no está configurado.',
        },
      };
    }

    const eventId = result.eventId ?? uuidv7();
    const existing = await this.prisma.auditLog.findFirst({
      where: { action: 'shipping.webhook_99envios', entityId: eventId },
    });
    if (existing) {
      return { accepted: true, duplicate: true, eventId };
    }

    const shipment = result.externalShipmentId
      ? await this.prisma.shipment.findFirst({
          where: {
            OR: [
              { providerShipmentId: result.externalShipmentId },
              { trackingNumber: result.externalShipmentId },
            ],
          },
          include: { order: true, customer: true, events: true },
        })
      : null;

    if (shipment && result.status) {
      const status = toPrismaStatus(result.status);
      await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: { status, rawProviderStatus: result.rawStatus, lastSyncAt: new Date() },
      });
      await this.createShipmentEvent(shipment.id, status, result.rawStatus, result.eventName ?? 'Webhook 99 Envíos procesado.', body);
    }

    await this.prisma.auditLog.create({
      data: {
        id: uuidv7(),
        action: 'shipping.webhook_99envios',
        entityType: 'shipment',
        entityId: eventId,
        afterData: redactPayload(body),
      },
    });

    return { accepted: true, duplicate: false, eventId, shipmentUpdated: Boolean(shipment) };
  }

  private async buildQuoteInput(body: QuoteShipmentBody): Promise<ShipmentQuoteInput> {
    const order = body.orderId
      ? await this.prisma.order.findUnique({ where: { id: body.orderId } })
      : null;
    if (body.orderId && !order) throw new NotFoundException('Pedido no encontrado.');

    const destination = {
      country: 'CO',
      department: String(body.destination?.department ?? 'Valle del Cauca'),
      city: String(body.destination?.city ?? order?.shippingCity ?? 'Cali'),
      daneCode: typeof body.destination?.daneCode === 'string'
        ? body.destination.daneCode
        : process.env.NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_DANE_CODE,
      addressLine1: String(body.destination?.addressLine1 ?? order?.shippingAddress ?? 'Dirección pendiente'),
      recipientName: String(body.destination?.recipientName ?? order?.customerName ?? 'Cliente'),
      recipientPhone: String(body.destination?.recipientPhone ?? order?.customerPhone ?? '3000000000'),
      notes: typeof body.destination?.notes === 'string' ? body.destination.notes : order?.shippingNotes ?? undefined,
    };
    const packages = body.packages?.length
      ? body.packages
      : [{
          weightKg: 1,
          lengthCm: 30,
          widthCm: 20,
          heightCm: 15,
          declaredValue: body.declaredValue ?? order?.grandTotal?.toFixed(2) ?? '0',
          contentDescription: order ? `Pedido ${order.orderNumber}` : 'Mercancía DistriTools JL',
        }];
    return {
      orderId: body.orderId,
      destination,
      packages,
      idempotencyKey: body.orderId ?? uuidv7(),
      cashOnDelivery: body.cashOnDelivery?.enabled
        ? { enabled: true, amount: body.cashOnDelivery.amount ?? order?.grandTotal?.toFixed(2) ?? '0' }
        : { enabled: false, amount: '0' },
      service: body.service,
      insurance: body.insurance,
    };
  }

  private async findShipment(shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: true, customer: true, events: { orderBy: { occurredAt: 'desc' } } },
    });
    if (!shipment) throw new NotFoundException('Envío no encontrado.');
    return shipment;
  }

  private async ensureCustomerFromOrder(order: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: string;
    shippingCity: string;
    createdAt: Date;
  }) {
    const email = order.customerEmail.trim().toLowerCase();
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

  private addressSnapshot(order: { shippingAddress: string; shippingCity: string; customerEmail: string }) {
    return {
      address: '[redacted]',
      city: order.shippingCity,
      customer: order.customerEmail.replace(/^(.{2}).*(@.*)$/, '$1***$2'),
    } as Prisma.InputJsonValue;
  }

  private async createShipmentEvent(
    shipmentId: string,
    status: PrismaShipmentStatus,
    providerStatus: string | null,
    description: string,
    rawPayload?: unknown,
  ) {
    await this.prisma.shipmentEvent.create({
      data: {
        id: uuidv7(),
        shipmentId,
        status,
        providerStatus,
        description,
        occurredAt: new Date(),
        rawPayload: rawPayload ? redactPayload(rawPayload) : undefined,
      },
    });
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
    await this.prisma.auditLog.create({
      data: {
        id: uuidv7(),
        actorUserId: safeActorId(actor),
        action,
        entityType,
        entityId,
        beforeData: beforeData ? redactPayload(beforeData) : undefined,
        afterData: afterData ? redactPayload(afterData) : undefined,
        ipAddress,
        userAgent,
      },
    });
  }

  private serializeShipment(shipment: Prisma.ShipmentGetPayload<{
    include: { order: true; customer: true; events: true };
  }>) {
    return {
      id: shipment.id,
      orderId: shipment.orderId,
      orderNumber: shipment.order.orderNumber,
      provider: shipment.provider,
      status: shipment.status,
      carrier: shipment.provider === 'mock_99envios' ? '99 Envíos Mock' : null,
      trackingNumber: shipment.trackingNumber,
      guideNumber: shipment.trackingNumber,
      routeNumber: shipment.routeNumber,
      labelUrl: shipment.labelUrl,
      providerShipmentId: shipment.providerShipmentId,
      quotedAmount: shipment.quotedAmount?.toFixed(2) ?? null,
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
        occurredAt: event.occurredAt,
      })),
      createdAt: shipment.createdAt,
      updatedAt: shipment.updatedAt,
    };
  }

  private providerConfigSummary() {
    return {
      provider: process.env.SHIPPING_PROVIDER ?? 'internal',
      env: process.env.NINETY_NINE_ENVIOS_ENV ?? 'sandbox',
      hasApiBaseUrl: Boolean(process.env.NINETY_NINE_ENVIOS_API_BASE_URL),
      hasAuthEmail: Boolean(process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL),
      hasAuthPassword: Boolean(process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD),
      hasIntegrationToken: Boolean(process.env.NINETY_NINE_ENVIOS_INTEGRATION_TOKEN),
      hasIntegrationId: Boolean(process.env.NINETY_NINE_ENVIOS_INTEGRATION_ID),
      hasBranchCode: Boolean(process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE),
      hasOriginDaneCode: Boolean(process.env.NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_DANE_CODE),
      codEnabled: process.env.NINETY_NINE_ENVIOS_ENABLE_COD === 'true',
      defaultPdfType: process.env.NINETY_NINE_ENVIOS_DEFAULT_PDF_TYPE ?? '2',
      seguro99: process.env.NINETY_NINE_ENVIOS_DEFAULT_SEGURO99 === 'true',
      seguro99plus: process.env.NINETY_NINE_ENVIOS_DEFAULT_SEGURO99PLUS === 'true',
    };
  }
}
