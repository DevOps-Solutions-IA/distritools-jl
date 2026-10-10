import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BadRequestException } from '@nestjs/common';
import { STOREFRONT_ROUTE_QUERY_KEYS, STOREFRONT_QUERY_VALUES } from 'src/modules/admin-operations/application/storefront-route-registry';
import { assertFooterRoutes, inspectFooterHref, FooterRouteClient, FOOTER_LINK_LIMIT } from 'src/modules/admin-operations/application/footer-route-authority';

const loadGenerator = createRequire(join(process.cwd(), 'tests/unit/ex07-4-footer-routes.unit.test.ts'));
const generator = loadGenerator('../../scripts/generate-storefront-route-registry.js') as {
  discoverRoutes(appDirectory: string): string[];
  renderRegistry(projectRoot?: string): string;
  assertRegistryArtifacts(projectRoot?: string, expected?: string): void;
  extractPageQueryKeys(source: string): string[];
  extractRedirects(source: string): Map<string, string>;
  extractQueryValues(source: string): Record<string, string[]>;
  routesFromManifest(manifest: Record<string, string>): string[];
  assertManifestParity(source: readonly string[], manifest: Record<string, string>): void;
};

function client(active: boolean | null = true) {
  const reads: { kind: string; slug: string }[] = [];
  let visibility = active;
  const delegate = (kind: string) => ({ findUnique: async (args: { where: { slug: string }; select: { isActive: true } }) => {
    assert.deepEqual(args.select, { isActive: true });
    reads.push({ kind, slug: args.where.slug });
    return visibility === null ? null : { isActive: visibility };
  } });
  return { db: { product: delegate('product'), category: delegate('category'), brand: delegate('brand') } as unknown as FooterRouteClient, reads, setActive: (next: boolean | null) => { visibility = next; } };
}

describe('EX-07.4 canonical footer routes', () => {
  it('the checked-in registry is exactly the current real source registry', () => {
    const canonical = generator.renderRegistry();
    assert.equal(readFileSync('src/modules/admin-operations/application/storefront-route-registry.ts', 'utf8'), canonical);
    assert.equal(readFileSync('frontend/src/lib/generated/storefront-route-registry.ts', 'utf8'), canonical);
    generator.assertRegistryArtifacts();
  });

  it('checks backend/frontend artifact parity and rejects missing or stale frontend output without a fabricated manifest', () => {
    const dir = mkdtempSync(join(tmpdir(), 'footer-registry-artifact-'));
    const canonical = generator.renderRegistry();
    const backend = join(dir, 'src/modules/admin-operations/application/storefront-route-registry.ts');
    const frontend = join(dir, 'frontend/src/lib/generated/storefront-route-registry.ts');
    try {
      mkdirSync(join(backend, '..'), { recursive: true });
      writeFileSync(backend, canonical);
      assert.throws(() => generator.assertRegistryArtifacts(dir, canonical), /Canonical.*frontend/);
      mkdirSync(join(frontend, '..'), { recursive: true });
      writeFileSync(frontend, canonical + '// stale output\n');
      assert.throws(() => generator.assertRegistryArtifacts(dir, canonical), /Canonical.*frontend/);
      writeFileSync(frontend, canonical);
      generator.assertRegistryArtifacts(dir, canonical);
      writeFileSync(backend, canonical + '// stale output\n');
      assert.throws(() => generator.assertRegistryArtifacts(dir, canonical), /Canonical.*src\/modules/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('source and manifest normalize root, groups and public aliases consistently, excluding admin/API/private/intercepts', () => {
    const dir = mkdtempSync(join(tmpdir(), 'footer-route-source-'));
    const pages = ['page.tsx', '(shop)/productos/[slug]/page.tsx', 'storefront/productos/[slug]/page.tsx', '(shop)/contacto/page.tsx', 'admin/page.tsx', 'api/test/route.ts', '_internal/page.tsx', '@modal/(.)productos/[slug]/page.tsx'];
    try {
      for (const page of pages) { mkdirSync(join(dir, page, '..'), { recursive: true }); writeFileSync(join(dir, page), 'export default function Page() {}'); }
      const source = generator.discoverRoutes(dir);
      assert.deepEqual(source, ['/', '/contacto', '/productos/[slug]', '/storefront/productos/[slug]']);
      const manifest = Object.fromEntries(pages.map((page) => [ `/${page.replace(/\.[^.]+$/, '')}`, `app/${page.replace(/\.[^.]+$/, '.js')}` ]));
      assert.deepEqual(generator.routesFromManifest(manifest), source);
      generator.assertManifestParity(source, manifest);
      assert.throws(() => generator.assertManifestParity(source, { ...manifest, '/fantasma/page': 'app/fantasma/page.js' }), /manifest/);
      assert.throws(() => generator.assertManifestParity(source, { '/page': 'app/page.js' }), /manifest/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('accepts real static pages without consulting catalog delegates', async () => {
    const { db, reads } = client();
    for (const href of ['/', '/contacto', '/productos', '/marcas', '/categorias', '/terminos-y-condiciones']) {
      assert.equal((await inspectFooterHref(db, href)).valid, true, href);
    }
    assert.deepEqual(reads, []);
  });

  for (const [family, kind] of [['productos', 'product'], ['categorias', 'category'], ['marcas', 'brand']]) {
    it(`resolves current active ${kind} for canonical and real legacy pages`, async () => {
      const { db, reads } = client();
      for (const prefix of ['', '/storefront']) assert.equal((await inspectFooterHref(db, `${prefix}/${family}/taladro-01`)).valid, true);
      assert.deepEqual(reads, [{ kind, slug: 'taladro-01' }, { kind, slug: 'taladro-01' }]);
    });
    it(`rejects missing and inactive ${kind} and rechecks after depublication`, async () => {
      assert.equal((await inspectFooterHref(client(null).db, `/${family}/ausente`)).valid, false);
      assert.equal((await inspectFooterHref(client(false).db, `/${family}/inactivo`)).valid, false);
      const { db, setActive } = client(true);
      assert.equal((await inspectFooterHref(db, `/${family}/activo`)).valid, true);
      setActive(false);
      assert.equal((await inspectFooterHref(db, `/${family}/activo`)).valid, false);
    });
  }

  it('rejects missing routes, non-public paths, invented CMS paths and unsupported dynamic routes before reads', async () => {
    const { db, reads } = client();
    for (const href of ['/ruta-inexistente', '/contenido/borrador', '/legal/pagina', '/admin', '/admin/footer', '/api/v1/products', '/storefront/orden/pedido', '/productos/slug/extra']) assert.equal((await inspectFooterHref(db, href)).valid, false, href);
    assert.deepEqual(reads, []);
  });

  it('rejects dangerous or manipulated paths without normalization or lookup', async () => {
    const { db, reads } = client();
    for (const href of ['https://evil.test', 'javascript:alert(1)', '//evil.test', '/\\evil', '/productos//slug', '/productos/../contacto', '/productos/%2f', '/productos/%2F', '/productos/%5c', '/productos/%252f', '/productos/%2e%2e', '/contacto?next=https://evil.test', '/contacto#x', '/contacto/', ' /contacto', '/contacto\n', '/productos/slug\n', '/categorias/slug\r\n', '/productos/á', '/productos/slug;evil']) assert.equal((await inspectFooterHref(db, href)).valid, false, href);
    assert.deepEqual(reads, []);
  });

  it('throws concrete 400 group/link errors and makes no mutations', async () => {
    const { db, reads } = client(null);
    await assert.rejects(assertFooterRoutes(db, [{ links: [{ href: '/contacto' }, { href: '/productos/no-publicado' }] }]), (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.getStatus(), 400);
      assert.match(error.message, /grupo 1.*enlace 2/i);
      assert.match(error.message, /publicado/);
      return true;
    });
    assert.deepEqual(reads, [{ kind: 'product', slug: 'no-publicado' }]);
  });

  it('derives catalog query keys and status/sort values from real pages/UI, including Next redirects', () => {
    assert.deepEqual(STOREFRONT_ROUTE_QUERY_KEYS['/productos'], ['brand', 'category', 'q', 'sort', 'status']);
    assert.deepEqual(STOREFRONT_ROUTE_QUERY_KEYS['/buscar'], ['q']);
    assert.deepEqual(STOREFRONT_ROUTE_QUERY_KEYS['/categorias/[slug]'], ['brand', 'q', 'sort', 'status']);
    assert.deepEqual(STOREFRONT_ROUTE_QUERY_KEYS['/marcas/[slug]'], ['category', 'q', 'sort', 'status']);
    assert.deepEqual(STOREFRONT_ROUTE_QUERY_KEYS['/productos/[slug]'], []);
    assert.deepEqual(STOREFRONT_ROUTE_QUERY_KEYS['/storefront/productos'], STOREFRONT_ROUTE_QUERY_KEYS['/productos']);
    assert.deepEqual(STOREFRONT_ROUTE_QUERY_KEYS['/storefront/categorias/[slug]'], STOREFRONT_ROUTE_QUERY_KEYS['/categorias/[slug]']);
    assert.deepEqual(STOREFRONT_QUERY_VALUES.status, ['all', 'available', 'low-stock']);
    assert.deepEqual(STOREFRONT_QUERY_VALUES.sort, ['featured', 'name-asc', 'name-desc', 'price-asc', 'price-desc']);
  });

  it('uses AST source authority and detects query-source drift without relying on comments or fabricated lists', () => {
    const page = `import { getProductListingData } from '@/features/catalog/queries';
      // resolvedSearchParams.secret is not a supported key.
      const brand = resolvedSearchParams.brand; const q = resolvedSearchParams['q'];`;
    assert.deepEqual(generator.extractPageQueryKeys(page), ['brand', 'q']);
    assert.throws(() => generator.extractPageQueryKeys(page + 'const indirect = resolvedSearchParams[key];'), /Computed/);
    assert.deepEqual([...generator.extractRedirects(`const config = { async redirects() { return [{ source: '/storefront/productos/:slug', destination: '/productos/:slug' }]; } };`)], [['/storefront/productos/[slug]', '/productos/[slug]']]);
    const dir = mkdtempSync(join(tmpdir(), 'footer-query-source-'));
    try {
      const files: Record<string, string> = {
        'frontend/src/app/page.tsx': page,
        'frontend/next.config.ts': 'export default {};',
        'frontend/src/components/catalog/CatalogToolbar.tsx': `<><select name="status"><option value="all">Todos</option></select><select name="sort"><option value="featured">Destacados</option></select></>`,
        'frontend/src/features/catalog/filtering.ts': '',
        'frontend/src/features/catalog/mappers.ts': '',
      };
      for (const [file, source] of Object.entries(files)) { mkdirSync(join(dir, file, '..'), { recursive: true }); writeFileSync(join(dir, file), source); }
      const initial = generator.renderRegistry(dir);
      writeFileSync(join(dir, 'frontend/src/app/page.tsx'), page.replace('resolvedSearchParams.brand', 'resolvedSearchParams.category'));
      const changed = generator.renderRegistry(dir);
      assert.notEqual(initial, changed);
      assert.match(changed, /"category"/);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('returns independent inspection objects while rechecking current catalog state', async () => {
    const { db } = client();
    const first = await inspectFooterHref(db, '/productos/taladro');
    first.valid = false;
    assert.equal((await inspectFooterHref(db, '/productos/taladro')).valid, true);
    const inactive = client(false);
    const denied = await inspectFooterHref(inactive.db, '/productos/taladro');
    denied.valid = true;
    assert.equal((await inspectFooterHref(inactive.db, '/productos/taladro')).valid, false);
  });

  it('accepts existing catalog query destinations and safe UTF8 search data without treating data as a route', async () => {
    const { db, reads } = client();
    for (const href of ['/productos?category=compresores&brand=real', '/productos?q=broca+%C3%B1%2Fmetal&status=low-stock&sort=price-asc', '/buscar?q=taladro%20inal%C3%A1mbrico', '/storefront/productos?category=real&status=available&sort=featured', '/storefront/buscar?q=broca', '/categorias/herramientas?brand=real&q=broca&sort=name-desc', '/marcas/real?category=herramientas&status=all', '/storefront/categorias/herramientas?brand=real', '/storefront/marcas/real?category=herramientas', '/productos?brand=&category=&q=&status=&sort=']) assert.equal((await inspectFooterHref(db, href)).valid, true, href);
    assert.ok(reads.some((read) => read.kind === 'category' && read.slug === 'compresores'));
    assert.ok(reads.some((read) => read.kind === 'brand' && read.slug === 'real'));
  });

  it('rejects unsupported, duplicate, malformed, manipulated or unsafe query parameters before resource reads', async () => {
    const { db, reads } = client();
    for (const href of ['/productos?next=https://evil.test', '/productos?brand=real&brand=other', '/productos?brand=real&%62rand=other', '/productos?category=%2F%2Fevil.test', '/productos?brand=..', '/productos?sort=popular-fabricated', '/productos?status=published-fabricated', '/productos?q=%00evil', '/productos?q=%C0%AF', '/productos?q=%ZZ', '/productos?q=x#fragment', '/productos?category=real&', '/productos?', '/buscar?brand=real', '/productos/real?q=broca', '/checkout/confirmacion?order=real']) assert.equal((await inspectFooterHref(db, href)).valid, false, href);
    assert.deepEqual(reads, []);
  });

  it('requires active real filter referents and revalidates them after depublication', async () => {
    for (const key of ['brand', 'category']) {
      const href = `/productos?${key}=real`;
      assert.equal((await inspectFooterHref(client(null).db, href)).valid, false);
      assert.equal((await inspectFooterHref(client(false).db, href)).valid, false);
      const { db, setActive } = client();
      assert.equal((await inspectFooterHref(db, href)).valid, true);
      setActive(false);
      assert.equal((await inspectFooterHref(db, href)).valid, false);
      await assert.rejects(assertFooterRoutes(db, [{ links: [{ href }] }]), BadRequestException);
    }
  });

  it('allows 1000 links but rejects overflow before dynamic reads', async () => {
    const { db, reads } = client();
    assert.equal(FOOTER_LINK_LIMIT, 1000);
    await assertFooterRoutes(db, [{ links: Array.from({ length: 1000 }, () => ({ href: '/contacto' })) }]);
    await assert.rejects(assertFooterRoutes(db, [{ links: Array.from({ length: 1001 }, () => ({ href: '/productos/taladro' })) }]), (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      assert.equal(error.getStatus(), 400);
      assert.match(error.message, /1000/);
      return true;
    });
    assert.deepEqual(reads, []);
  });

  it('propagates resolver outages instead of treating unchecked destinations as valid', async () => {
    const { db } = client();
    db.product.findUnique = (() => { throw new Error('database unavailable'); }) as typeof db.product.findUnique;
    await assert.rejects(inspectFooterHref(db, '/productos/taladro'), /database unavailable/);
  });
});
