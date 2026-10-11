import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { InventoryOperationReadQuery, InventoryOperationReadRepository } from 'src/modules/inventory/domain/repositories/inventory-operation-read.repository';

@Injectable()
export class PrismaInventoryOperationReadRepository implements InventoryOperationReadRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listCounts({ page, limit }: InventoryOperationReadQuery) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventoryCountSession.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.inventoryCountSession.count(),
    ], { isolationLevel: 'RepeatableRead' });
    return { data, total };
  }

  findCount(id: string) {
    return this.prisma.inventoryCountSession.findUnique({
      where: { id }, include: { warehouse: true, lines: { orderBy: [{ sku: 'asc' }, { id: 'asc' }] } },
    });
  }

  async listImports({ page, limit }: InventoryOperationReadQuery) {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.inventoryImportBatch.findMany({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.inventoryImportBatch.count(),
    ], { isolationLevel: 'RepeatableRead' });
    return { data, total };
  }

  findImport(id: string) {
    return this.prisma.inventoryImportBatch.findUnique({
      where: { id }, include: { rows: { orderBy: [{ rowNumber: 'asc' }, { id: 'asc' }] } },
    });
  }
}
