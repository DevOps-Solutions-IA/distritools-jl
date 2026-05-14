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
            isActive: true,
            metadata: true,
            brandId: true,
            categoryId: true,
            brand: { select: { isActive: true } },
            category: { select: { isActive: true } },
          },
        },
      },
    });

    return variants.map((variant) => {
      const product = variant.product as
        | {
            isActive: boolean;
            metadata: unknown | null;
            brandId: string | null;
            categoryId: string | null;
            brand: { isActive: boolean } | null;
            category: { isActive: boolean } | null;
          }
        | null;

      return {
        id: variant.id,
        productId: variant.productId,
        productIsActive: product?.isActive ?? null,
        productMetadata: product?.metadata ?? null,
        brandId: product?.brandId ?? null,
        brandIsActive: product?.brand?.isActive ?? null,
        categoryId: product?.categoryId ?? null,
        categoryIsActive: product?.category?.isActive ?? null,
        sku: variant.sku,
        name: variant.name,
        price: variant.price.toFixed(2),
        taxRate: variant.taxRate.toFixed(2),
        isActive: variant.isActive,
      };
    });
  }
}
