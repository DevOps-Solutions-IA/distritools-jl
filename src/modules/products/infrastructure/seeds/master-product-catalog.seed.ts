import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

export type CatalogAvailabilitySeed = 'in-stock' | 'low-stock' | 'out-of-stock' | 'by-request';
export type CatalogConfidence = 'high' | 'medium' | 'low';

export interface MasterProductCatalogRecord {
  name: string;
  slug: string;
  brandSlug: string;
  categorySlug: string;
  family: string;
  subcategory: string;
  shortDescription: string;
  longDescription: string;
  presentation: string;
  unit: string;
  packageSize: string;
  sku: string | null;
  price: number | null;
  currency: 'COP';
  taxRate: number;
  stockQuantity: number;
  availability: CatalogAvailabilitySeed;
  attributes: Array<{ label: string; value: string }>;
  tags: string[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
    ogTitle: string;
    ogDescription: string;
    ogImage?: string | null;
  };
  image: {
    status: 'approved' | 'pending';
    assetPath: string | null;
    notes: string;
  };
  source: {
    type: 'official' | 'internal' | 'distributor' | 'secondary';
    name: string;
    url: string;
    retrievedAt: string;
    confidence: CatalogConfidence;
  };
}

const MASTER_PRODUCTS_PATH = path.resolve(process.cwd(), 'data/catalog/master-products.json');

export async function readMasterProductCatalog(): Promise<MasterProductCatalogRecord[]> {
  const raw = await readFile(MASTER_PRODUCTS_PATH, 'utf8');
  return JSON.parse(raw) as MasterProductCatalogRecord[];
}

export function buildProductMetadata(record: MasterProductCatalogRecord): Prisma.JsonObject {
  return {
    family: record.family,
    subcategory: record.subcategory,
    longDescription: record.longDescription,
    presentation: record.presentation,
    unit: record.unit,
    packageSize: record.packageSize,
    availability: record.availability,
    attributes: record.attributes,
    tags: record.tags,
    seo: record.seo,
    image: record.image,
    source: record.source,
  } as Prisma.JsonObject;
}

export async function seedMasterProductCatalog(
  prisma: PrismaClient,
  options: {
    records?: MasterProductCatalogRecord[];
    warehouseId?: string;
  } = {},
) {
  const records = options.records ?? (await readMasterProductCatalog());
  const warehouseId =
    options.warehouseId ??
    (await prisma.warehouse.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }))?.id ??
    null;

  const seededProducts = [];

  for (const record of records) {
    const brand = await prisma.brand.findUnique({
      where: { slug: record.brandSlug },
      select: { id: true, name: true },
    });
    const category = await prisma.category.findUnique({
      where: { slug: record.categorySlug },
      select: { id: true, name: true },
    });

    if (!brand || !category) {
      throw new Error(
        `Catálogo maestro inválido para ${record.slug}: marca=${record.brandSlug}, categoria=${record.categorySlug}`,
      );
    }

    const product = await prisma.product.upsert({
      where: { slug: record.slug },
      update: {
        brandId: brand.id,
        categoryId: category.id,
        name: record.name,
        description: record.shortDescription,
        metadata: buildProductMetadata(record),
        isActive: true,
      },
      create: {
        id: uuidv7(),
        brandId: brand.id,
        categoryId: category.id,
        name: record.name,
        slug: record.slug,
        description: record.shortDescription,
        metadata: buildProductMetadata(record),
        isActive: true,
      },
    });

    if (record.sku && record.price !== null) {
      const variant = await prisma.variant.upsert({
        where: { sku: record.sku },
        update: {
          productId: product.id,
          name: record.presentation,
          price: new Prisma.Decimal(record.price),
          taxRate: new Prisma.Decimal(record.taxRate),
          isActive: true,
        },
        create: {
          id: uuidv7(),
          productId: product.id,
          sku: record.sku,
          name: record.presentation,
          price: new Prisma.Decimal(record.price),
          taxRate: new Prisma.Decimal(record.taxRate),
          isActive: true,
        },
      });

      if (warehouseId) {
        await prisma.inventoryItem.upsert({
          where: {
            variantId_warehouseId: {
              variantId: variant.id,
              warehouseId,
            },
          },
          update: {
            onHandQty: record.stockQuantity,
          },
          create: {
            id: uuidv7(),
            variantId: variant.id,
            warehouseId,
            onHandQty: record.stockQuantity,
            reservedQty: 0,
          },
        });
      }

      const searchText = [
        record.name,
        record.presentation,
        record.sku,
        brand.name,
        record.brandSlug,
        record.categorySlug,
        record.family,
        record.subcategory,
        ...record.tags,
      ]
        .filter(Boolean)
        .join(' ');

      const existingSearchDocument = await prisma.searchDocument.findFirst({
        where: {
          documentType: 'variant',
          variantId: variant.id,
        },
        select: { id: true },
      });

      if (existingSearchDocument) {
        await prisma.searchDocument.update({
          where: { id: existingSearchDocument.id },
          data: {
            title: record.name,
            subtitle: record.presentation,
            sku: record.sku,
            brandName: brand.name,
            brandSlug: record.brandSlug,
            categoryName: category.name,
            categorySlug: record.categorySlug,
            searchText,
            isActive: true,
            availability: record.stockQuantity,
            priority: record.source.confidence === 'high' ? 20 : 10,
          },
        });
      } else {
        await prisma.searchDocument.create({
          data: {
            id: uuidv7(),
            documentType: 'variant',
            variantId: variant.id,
            title: record.name,
            subtitle: record.presentation,
            sku: record.sku,
            brandName: brand.name,
            brandSlug: record.brandSlug,
            categoryName: category.name,
            categorySlug: record.categorySlug,
            placementKey: null,
            searchText,
            isActive: true,
            availability: record.stockQuantity,
            priority: record.source.confidence === 'high' ? 20 : 10,
          },
        });
      }
    }

    seededProducts.push(product);
  }

  return seededProducts;
}
