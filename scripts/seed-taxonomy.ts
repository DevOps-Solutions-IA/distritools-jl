import { PrismaClient } from '@prisma/client';
import { seedBrandTaxonomy } from 'src/modules/brands/infrastructure/seeds/brand-taxonomy.seed';
import { seedCategoryTaxonomy } from 'src/modules/categories/infrastructure/seeds/category-taxonomy.seed';
import { seedMasterProductCatalog } from 'src/modules/products/infrastructure/seeds/master-product-catalog.seed';

const prisma = new PrismaClient();

async function main() {
  const categories = await seedCategoryTaxonomy(prisma);
  const brands = await seedBrandTaxonomy(prisma);
  const products = await seedMasterProductCatalog(prisma);

  console.log(
    JSON.stringify({
      status: 'ok',
      categories: categories.size,
      brands: brands.length,
      products: products.length,
    }),
  );
}

void main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
