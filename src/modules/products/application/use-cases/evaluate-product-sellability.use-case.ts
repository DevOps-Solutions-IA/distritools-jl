import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import {
  AUDIT_REPOSITORY,
  AuditRepository,
} from 'src/modules/auth/domain/repositories/audit.repository';
import { evaluateProductSellability } from 'src/modules/products/domain/services/catalog-sellability.service';

@Injectable()
export class EvaluateProductSellabilityUseCase {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(AUDIT_REPOSITORY)
    private readonly auditRepository: AuditRepository,
  ) {}

  async execute(input: {
    actor: CurrentUser;
    productId: string;
    audit?: boolean;
    ipAddress?: string;
    userAgent?: string;
  }) {
    assertHasPermissions(input.actor.permissions, ['products.read']);

    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      include: {
        brand: { select: { id: true, name: true, slug: true, isActive: true } },
        category: { select: { id: true, name: true, slug: true, isActive: true } },
        variants: {
          include: {
            inventoryItems: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }

    const evaluation = evaluateProductSellability(product);
    const response = {
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      ...evaluation,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        active: variant.isActive,
        price: variant.price.toFixed(2),
        availableStock: variant.inventoryItems.reduce(
          (total, item) => total + item.onHandQty - item.reservedQty - item.committedQty,
          0,
        ),
      })),
    };

    if (input.audit) {
      await this.auditRepository.write({
        actorUserId: input.actor.sub,
        action: 'product.sellability_validated',
        entityType: 'product',
        entityId: product.id,
        afterData: {
          status: response.status,
          sellable: response.sellable,
          blockers: response.blockers,
          warnings: response.warnings,
        },
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });
    }

    return response;
  }
}

