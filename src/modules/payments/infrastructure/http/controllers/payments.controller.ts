import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Ip,
  Inject,
  Param,
  Post,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUserDecorator } from 'src/common/decorators/current-user.decorator';
import { Permissions } from 'src/common/decorators/permissions.decorator';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { CreatePaymentIntentUseCase } from 'src/modules/payments/application/use-cases/create-payment-intent.use-case';
import { GetPaymentStatusUseCase } from 'src/modules/payments/application/use-cases/get-payment-status.use-case';
import { ProcessPaymentWebhookUseCase } from 'src/modules/payments/application/use-cases/process-payment-webhook.use-case';
import { CreatePaymentIntentRequestDto } from 'src/modules/payments/infrastructure/http/dto/create-payment-intent.request.dto';
import { Request } from 'express';

@ApiTags('payments')
@Controller()
export class PaymentsController {
  constructor(
    @Inject(CreatePaymentIntentUseCase)
    private readonly createPaymentIntentUseCase: CreatePaymentIntentUseCase,
    @Inject(GetPaymentStatusUseCase)
    private readonly getPaymentStatusUseCase: GetPaymentStatusUseCase,
    @Inject(ProcessPaymentWebhookUseCase)
    private readonly processPaymentWebhookUseCase: ProcessPaymentWebhookUseCase,
  ) {}

  @Public()
  @Post('payments/:orderNumber/initiate')
  createIntent(
    @Param('orderNumber') orderNumber: string,
    @Body() body: CreatePaymentIntentRequestDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.createPaymentIntentUseCase.execute({
      orderNumber,
      gateway: body.gateway,
      ipAddress,
      userAgent,
    });
  }

  @ApiBearerAuth()
  @Permissions('payments.read', 'reports.financial.read')
  @Get('admin/payments/:paymentId')
  getStatus(
    @Param('paymentId') paymentId: string,
    @CurrentUserDecorator() actor: CurrentUser,
  ) {
    return this.getPaymentStatusUseCase.execute({
      actor,
      paymentId,
    });
  }

  @Public()
  @Post('payments/webhook/:gateway')
  processWebhook(
    @Param('gateway') gateway: string,
    @Headers('x-signature') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!(req.rawBody instanceof Buffer)) {
      throw new BadRequestException('Raw webhook payload is required');
    }

    return this.processPaymentWebhookUseCase.execute({
      gateway,
      signature,
      payload: req.rawBody.toString('utf8'),
    });
  }
}
