import { Module } from '@nestjs/common';
import { AuthModule } from 'src/modules/auth/auth.module';
import { AdjustStockUseCase } from 'src/modules/inventory/application/use-cases/adjust-stock.use-case';
import { CommitStockUseCase } from 'src/modules/inventory/application/use-cases/commit-stock.use-case';
import { GetInventoryAlertsUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-alerts.use-case';
import { GetInventoryItemUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-item.use-case';
import { GetInventoryOverviewUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-overview.use-case';
import { GetInventoryValuationUseCase } from 'src/modules/inventory/application/use-cases/get-inventory-valuation.use-case';
import { GetReservationsUseCase } from 'src/modules/inventory/application/use-cases/get-reservations.use-case';
import { GetStockMovementsUseCase } from 'src/modules/inventory/application/use-cases/get-stock-movements.use-case';
import { GetWarehousesUseCase } from 'src/modules/inventory/application/use-cases/get-warehouses.use-case';
import { ProcessReturnUseCase } from 'src/modules/inventory/application/use-cases/process-return.use-case';
import { UpdateInventorySettingsUseCase } from 'src/modules/inventory/application/use-cases/update-inventory-settings.use-case';
import { ReleaseStockUseCase } from 'src/modules/inventory/application/use-cases/release-stock.use-case';
import { ReserveStockUseCase } from 'src/modules/inventory/application/use-cases/reserve-stock.use-case';
import {
  INVENTORY_REFERENCE_REPOSITORY,
} from 'src/modules/inventory/domain/repositories/inventory-reference.repository';
import {
  INVENTORY_REPOSITORY,
} from 'src/modules/inventory/domain/repositories/inventory.repository';
import { InventoryPolicyService } from 'src/modules/inventory/domain/services/inventory-policy.service';
import { InventoryController } from 'src/modules/inventory/infrastructure/http/controllers/inventory.controller';
import { PrismaInventoryReferenceRepository } from 'src/modules/inventory/infrastructure/repositories/prisma-inventory-reference.repository';
import { PrismaInventoryRepository } from 'src/modules/inventory/infrastructure/repositories/prisma-inventory.repository';
import { StockMovementsModule } from 'src/modules/stock-movements/stock-movements.module';

@Module({
  imports: [AuthModule, StockMovementsModule],
  controllers: [InventoryController],
  providers: [
    ReserveStockUseCase,
    ReleaseStockUseCase,
    CommitStockUseCase,
    AdjustStockUseCase,
    GetInventoryItemUseCase,
    GetInventoryOverviewUseCase,
    GetWarehousesUseCase,
    GetStockMovementsUseCase,
    GetInventoryAlertsUseCase,
    GetInventoryValuationUseCase,
    GetReservationsUseCase,
    UpdateInventorySettingsUseCase,
    ProcessReturnUseCase,
    InventoryPolicyService,
    PrismaInventoryRepository,
    PrismaInventoryReferenceRepository,
    {
      provide: INVENTORY_REPOSITORY,
      useExisting: PrismaInventoryRepository,
    },
    {
      provide: INVENTORY_REFERENCE_REPOSITORY,
      useExisting: PrismaInventoryReferenceRepository,
    },
  ],
  exports: [
    ReserveStockUseCase,
    ReleaseStockUseCase,
    CommitStockUseCase,
    AdjustStockUseCase,
    INVENTORY_REPOSITORY,
  ],
})
export class InventoryModule {}
