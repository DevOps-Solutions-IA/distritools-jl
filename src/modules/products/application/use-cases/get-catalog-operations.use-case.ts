import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CurrentUser } from 'src/common/interfaces/current-user.interface';
import { assertHasPermissions } from 'src/common/utils/authorization.util';
import { PrismaService } from 'src/infra/db/prisma/prisma.service';
import { evaluateProductSellability } from 'src/modules/products/domain/services/catalog-sellability.service';

function number(value: Prisma.Decimal | number | string | null | undefined) {
  if (value && typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber();
  }
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function hasApprovedImage(metadata: Prisma.JsonValue | null) {
  const image = asRecord(asRecord(metadata).image);
  return image.status === 'approved' && typeof image.assetPath === 'string' && image.assetPath.trim().length > 0;
}

function hasDimensions(metadata: Prisma.JsonValue | null) {
  const shipping = asRecord(asRecord(metadata).shipping);
  const dimensions = asRecord(asRecord(metadata).dimensions);
  const source = Object.keys(shipping).length ? shipping : dimensions;
  return ['weightKg', 'lengthCm', 'widthCm', 'heightCm'].every((key) => Number(source[key] ?? 0) > 0)
    || ['weight', 'length', 'width', 'height'].every((key) => Number(source[key] ?? 0) > 0);
}

function isArchived(metadata: Prisma.JsonValue | null) {
  const metadataRecord = asRecord(metadata);
  return metadataRecord.catalogStatus === 'archived' || Boolean(metadataRecord.archivedAt);
}

function availableStock(variant: { inventoryItems: Array<{ onHandQty: number; reservedQty: number; committedQty: number }> }) {
  return variant.inventoryItems.reduce((total, item) => total + item.onHandQty - item.reservedQty - item.committedQty, 0);
}

@Injectable()
export class GetCatalogOperationsUseCase {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async execute(actor: CurrentUser, options: { range?: string } = {}) {
    assertHasPermissions(actor.permissions, ['catalog.read']);

    const from = this.rangeStart(options.range ?? '30d');
    const [products, brands, categories, priceAuditLogs] = await Promise.all([
      this.prisma.product.findMany({
        include: {
          brand: { select: { id: true, name: true, slug: true, isActive: true } },
          category: { select: { id: true, name: true, slug: true, isActive: true, parentId: true } },
          variants: {
            include: { inventoryItems: { include: { warehouse: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.brand.findMany({
        include: { products: { select: { id: true } } },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.category.findMany({
        include: { products: { select: { id: true } }, parent: { select: { id: true, name: true, slug: true } } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.auditLog.findMany({
        where: {
          entityType: 'variant',
          action: { in: ['variant.price_updated', 'variant.updated'] },
          createdAt: { gte: from },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const evaluations = new Map(products.map((product) => [product.id, evaluateProductSellability(product)]));
    const productRows = products.map((product) => {
      const evaluation = evaluations.get(product.id)!;
      const activeVariants = product.variants.filter((variant) => variant.isActive);
      const stock = product.variants.reduce((total, variant) => total + availableStock(variant), 0);
      const prices = activeVariants.map((variant) => number(variant.price)).filter((price) => price > 0);
      const primaryVariant = activeVariants[0] ?? product.variants[0] ?? null;

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        status: isArchived(product.metadata) ? 'archived' : product.isActive ? 'active' : 'inactive',
        isActive: product.isActive,
        brand: product.brand,
        category: product.category,
        variantsCount: product.variants.length,
        activeVariantsCount: activeVariants.length,
        primarySku: primaryVariant?.sku ?? null,
        priceFrom: prices.length ? Math.min(...prices) : null,
        availableStock: stock,
        hasApprovedImage: hasApprovedImage(product.metadata),
        hasDimensions: hasDimensions(product.metadata),
        sellability: evaluation,
        updatedAt: product.updatedAt.toISOString(),
      };
    });

    const sellableProductIds = new Set(productRows.filter((product) => product.sellability.sellable).map((product) => product.id));
    const brandRows = brands.map((brand) => {
      const associatedProducts = productRows.filter((product) => product.brand?.id === brand.id);
      return {
        id: brand.id,
        name: brand.name,
        slug: brand.slug,
        description: brand.description,
        status: brand.isActive ? 'active' : 'inactive',
        productCount: associatedProducts.length,
        sellableProductCount: associatedProducts.filter((product) => sellableProductIds.has(product.id)).length,
        createdAt: brand.createdAt.toISOString(),
        updatedAt: brand.updatedAt.toISOString(),
      };
    });
    const categoryRows = categories.map((category) => {
      const associatedProducts = productRows.filter((product) => product.category?.id === category.id);
      return {
        id: category.id,
        parentId: category.parentId,
        parent: category.parent,
        name: category.name,
        slug: category.slug,
        description: category.description,
        status: category.isActive ? 'active' : 'inactive',
        productCount: associatedProducts.length,
        sellableProductCount: associatedProducts.filter((product) => sellableProductIds.has(product.id)).length,
        createdAt: category.createdAt.toISOString(),
        updatedAt: category.updatedAt.toISOString(),
      };
    });
    const priceRows = products.flatMap((product) =>
      product.variants.map((variant) => ({
        id: variant.id,
        productId: product.id,
        product: product.name,
        sku: variant.sku,
        variant: variant.name,
        status: !variant.sku ? 'MISSING_SKU' : number(variant.price) <= 0 ? 'MISSING_PRICE' : variant.isActive ? 'READY' : 'INACTIVE',
        currentPrice: variant.price.toFixed(2),
        currency: 'COP',
        availableStock: availableStock(variant),
        missingCost: variant.inventoryItems.every((item) => item.costPrice === null),
        updatedAt: variant.updatedAt.toISOString(),
      })),
    );

    const metrics = {
      totalProducts: products.length,
      activeProducts: products.filter((product) => product.isActive && !isArchived(product.metadata)).length,
      inactiveProducts: products.filter((product) => !product.isActive && !isArchived(product.metadata)).length,
      archivedProducts: products.filter((product) => isArchived(product.metadata)).length,
      incompleteProducts: productRows.filter((product) => product.sellability.status !== 'SELLABLE').length,
      sellableProducts: productRows.filter((product) => product.sellability.sellable).length,
      notSellableProducts: productRows.filter((product) => !product.sellability.sellable).length,
      totalVariants: priceRows.length,
      variantsWithoutSku: priceRows.filter((row) => row.status === 'MISSING_SKU').length,
      variantsWithoutPrice: priceRows.filter((row) => row.status === 'MISSING_PRICE').length,
      variantsWithoutDimensions: productRows.filter((product) => !product.hasDimensions).length,
      productsWithoutMainImage: productRows.filter((product) => !product.hasApprovedImage).length,
      productsWithoutCategory: productRows.filter((product) => !product.category).length,
      productsWithoutBrand: productRows.filter((product) => !product.brand).length,
      outOfStockProducts: productRows.filter((product) => product.availableStock <= 0).length,
      lowStockProducts: productRows.filter((product) => product.availableStock > 0 && product.availableStock <= 5).length,
      missingCostProducts: productRows.filter((product) =>
        product.id && priceRows.some((row) => row.productId === product.id && row.missingCost),
      ).length,
      brandsCount: brands.length,
      categoriesCount: categories.length,
      priceChangesInPeriod: priceAuditLogs.length,
    };

    const blockers = [
      ...productRows
        .filter((product) => product.isActive && product.sellability.blockers.length)
        .map((product) => ({
          module: 'products',
          entityId: product.id,
          entity: product.name,
          status: product.sellability.status,
          blockers: product.sellability.blockers,
          href: `/admin/productos/${product.id}`,
        })),
      ...priceRows
        .filter((row) => row.status === 'MISSING_PRICE' || row.status === 'MISSING_SKU')
        .map((row) => ({
          module: 'prices',
          entityId: row.id,
          entity: row.sku || row.variant,
          status: row.status,
          blockers: [row.status],
          href: '/admin/precios',
        })),
    ];
    const warnings = [
      ...productRows
        .filter((product) => product.sellability.warnings.length)
        .map((product) => ({
          module: 'products',
          entityId: product.id,
          entity: product.name,
          status: 'INCOMPLETE',
          warnings: product.sellability.warnings,
          href: `/admin/productos/${product.id}`,
        })),
    ];
    const readiness = {
      products: blockers.some((blocker) => blocker.module === 'products') ? 'PARTIAL' : warnings.length ? 'GO_WITH_RISKS' : 'READY',
      brands: brandRows.some((brand) => brand.status !== 'active' && brand.productCount > 0) ? 'GO_WITH_RISKS' : 'READY',
      categories: categoryRows.some((category) => category.status !== 'active' && category.productCount > 0) ? 'GO_WITH_RISKS' : 'READY',
      inventory: 'READY',
      prices: priceRows.some((row) => row.status === 'MISSING_PRICE') ? 'PARTIAL' : 'READY',
      blockers,
      warnings,
      status: blockers.length ? 'PARTIAL' : warnings.length ? 'GO_WITH_RISKS' : 'READY',
    };

    return {
      generatedAt: new Date().toISOString(),
      range: options.range ?? '30d',
      metrics,
      readiness,
      products: productRows,
      brands: brandRows,
      categories: categoryRows,
      prices: priceRows,
      priceHistory: priceAuditLogs.map((log) => ({
        id: log.id,
        variantId: log.entityId,
        action: log.action,
        beforeData: log.beforeData,
        afterData: log.afterData,
        actorUserId: log.actorUserId,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }

  private rangeStart(range: string) {
    const now = new Date();
    if (range === 'today') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (range === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (range === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

