import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';

@Injectable()
export class GetWarehousesUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute() {
    const rows = await this.prisma.warehouse.findMany({
      include: { _count: { select: { inventoryItems: true, stockMovements: true } } },
      orderBy: [{ isDefault: 'desc' }, { priority: 'asc' }, { name: 'asc' }],
    });
    return {
      data: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        location: row.location,
        address: row.address,
        isDefault: row.isDefault,
        priority: row.priority,
        isActive: row.isActive,
        inventoryItems: row._count.inventoryItems,
        stockMovements: row._count.stockMovements,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    };
  }
}
