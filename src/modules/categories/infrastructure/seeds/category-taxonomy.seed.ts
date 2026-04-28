import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

export interface CategoryTaxonomyNode {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  children?: CategoryTaxonomyNode[];
}

const CATEGORY_TAXONOMY_PATH = path.resolve(
  process.cwd(),
  'data/catalog/category-taxonomy.json',
);

export async function readCategoryTaxonomy(): Promise<CategoryTaxonomyNode[]> {
  const raw = await readFile(CATEGORY_TAXONOMY_PATH, 'utf8');
  return JSON.parse(raw) as CategoryTaxonomyNode[];
}

export async function seedCategoryTaxonomy(
  prisma: PrismaClient,
  options: { records?: CategoryTaxonomyNode[] } = {},
) {
  const records = options.records ?? (await readCategoryTaxonomy());
  const seeded = new Map<string, string>();

  async function upsertNode(node: CategoryTaxonomyNode, parentId: string | null) {
    const category = await prisma.category.upsert({
      where: { slug: node.slug },
      update: {
        parentId,
        name: node.name,
        description: node.description,
        sortOrder: node.sortOrder,
        isActive: true,
      },
      create: {
        id: uuidv7(),
        parentId,
        name: node.name,
        slug: node.slug,
        description: node.description,
        sortOrder: node.sortOrder,
        isActive: true,
      },
    });

    seeded.set(node.slug, category.id);

    for (const child of node.children ?? []) {
      await upsertNode(child, category.id);
    }
  }

  for (const node of records) {
    await upsertNode(node, null);
  }

  return seeded;
}
