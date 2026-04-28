import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { ListStockMovementsUseCase } from 'src/modules/stock-movements/application/use-cases/list-stock-movements.use-case';
import {
  STOCK_MOVEMENT_REPOSITORY,
} from 'src/modules/stock-movements/domain/repositories/stock-movement.repository';
import { StockMovementsController } from 'src/modules/stock-movements/infrastructure/http/controllers/stock-movements.controller';
import { PrismaStockMovementRepository } from 'src/modules/stock-movements/infrastructure/repositories/prisma-stock-movement.repository';

@Module({
  imports: [AuthModule],
  controllers: [StockMovementsController],
  providers: [
    ListStockMovementsUseCase,
    PrismaStockMovementRepository,
    {
      provide: STOCK_MOVEMENT_REPOSITORY,
      useExisting: PrismaStockMovementRepository,
    },
  ],
  exports: [STOCK_MOVEMENT_REPOSITORY],
})
export class StockMovementsModule {}
