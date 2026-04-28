import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { InventoryModule } from 'src/modules/inventory/inventory.module';
import { CreateOrderUseCase } from 'src/modules/orders/application/use-cases/create-order.use-case';
import { CreateGuestCheckoutOrderUseCase } from 'src/modules/orders/application/use-cases/create-guest-checkout-order.use-case';
import { CancelOrderUseCase } from 'src/modules/orders/application/use-cases/cancel-order.use-case';
import { GetOrderUseCase } from 'src/modules/orders/application/use-cases/get-order.use-case';
import {
  ORDER_REPOSITORY,
} from 'src/modules/orders/domain/repositories/order.repository';
import {
  ORDER_VARIANT_REPOSITORY,
} from 'src/modules/orders/domain/repositories/order-variant.repository';
import { OrderNumberService } from 'src/modules/orders/domain/services/order-number.service';
import { OrderPolicyService } from 'src/modules/orders/domain/services/order-policy.service';
import { CheckoutController } from 'src/modules/orders/infrastructure/http/controllers/checkout.controller';
import { OrdersController } from 'src/modules/orders/infrastructure/http/controllers/orders.controller';
import { PrismaOrderRepository } from 'src/modules/orders/infrastructure/repositories/prisma-order.repository';
import { PrismaOrderVariantRepository } from 'src/modules/orders/infrastructure/repositories/prisma-order-variant.repository';
import {
  ORDER_ITEM_REPOSITORY,
} from 'src/modules/order-items/domain/repositories/order-item.repository';
import { PrismaOrderItemRepository } from 'src/modules/order-items/infrastructure/repositories/prisma-order-item.repository';
import { PromotionsModule } from 'src/modules/promotions/promotions.module';

@Module({
  imports: [AuthModule, InventoryModule, PromotionsModule],
  controllers: [OrdersController, CheckoutController],
  providers: [
    CreateOrderUseCase,
    CreateGuestCheckoutOrderUseCase,
    CancelOrderUseCase,
    GetOrderUseCase,
    OrderNumberService,
    OrderPolicyService,
    PrismaOrderRepository,
    PrismaOrderVariantRepository,
    PrismaOrderItemRepository,
    {
      provide: ORDER_REPOSITORY,
      useExisting: PrismaOrderRepository,
    },
    {
      provide: ORDER_VARIANT_REPOSITORY,
      useExisting: PrismaOrderVariantRepository,
    },
    {
      provide: ORDER_ITEM_REPOSITORY,
      useExisting: PrismaOrderItemRepository,
    },
  ],
  exports: [
    ORDER_REPOSITORY,
    ORDER_ITEM_REPOSITORY,
    CreateOrderUseCase,
    CreateGuestCheckoutOrderUseCase,
    CancelOrderUseCase,
    GetOrderUseCase,
  ],
})
export class OrdersModule {}
