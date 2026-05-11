import { render, screen } from '@testing-library/react';
import AdminLoginPage from '@/app/admin/login/page';
import AdminNewProductPage from '@/app/admin/productos/nuevo/page';
import AdminProductsPage from '@/app/admin/productos/page';
import { AdminShell } from '@/components/layout/AdminShell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/productos',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/image', () => ({
  default: ({
    alt,
    src,
    priority: _priority,
    unoptimized: _unoptimized,
    ...props
  }: {
    alt: string;
    src: string;
    priority?: boolean;
    unoptimized?: boolean;
  }) => {
    // next/image is mocked as a plain element in tests.
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} src={src} {...props} />;
  },
}));

vi.mock('@/lib/admin/operations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/operations')>();
  return {
    ...actual,
    getAdminCatalogSnapshot: vi.fn().mockResolvedValue({
      available: true,
      brands: 1,
      categories: 1,
      products: 1,
      variants: 1,
      productsWithoutPrice: 0,
      productsWithoutSku: 0,
      productsWithoutImage: 1,
      quoteOnlyProducts: 0,
      brandRows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'TOTAL',
          slug: 'total',
          description: null,
          metadata: null,
        },
      ],
      categoryRows: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          parentId: null,
          name: 'Perforación',
          slug: 'perforacion',
          description: null,
          sortOrder: 1,
        },
      ],
      productRows: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Taladro percutor TOTAL',
          slug: 'taladro-percutor-total',
          description: 'Herramienta de perforación.',
          longDescription: null,
          presentation: '1/2 pulg',
          brand: {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'TOTAL',
            slug: 'total',
            description: null,
            metadata: null,
          },
          category: {
            id: '22222222-2222-4222-8222-222222222222',
            parentId: null,
            name: 'Perforación',
            slug: 'perforacion',
            description: null,
            sortOrder: 1,
          },
          primaryVariantId: '44444444-4444-4444-8444-444444444444',
          primarySku: 'TOTAL-001',
          primaryPrice: 259900,
          primaryPriceLabel: '$ 259.900',
          availability: {
            status: 'in-stock',
            label: 'Disponible',
            description: 'Disponible.',
            source: 'search',
          },
          image: {
            status: 'pending',
            assetPath: null,
            notes: null,
          },
          attributes: [],
          tags: [],
          seo: {
            title: null,
            description: null,
            keywords: [],
            ogTitle: null,
            ogDescription: null,
            ogImage: null,
          },
          source: {
            name: null,
            url: null,
            retrievedAt: null,
            confidence: null,
          },
        },
      ],
      variantRows: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          productId: '33333333-3333-4333-8333-333333333333',
          sku: 'TOTAL-001',
          name: 'Taladro percutor TOTAL',
          price: '259900.00',
          taxRate: '19.00',
          product: {
            id: '33333333-3333-4333-8333-333333333333',
            name: 'Taladro percutor TOTAL',
            slug: 'taladro-percutor-total',
            isActive: true,
            brand: null,
            category: null,
          },
        },
      ],
    }),
  };
});

vi.mock('@/lib/admin/server-data', () => ({
  getAdminOperationalSnapshot: vi.fn().mockResolvedValue({
    orders: { data: [], meta: { page: 1, limit: 20, total: 0 } },
    quotes: {
      data: [],
      meta: { page: 1, limit: 20, total: 0 },
      operationalState: {
        status: 'not_configured',
        message: 'Sin workflow persistente.',
      },
    },
    payments: { data: [], meta: { page: 1, limit: 20, total: 0 } },
    shipments: {
      data: [],
      meta: { page: 1, limit: 20, total: 0 },
      operationalState: {
        status: 'provider_not_configured',
        message: 'Sin transportadora configurada.',
      },
    },
    customers: { data: [], meta: { page: 1, limit: 20, total: 0 } },
    users: { data: [] },
    roles: { data: [] },
    audit: { data: [] },
    inventoryHistory: { data: [] },
    priceHistory: { data: [] },
    legal: { data: [] },
    footer: {},
    settings: {},
    errors: {},
  }),
  adminFetch: vi.fn().mockResolvedValue({ ok: true, status: 200, data: {}, error: null }),
}));

describe('admin platform', () => {
  it('login landing renderiza sin sidebar administrativo', () => {
    render(<AdminLoginPage />);

    expect(screen.getByRole('heading', { name: /panel administrativo/i })).toBeInTheDocument();
    expect(screen.getByAltText(/equipo operativo distritools jl/i)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /navegación administrativa/i })).not.toBeInTheDocument();
  });

  it('sidebar premium agrupa módulos y muestra estado activo', () => {
    render(
      <AdminShell>
        <div>Contenido admin</div>
      </AdminShell>,
    );

    expect(screen.getAllByText('Control').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Catálogo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('link', { name: /productos/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('productos admin muestra tabla real y acciones operativas', async () => {
    render(await AdminProductsPage());

    expect(screen.getByText('Taladro percutor TOTAL')).toBeInTheDocument();
    expect(screen.getByText('$ 259.900')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nuevo producto/i })).toHaveAttribute(
      'href',
      '/admin/productos/nuevo',
    );
  });

  it('formulario de nuevo producto usa datos reales de marca y categoría', async () => {
    render(await AdminNewProductPage());

    expect(screen.getByRole('heading', { name: /nuevo producto/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Marca')).toHaveTextContent('TOTAL');
    expect(screen.getByLabelText('Categoría')).toHaveTextContent('Perforación');
  });
});
