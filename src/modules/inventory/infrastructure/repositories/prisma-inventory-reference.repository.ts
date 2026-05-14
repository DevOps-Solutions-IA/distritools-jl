import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { InventoryReferenceRepository } from 'src/modules/inventory/domain/repositories/inventory-reference.repository';

@Injectable()
export class PrismaInventoryReferenceRepository
  implements InventoryReferenceRepository
{
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findVariantById(id: string) {
    return this.prisma.variant.findUnique({
      where: { id },
      select: {
        id: true,
        productId: true,
        sku: true,
        name: true,
        isActive: true,
      },
    });
  }

  async findWarehouseById(id: string) {
    return this.prisma.warehouse.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    });
  }
}
