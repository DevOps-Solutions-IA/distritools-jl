import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RequestContextModule } from 'src/common/request/request-context.module';
import { RequestContextMiddleware } from 'src/common/request/request-context.middleware';
import { AuthModule } from 'src/modules/auth/auth.module';
import { RedisModule } from 'src/infra/cache/redis.module';
import { PrismaModule } from 'src/infra/db/prisma/prisma.module';
import { DomainEventsModule } from 'src/infra/events/in-memory-domain-event.publisher';
import { MonitoringModule } from 'src/infra/monitoring/monitoring.module';
import { BullQueueModule } from 'src/infra/queue/bullmq.module';
import { UsersModule } from 'src/modules/users/users.module';
import { RolesModule } from 'src/modules/roles/roles.module';
import { PermissionsModule } from 'src/modules/permissions/permissions.module';
import { InventoryModule } from 'src/modules/inventory/inventory.module';
import { StockMovementsModule } from 'src/modules/stock-movements/stock-movements.module';
import { OrdersModule } from 'src/modules/orders/orders.module';
import { PaymentsModule } from 'src/modules/payments/payments.module';
import { WebhooksModule } from 'src/modules/webhooks/webhooks.module';
import { AuditModule } from 'src/modules/audit/audit.module';
import { NotificationsModule } from 'src/modules/notifications/notifications.module';
import { SearchModule } from 'src/modules/search/search.module';
import { PromotionsModule } from 'src/modules/promotions/promotions.module';
import { ContentModule } from 'src/modules/content/content.module';
import { AnalyticsModule } from 'src/modules/analytics/analytics.module';
import { BrandsModule } from 'src/modules/brands/brands.module';
import { CategoriesModule } from 'src/modules/categories/categories.module';
import { ProductsModule } from 'src/modules/products/products.module';
import { VariantsModule } from 'src/modules/variants/variants.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    RequestContextModule,
    PrismaModule,
    RedisModule,
    DomainEventsModule,
    MonitoringModule,
    BullQueueModule,
    AuthModule,
    UsersModule,
    RolesModule,
    PermissionsModule,
    StockMovementsModule,
    InventoryModule,
    OrdersModule,
    WebhooksModule,
    PaymentsModule,
    AuditModule,
    NotificationsModule,
    SearchModule,
    PromotionsModule,
    ContentModule,
    AnalyticsModule,
    BrandsModule,
    CategoriesModule,
    ProductsModule,
    VariantsModule,
  ],
  providers: [RequestContextMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
