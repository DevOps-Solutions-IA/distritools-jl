import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

export interface BrandTaxonomyRecord {
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  commercialPriority: number;
  shortDescription: string;
  longDescription: string;
  industrialFocus: string[];
  productFamilies: string[];
  categorySlugs: string[];
  keywords: string[];
  logo: {
    assetPath: string | null;
    assetStatus: 'approved' | 'pending';
    notes: string;
  };
  sourceNotes: string[];
  rules: {
    allowProductAutoCreation: boolean;
    requiresManualSkuApproval: boolean;
    doNotClaimOfficialDistributor: boolean;
  };
}

const BRAND_TAXONOMY_PATH = path.resolve(
  process.cwd(),
  'data/catalog/brand-taxonomy.json',
);

export async function readBrandTaxonomy(): Promise<BrandTaxonomyRecord[]> {
  const raw = await readFile(BRAND_TAXONOMY_PATH, 'utf8');
  return JSON.parse(raw) as BrandTaxonomyRecord[];
}

export function buildBrandMetadata(record: BrandTaxonomyRecord): Prisma.JsonObject {
  return {
    status: record.status,
    commercialPriority: record.commercialPriority,
    shortDescription: record.shortDescription,
    longDescription: record.longDescription,
    industrialFocus: record.industrialFocus,
    productFamilies: record.productFamilies,
    categorySlugs: record.categorySlugs,
    keywords: record.keywords,
    logo: record.logo,
    sourceNotes: record.sourceNotes,
    rules: record.rules,
  };
}

export async function seedBrandTaxonomy(
  prisma: PrismaClient,
  options: { records?: BrandTaxonomyRecord[] } = {},
) {
  const records = options.records ?? (await readBrandTaxonomy());

  const seeded = [];

  for (const record of records) {
    const metadata = buildBrandMetadata(record);
    const brand = await prisma.brand.upsert({
      where: { slug: record.slug },
      update: {
        name: record.name,
        description: record.shortDescription,
        metadata,
        isActive: record.status === 'active',
      },
      create: {
        id: uuidv7(),
        name: record.name,
        slug: record.slug,
        description: record.shortDescription,
        metadata,
        isActive: record.status === 'active',
      },
    });

    seeded.push(brand);
  }

  return seeded;
}
