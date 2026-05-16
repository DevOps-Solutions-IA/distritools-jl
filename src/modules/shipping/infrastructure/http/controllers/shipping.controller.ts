import { BadRequestException, Body, Controller, Get, Headers, Inject, Ip, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { AutoShippingService } from 'src/modules/shipping/application/services/auto-shipping.service';
import { SHIPPING_PROVIDER_PORT, ShippingProviderPort } from 'src/modules/shipping/application/ports/shipping-provider.port';
import { CreateShipmentUseCase } from 'src/modules/shipping/application/use-cases/create-shipment.use-case';
import { GetShipmentDetailUseCase, GetShipmentLabelUseCase, GetShipmentTrackingUseCase } from 'src/modules/shipping/application/use-cases/shipment-read.use-case';
import { CancelShipmentUseCase, ProcessShippingWebhookUseCase, SyncShipmentUseCase } from 'src/modules/shipping/application/use-cases/shipment-write.use-case';

@ApiTags('shipping') @ApiBearerAuth() @Controller()
export class ShippingController {
  constructor(
    @Inject(SHIPPING_PROVIDER_PORT) private readonly provider: ShippingProviderPort,
    @Inject(AutoShippingService) private readonly autoShippingService: AutoShippingService,
    @Inject(CreateShipmentUseCase) private readonly createShipment: CreateShipmentUseCase,
    @Inject(GetShipmentDetailUseCase) private readonly getShipmentDetail: GetShipmentDetailUseCase,
    @Inject(GetShipmentTrackingUseCase) private readonly getTracking: GetShipmentTrackingUseCase,
    @Inject(GetShipmentLabelUseCase) private readonly getLabel: GetShipmentLabelUseCase,
    @Inject(CancelShipmentUseCase) private readonly cancelShipmentUC: CancelShipmentUseCase,
    @Inject(SyncShipmentUseCase) private readonly syncShipmentUC: SyncShipmentUseCase,
    @Inject(ProcessShippingWebhookUseCase) private readonly webhookUC: ProcessShippingWebhookUseCase,
  ) {}

  @Permissions('shipping.read') @Get('admin/shipping/capabilities')
  async capabilities() { return { ...(await this.provider.getCapabilities()), providerConfig: this.providerConfigSummary() }; }

  @Permissions('shipping.read') @Get('admin/shipping/carriers')
  async carriers() { return { data: await this.provider.getCarriers() }; }

  @Permissions('shipping.read') @Get('admin/shipping/login-test')
  async loginTest() { return this.provider.testConnection(); }

  @Permissions('shipping.read') @Get('admin/shipping/rate-limit')
  async rateLimit() { return this.provider.getRateLimitStatus(); }

  @Permissions('shipping.retry') @Throttle({ default: { limit: 5, ttl: 60000 } }) @Post('admin/orders/:orderId/auto-shipping/retry')
  async retryAutoShipping(@Param('orderId') orderId: string) { return this.autoShippingService.runAfterCheckout({ orderId } as { orderId: string }); }

  @Permissions('shipping.quote') @Post('admin/shipping/quote')
  async quoteShipment(@Body() body: Record<string, unknown>) { return this.provider.quoteShipment(body as never); }

  @Permissions('shipping.create_guide') @Post('admin/orders/:orderId/shipment')
  async createOrderShipment(@Param('orderId') orderId: string, @Body() body: Record<string, unknown>, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.createShipment.execute({ orderId, body, actor, ipAddress: ip, userAgent: ua });
  }

  @Permissions('shipping.read') @Get('admin/orders/:orderId/shipment')
  async getShipment(@Param('orderId') orderId: string) { return this.getShipmentDetail.execute(orderId); }

  @Permissions('shipping.download_label') @Get('admin/shipments/:shipmentId/label')
  async getShipmentLabel(@Param('shipmentId') id: string) { return this.getLabel.execute(id); }

  @Permissions('tracking.read') @Get('admin/shipments/:shipmentId/tracking')
  async getShipmentTracking(@Param('shipmentId') id: string) { return this.getTracking.execute(id); }

  @Permissions('shipping.cancel') @Post('admin/shipments/:shipmentId/cancel')
  async cancelShipment(@Param('shipmentId') id: string, @Body() body: Record<string, unknown>, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.cancelShipmentUC.execute(id, body.reason as string | undefined, actor, ip, ua);
  }

  @Permissions('tracking.write') @Post('admin/shipments/:shipmentId/sync')
  async syncShipment(@Param('shipmentId') id: string, @CurrentUserDecorator() actor: CurrentUser, @Ip() ip: string, @Headers('user-agent') ua?: string) {
    return this.syncShipmentUC.execute(id, actor, ip, ua);
  }

  @Permissions('shipping.pickup') @Post('admin/pickups')
  async schedulePickup(@Body() body: Record<string, unknown>) {
    const shipmentIds = body.shipmentIds as string[] | undefined;
    const shipmentId = shipmentIds?.[0];
    if (!shipmentId) throw new BadRequestException('Selecciona al menos una guía.');
    const scheduledDate = body.scheduledDate ? new Date(body.scheduledDate as string) : new Date();
    return {
      shipmentIds,
      ...(await this.provider.schedulePickup({ shipmentId, scheduledDate })),
      operationalState: { status: 'api_ready', message: 'Recolección preparada por provider actual.' },
    };
  }

  @Permissions('shipping.read') @Get('admin/pickups')
  getPickups() { return { data: [], operationalState: { status: 'pending_provider', message: 'Recolecciones pendientes de documentación.' } }; }

  @Permissions('shipping.issues.read') @Get('admin/shipments/:shipmentId/issues')
  async getIssues(@Param('shipmentId') id: string) { return this.provider.getShipmentIssues(id); }

  @Permissions('shipping.read') @Get('admin/shipping/branch-issues')
  async getBranchIssues(@Query('branchCode') branchCode?: string) {
    const code = branchCode ?? process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE;
    if (!code) throw new BadRequestException('Requiere branchCode o NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE.');
    return this.provider.getBranchIssues(code);
  }

  @Permissions('shipping.issues.write') @Post('admin/shipping/branch-issues/:issueId')
  async updateBranchIssue(@Param('issueId') id: string, @Body() body: Record<string, unknown>) { return this.provider.updateBranchIssue(id, body as { guideNumber: string; issue: string; observations?: string }); }

  @Permissions('shipping.issues.write') @Post('admin/shipment-issues/:issueId/resolve')
  async resolveIssue(@Param('issueId') id: string) { return this.provider.resolveShipmentIssue(id); }

  @Permissions('shipping.returns.read') @Get('admin/shipments/:shipmentId/returns')
  async getReturns(@Param('shipmentId') id: string) { return this.provider.getReturns(id); }

  @Permissions('shipping.cod.read') @Get('admin/cod')
  async getCOD(@Query('shipmentId') shipmentId?: string) {
    if (!shipmentId) return { data: [], operationalState: { status: 'pending_provider', message: 'Requiere shipmentId para consultar COD.' } };
    return this.provider.getCashOnDeliveryStatus(shipmentId);
  }

  @Permissions('shipping.wallet.read') @Get('admin/wallet')
  async getWallet() { return this.provider.getWalletBalance(); }

  @Permissions('shipping.wallet.read') @Get('admin/wallet/transactions')
  async getWalletTx() { return this.provider.getWalletTransactions(); }

  @Permissions('shipping.wallet.read') @Get('admin/settlements')
  async getSettlements() { return this.provider.getSettlements(); }

  @Public() @Post('webhooks/99envios')
  async webhook99Envios(@Body() body: unknown, @Headers() headers: Record<string, string | string[] | undefined>) { return this.webhookUC.execute(body, headers); }

  private providerConfigSummary() {
    const provider = process.env.SHIPPING_PROVIDER ?? 'internal';
    const appEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'local';
    const production = appEnv === 'production';
    const hasCredentials = Boolean(process.env.NINETY_NINE_ENVIOS_API_BASE_URL && process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL && process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD);
    const status = provider === 'mock_99envios' ? 'mock_local' : provider === '99envios' && hasCredentials ? process.env.NINETY_NINE_ENVIOS_ENV === 'production' ? 'production_ready' : 'sandbox_ready' : provider === '99envios' ? 'pending_credentials' : 'pending_credentials';
    return { provider, env: process.env.NINETY_NINE_ENVIOS_ENV ?? 'sandbox', status, productionBlocked: production && (provider === 'mock_99envios' || process.env.ADMIN_AUTH_DISABLED === 'true' || (process.env.AUTO_SHIPPING_MODE === 'quote_and_create_guide' && provider !== '99envios') || (provider === '99envios' && !hasCredentials)), unsupportedByCurrentDocs: ['tracking directo 99 Envíos','webhooks reales','cancelación de guía','recolecciones API','wallet','liquidaciones','recaudo detallado','devoluciones','WhatsApp API','envíos masivos','consulta guía/preenvío','ciudades DANE API','sucursales API','transportadoras disponibles API'], hasApiBaseUrl: Boolean(process.env.NINETY_NINE_ENVIOS_API_BASE_URL), hasAuthEmail: Boolean(process.env.NINETY_NINE_ENVIOS_AUTH_EMAIL), hasAuthPassword: Boolean(process.env.NINETY_NINE_ENVIOS_AUTH_PASSWORD), hasIntegrationToken: Boolean(process.env.NINETY_NINE_ENVIOS_INTEGRATION_TOKEN), hasIntegrationId: Boolean(process.env.NINETY_NINE_ENVIOS_INTEGRATION_ID), hasBranchCode: Boolean(process.env.NINETY_NINE_ENVIOS_DEFAULT_BRANCH_CODE), hasOriginDaneCode: Boolean(process.env.NINETY_NINE_ENVIOS_DEFAULT_ORIGIN_DANE_CODE), codEnabled: process.env.NINETY_NINE_ENVIOS_ENABLE_COD === 'true', defaultPdfType: process.env.NINETY_NINE_ENVIOS_DEFAULT_PDF_TYPE ?? '2', seguro99: process.env.NINETY_NINE_ENVIOS_DEFAULT_SEGURO99 === 'true', seguro99plus: process.env.NINETY_NINE_ENVIOS_DEFAULT_SEGURO99PLUS === 'true' };
  }
}
