import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { OrderVariantRepository } from 'src/modules/orders/domain/repositories/order-variant.repository';

@Injectable()
export class PrismaOrderVariantRepository implements OrderVariantRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findByIds(ids: string[]) {
    const variants = await this.prisma.variant.findMany({
      where: {
        id: {
          in: ids,
        },
      },
      select: {
        id: true,
        productId: true,
        sku: true,
        name: true,
        price: true,
        taxRate: true,
        isActive: true,
        product: {
          select: {
            brandId: true,
            categoryId: true,
          },
        },
      },
    });

    return variants.map((variant) => {
      const product = variant.product as
        | { brandId: string | null; categoryId: string | null }
        | null;

      return {
        id: variant.id,
        productId: variant.productId,
        brandId: product?.brandId ?? null,
        categoryId: product?.categoryId ?? null,
        sku: variant.sku,
        name: variant.name,
        price: variant.price.toFixed(2),
        taxRate: variant.taxRate.toFixed(2),
        isActive: variant.isActive,
      };
    });
  }
}
