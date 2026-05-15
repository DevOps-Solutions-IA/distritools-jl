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
  PAYMENT_PROVIDER_PORT,
} from 'src/modules/payments/application/ports/payment-provider.port';
import {
  PAYMENT_REPOSITORY,
} from 'src/modules/payments/domain/repositories/payment.repository';
import { PaymentPolicyService } from 'src/modules/payments/domain/services/payment-policy.service';
import { PaymentPayloadProtectionService } from 'src/modules/payments/domain/services/payment-payload-protection.service';
import { PaymentsController } from 'src/modules/payments/infrastructure/http/controllers/payments.controller';
import { MockPaymentGatewayAdapter } from 'src/modules/payments/infrastructure/gateways/mock-payment-gateway.adapter';
import { NullPaymentAdapter } from 'src/modules/payments/infrastructure/gateways/null-payment.adapter';
import { PayUPaymentAdapter } from 'src/modules/payments/infrastructure/gateways/payu-payment.adapter';
import { WompiPaymentAdapter } from 'src/modules/payments/infrastructure/gateways/wompi-payment.adapter';
import { PrismaPaymentRepository } from 'src/modules/payments/infrastructure/repositories/prisma-payment.repository';
import { WebhooksModule } from 'src/modules/webhooks/webhooks.module';

@Module({
  imports: [AuthModule, InventoryModule, OrdersModule, WebhooksModule],
  controllers: [PaymentsController],
  providers: [
    CreatePaymentIntentUseCase,
    ProcessPaymentWebhookUseCase,
    GetPaymentStatusUseCase,
    PaymentPayloadProtectionService,
    PaymentPolicyService,
    PrismaPaymentRepository,
    MockPaymentGatewayAdapter,
    NullPaymentAdapter,
    WompiPaymentAdapter,
    PayUPaymentAdapter,
    {
      provide: PAYMENT_REPOSITORY,
      useExisting: PrismaPaymentRepository,
    },
    {
      provide: PAYMENT_GATEWAY_PORT,
      useExisting: MockPaymentGatewayAdapter,
    },
    {
      provide: PAYMENT_PROVIDER_PORT,
      useExisting: NullPaymentAdapter,
    },
  ],
  exports: [PAYMENT_REPOSITORY, PAYMENT_PROVIDER_PORT, ProcessPaymentWebhookUseCase],
})
export class PaymentsModule {}
