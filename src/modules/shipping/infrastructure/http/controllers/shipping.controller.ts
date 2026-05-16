import { Body, Controller, Get, Headers, Inject, Ip, Param, Post } from '@nestjs/common';
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

  @Permissions('shipping.read') @Get('admin/shipping/capabilities') async capabilities() { return this.provider.getCapabilities(); }
  @Permissions('shipping.read') @Get('admin/shipping/carriers') async carriers() { return this.provider.getCarriers(); }
  @Permissions('shipping.read') @Get('admin/shipping/login-test') async loginTest() { return this.provider.testConnection(); }
  @Permissions('shipping.read') @Get('admin/shipping/rate-limit') async rateLimit() { return this.provider.getRateLimitStatus(); }

  @Permissions('shipping.retry') @Throttle({ default: { limit: 5, ttl: 60000 } }) @Post('admin/orders/:orderId/auto-shipping/retry')
  async retryAutoShipping(@Param('orderId') orderId: string) { return this.autoShippingService.runAfterCheckout({ orderId } as { orderId: string }); }

  @Permissions('shipping.quote') @Post('admin/shipping/quote')
  async quoteShipment(@Body() body: Record<string, unknown>) { return this.provider.quoteShipment(body as any); }

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

  @Permissions('shipping.pickup') @Post('admin/pickups') async schedulePickup(@Body() body: Record<string, unknown>) { return this.provider.schedulePickup(body as any); }
  @Permissions('shipping.read') @Get('admin/pickups') async getPickups() { return { data: [] }; }
  @Permissions('shipping.issues.read') @Get('admin/shipments/:shipmentId/issues') async getIssues(@Param('shipmentId') id: string) { return this.provider.getShipmentIssues(id); }
  @Permissions('shipping.read') @Get('admin/shipping/branch-issues') async getBranchIssues() { return this.provider.getBranchIssues(''); }
  @Permissions('shipping.issues.write') @Post('admin/shipping/branch-issues/:issueId') async updateBranchIssue(@Param('issueId') id: string, @Body() body: Record<string, unknown>) { return this.provider.updateBranchIssue(id, body as any); }
  @Permissions('shipping.issues.write') @Post('admin/shipment-issues/:issueId/resolve') async resolveIssue(@Param('issueId') id: string) { return this.provider.resolveShipmentIssue(id); }
  @Permissions('shipping.returns.read') @Get('admin/shipments/:shipmentId/returns') async getReturns(@Param('shipmentId') id: string) { return this.provider.getReturns(id); }
  @Permissions('shipping.cod.read') @Get('admin/cod') async getCOD() { return this.provider.getCashOnDeliveryStatus(''); }
  @Permissions('shipping.wallet.read') @Get('admin/wallet') async getWallet() { return this.provider.getWalletBalance(); }
  @Permissions('shipping.wallet.read') @Get('admin/wallet/transactions') async getWalletTx() { return this.provider.getWalletTransactions(); }
  @Permissions('shipping.wallet.read') @Get('admin/settlements') async getSettlements() { return this.provider.getSettlements(); }
  @Public() @Post('webhooks/99envios') async webhook99Envios(@Body() body: unknown, @Headers() headers: Record<string, string | string[] | undefined>) { return this.webhookUC.execute(body, headers); }
}
