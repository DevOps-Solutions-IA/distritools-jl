import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { seedBrandTaxonomy } from 'src/modules/brands/infrastructure/seeds/brand-taxonomy.seed';
import { createTestApp, loginAsAdmin } from 'tests/helpers/test-app';
import {
  disconnectDatabase,
  prisma,
  resetDatabase,
  seedBaseData,
} from 'tests/helpers/test-db';

describe('Catalog modules', async () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let http: Awaited<ReturnType<typeof createTestApp>>['http'];
  let seeded: Awaited<ReturnType<typeof seedBaseData>>;
  let adminToken: string;

  before(async () => {
    const testApp = await createTestApp();
    app = testApp.app;
    http = testApp.http;
  });

  beforeEach(async () => {
    await resetDatabase();
    seeded = await seedBaseData();
    const admin = await loginAsAdmin(
      http,
      seeded.users.adminEmail,
      seeded.users.adminPassword,
      seeded.users.twoFactorSecret,
    );
    adminToken = admin.accessToken;
  });

  after(async () => {
    await app.close();
    await disconnectDatabase();
  });

  await it('crea brand, category, product y variant; luego reindexa búsqueda', async () => {
    const brand = await http
      .post('/api/v1/admin/brands')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Makita',
        slug: 'makita',
        description: 'Power tools',
      });
    assert.equal(brand.status, 201);

    const category = await http
      .post('/api/v1/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Taladros',
        slug: 'taladros',
        sortOrder: 1,
      });
    assert.equal(category.status, 201);

    const product = await http
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Taladro profesional',
        slug: 'taladro-profesional',
        brandId: brand.body.id,
        categoryId: category.body.id,
        description: 'Taladro de alto torque',
      });
    assert.equal(product.status, 201);

    const variant = await http
      .post('/api/v1/admin/variants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: product.body.id,
        sku: 'MK-900',
        name: 'Taladro 900W',
        price: '499.00',
        taxRate: '19.00',
      });
    assert.equal(variant.status, 201);

    await prisma.warehouse.create({
      data: {
        id: '01966f40-4d9c-7f40-a234-111111111111',
        name: 'WH-2',
        location: 'Bogota',
        isActive: true,
      },
    });

    await prisma.inventoryItem.create({
      data: {
        id: '01966f40-4d9c-7f40-a234-222222222222',
        variantId: variant.body.id,
        warehouseId: '01966f40-4d9c-7f40-a234-111111111111',
        onHandQty: 4,
        reservedQty: 0,
      },
    });

    const reindex = await http
      .post('/api/v1/admin/search/reindex/variants')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        ids: [variant.body.id],
      });
    assert.equal(reindex.status, 201);

    const publicVariants = await http.get('/api/v1/variants').query({
      productId: product.body.id,
    });
    assert.equal(publicVariants.status, 200);
    assert.equal(publicVariants.body.data.length, 1);

    const search = await http.get('/api/v1/search').query({ q: 'MK-900' });
    assert.equal(search.status, 200);
    assert.equal(search.body.data.some((entry: { sku: string }) => entry.sku === 'MK-900'), true);
  });

  await it('expone las 7 marcas obligatorias con metadata pública útil y seed idempotente', async () => {
    const initialBrands = await http.get('/api/v1/brands');
    assert.equal(initialBrands.status, 200);
    assert.equal(initialBrands.body.data.length, 7);

    const total = initialBrands.body.data.find((brand: { slug: string }) => brand.slug === 'total');
    assert.equal(Boolean(total), true);
    assert.deepEqual(total.metadata.productFamilies.includes('herramientas eléctricas'), true);
    assert.deepEqual(total.metadata.rules.doNotClaimOfficialDistributor, true);

    await seedBrandTaxonomy(prisma);
    const repeatedBrands = await http.get('/api/v1/brands');
    assert.equal(repeatedBrands.status, 200);
    assert.equal(repeatedBrands.body.data.length, 7);

    const uniqueSlugs = new Set(repeatedBrands.body.data.map((brand: { slug: string }) => brand.slug));
    assert.equal(uniqueSlugs.size, 7);
  });

  await it('siembra las categorías base y permite filtrar búsqueda por brandSlug', async () => {
    const categories = await http.get('/api/v1/categories');
    assert.equal(categories.status, 200);
    assert.equal(
      categories.body.data.some((category: { slug: string }) => category.slug === 'herramientas-electricas'),
      true,
    );
    assert.equal(
      categories.body.data.some((category: { slug: string }) => category.slug === 'soldadura'),
      true,
    );

    const filteredSearch = await http.get('/api/v1/search').query({
      q: 'TOTAL',
      brandSlug: 'total',
    });
    assert.equal(filteredSearch.status, 200);
    assert.equal(filteredSearch.body.data.length >= 1, true);
    assert.equal(
      filteredSearch.body.data.every((entry: { brandSlug?: string | null }) => entry.brandSlug === 'total'),
      true,
    );
  });

  await it('bloquea productos con categoría fuera del scope permitido por la marca', async () => {
    const truperBrand = await prisma.brand.findUniqueOrThrow({
      where: { slug: 'truper' },
    });
    const drywallCategory = await prisma.category.findUniqueOrThrow({
      where: { slug: 'drywall' },
    });

    const response = await http
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Producto fuera de taxonomía',
        slug: 'producto-fuera-taxonomia',
        brandId: truperBrand.id,
        categoryId: drywallCategory.id,
        description: 'Debe fallar por taxonomía',
      });

    assert.equal(response.status, 422);
  });
});
