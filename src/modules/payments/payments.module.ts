import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { InventoryModule } from 'src/modules/inventory/inventory.module';
import { OrdersModule } from 'src/modules/orders/orders.module';
import { CreatePaymentIntentUseCase } from 'src/modules/payments/application/use-cases/create-payment-intent.use-case';
import { GetPaymentStatusUseCase } from 'src/modules/payments/application/use-cases/get-payment-status.use-case';
import { ProcessPaymentWebhookUseCase } from 'src/modules/payments/application/use-cases/process-payment-webhook.use-case';
import {
  PAYMENT_GATEWAY_PORT,
} from 'src/modules/payments/application/ports/payment-gateway.port';
import {
  PAYMENT_REPOSITORY,
} from 'src/modules/payments/domain/repositories/payment.repository';
import { PaymentPolicyService } from 'src/modules/payments/domain/services/payment-policy.service';
import { PaymentsController } from 'src/modules/payments/infrastructure/http/controllers/payments.controller';
import { MockPaymentGatewayAdapter } from 'src/modules/payments/infrastructure/gateways/mock-payment-gateway.adapter';
import { PrismaPaymentRepository } from 'src/modules/payments/infrastructure/repositories/prisma-payment.repository';
import { WebhooksModule } from 'src/modules/webhooks/webhooks.module';

@Module({
  imports: [AuthModule, InventoryModule, OrdersModule, WebhooksModule],
  controllers: [PaymentsController],
  providers: [
    CreatePaymentIntentUseCase,
    ProcessPaymentWebhookUseCase,
    GetPaymentStatusUseCase,
    PaymentPolicyService,
    PrismaPaymentRepository,
    MockPaymentGatewayAdapter,
    {
      provide: PAYMENT_REPOSITORY,
      useExisting: PrismaPaymentRepository,
    },
    {
      provide: PAYMENT_GATEWAY_PORT,
      useExisting: MockPaymentGatewayAdapter,
    },
  ],
  exports: [PAYMENT_REPOSITORY, ProcessPaymentWebhookUseCase],
})
export class PaymentsModule {}
