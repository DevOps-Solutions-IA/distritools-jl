import { render, screen } from '@testing-library/react';
import { CartProvider } from '@/features/cart/context';
import { AvailabilityBadge } from '@/components/catalog/AvailabilityBadge';
import { BrandLogo } from '@/components/catalog/BrandLogo';
import { ProductCard } from '@/components/catalog/ProductCard';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { ProductSearchBar } from '@/components/catalog/ProductSearchBar';
import { BrandCard } from '@/components/catalog/BrandCard';
import type { CatalogProduct } from '@/features/catalog/types';
import {
  getBrandDetailData,
  getBrandDirectoryData,
  getProductDetailData,
  getStorefrontHomeData,
} from '@/features/catalog/queries';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/catalog/queries', () => ({
  getBrandDirectoryData: vi.fn(),
  getBrandDetailData: vi.fn(),
  getStorefrontHomeData: vi.fn(),
  getProductDetailData: vi.fn(),
}));

const baseProduct: CatalogProduct = {
  id: 'prod-1',
  name: 'Taladro demo',
  slug: 'taladro-demo',
  description: 'Herramienta industrial para perforación.',
  brand: {
    id: 'brand-1',
    name: 'Makita',
    slug: 'makita',
    description: null,
    metadata: null,
  },
  category: {
    id: 'cat-1',
    parentId: null,
    name: 'Perforación',
    slug: 'perforacion',
    description: null,
    sortOrder: 1,
  },
  primaryVariantId: 'var-1',
  primarySku: 'SKU-100',
  primaryPrice: 259900,
  primaryPriceLabel: '$ 259.900',
  availability: {
    status: 'in-stock',
    label: 'Disponible',
    description: 'Disponibilidad positiva reportada por backend.',
    quantity: 12,
    source: 'search',
  },
};

function renderWithCartProvider(ui: React.ReactNode) {
  return render(<CartProvider>{ui}</CartProvider>);
}

describe('catalog storefront', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('ProductCard renderiza nombre, marca, precio y disponibilidad', () => {
    renderWithCartProvider(<ProductCard product={baseProduct} />);

    expect(screen.getByText('Taladro demo')).toBeInTheDocument();
    expect(screen.getByText('Makita')).toBeInTheDocument();
    expect(screen.getByText('$ 259.900')).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar al carrito/i })).toBeInTheDocument();
  });

  it('AvailabilityBadge muestra estado correcto', () => {
    render(<AvailabilityBadge availability={baseProduct.availability} />);

    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText(/disponibilidad positiva/i)).toBeInTheDocument();
  });

  it('ProductGrid muestra empty state sin productos', () => {
    render(<ProductGrid products={[]} />);
    expect(screen.getByText(/no encontramos productos/i)).toBeInTheDocument();
  });

  it('SearchBar renderiza query inicial', () => {
    render(<ProductSearchBar defaultValue="taladro" />);
    expect(screen.getByDisplayValue('taladro')).toBeInTheDocument();
  });

  it('Storefront page renderiza estructura comercial', async () => {
    vi.mocked(getStorefrontHomeData).mockResolvedValue({
      data: {
        categories: [
          {
            id: 'cat-1',
            parentId: null,
            name: 'Perforación',
            slug: 'perforacion',
            description: null,
            sortOrder: 1,
          },
        ],
        brands: [
          {
            id: 'brand-1',
            name: 'Makita',
            slug: 'makita',
            description: null,
            metadata: null,
          },
        ],
        featuredProducts: [baseProduct],
      },
      gaps: [],
    });

    const StorefrontPage = (await import('@/app/storefront/page')).default;
    renderWithCartProvider(await StorefrontPage());

    expect(screen.getByText(/herramientas, equipos y soluciones/i)).toBeInTheDocument();
    expect(screen.getByText(/Taladro demo/i)).toBeInTheDocument();
  });

  it('BrandLogo renderiza wordmark neutro navegable', () => {
    render(
      <BrandLogo
        brand={{
          id: 'brand-2',
          name: 'TOTAL',
          slug: 'total',
          description: 'Herramientas y equipos',
          metadata: null,
        }}
      />,
    );

    expect(screen.getByLabelText(/ver marca total/i)).toBeInTheDocument();
    expect(screen.getByAltText('TOTAL')).toHaveAttribute('src', '/brand/partners/total.svg');
  });

  it('BrandCard renderiza fallback tipográfico sin logo autorizado', () => {
    render(
      <BrandCard
        brand={{
          id: 'brand-2',
          name: 'TOTAL',
          slug: 'total',
          description: 'Herramientas y equipos',
          metadata: {
            status: 'active',
            commercialPriority: 90,
            shortDescription: 'Herramientas y equipos',
            longDescription: 'Herramientas para trabajo general y profesional',
            industrialFocus: ['construcción ligera', 'energía'],
            productFamilies: ['herramientas eléctricas', 'generadores'],
            categorySlugs: ['herramientas-electricas', 'generadores'],
            keywords: ['total tools'],
            logo: {
              assetPath: null,
              assetStatus: 'pending',
              notes: 'pendiente',
            },
            sourceNotes: ['nota'],
            rules: {
              allowProductAutoCreation: false,
              requiresManualSkuApproval: true,
              doNotClaimOfficialDistributor: true,
            },
          },
        }}
      />,
    );

    expect(screen.getByText('TOTAL')).toBeInTheDocument();
    expect(screen.getByText(/herramientas eléctricas/i)).toBeInTheDocument();
  });

  it('Product detail page maneja producto no encontrado', async () => {
    vi.mocked(getProductDetailData).mockResolvedValue({
      data: null,
      gaps: [],
    });

    const ProductDetailPage = (await import('@/app/storefront/productos/[slug]/page')).default;
    renderWithCartProvider(
      await ProductDetailPage({ params: Promise.resolve({ slug: 'no-existe' }) }),
    );

    expect(screen.getByText(/producto no encontrado/i)).toBeInTheDocument();
  });

  it('Product detail page muestra AddToCartButton', async () => {
    vi.mocked(getProductDetailData).mockResolvedValue({
      data: {
        ...baseProduct,
        variants: [
          {
            id: 'var-1',
            productId: 'prod-1',
            name: 'Taladro demo',
            sku: 'SKU-100',
            price: 259900,
            priceLabel: '$ 259.900',
            taxRate: '19.00',
            warehouseId: null,
          },
        ],
        featuredProductsGap: null,
        relatedProductsGap: null,
        technicalAttributes: [],
      },
      gaps: [],
    });

    const ProductDetailPage = (await import('@/app/storefront/productos/[slug]/page')).default;
    renderWithCartProvider(
      await ProductDetailPage({ params: Promise.resolve({ slug: 'taladro-demo' }) }),
    );

    expect(screen.getByRole('button', { name: /agregar al carrito/i })).toBeInTheDocument();
  });

  it('Product detail page maneja error de backend', async () => {
    vi.mocked(getProductDetailData).mockRejectedValue(new Error('Backend offline'));

    const ProductDetailPage = (await import('@/app/storefront/productos/[slug]/page')).default;
    renderWithCartProvider(
      await ProductDetailPage({ params: Promise.resolve({ slug: 'taladro-demo' }) }),
    );

    expect(screen.getByText(/backend offline/i)).toBeInTheDocument();
  });

  it('Brand page renderiza marca válida', async () => {
    vi.mocked(getBrandDetailData).mockResolvedValue({
      data: {
        brand: {
          id: 'brand-2',
          name: 'TOTAL',
          slug: 'total',
          description: 'Herramientas y equipos',
          metadata: {
            status: 'active',
            commercialPriority: 90,
            shortDescription: 'Herramientas y equipos',
            longDescription: 'Herramientas para trabajo general y profesional',
            industrialFocus: ['construcción ligera', 'energía'],
            productFamilies: ['herramientas eléctricas', 'generadores'],
            categorySlugs: ['herramientas-electricas', 'generadores'],
            keywords: ['total tools'],
            logo: { assetPath: null, assetStatus: 'pending', notes: 'pendiente' },
            sourceNotes: ['nota'],
            rules: {
              allowProductAutoCreation: false,
              requiresManualSkuApproval: true,
              doNotClaimOfficialDistributor: true,
            },
          },
        },
        products: [baseProduct],
        relatedCategories: [
          {
            id: 'cat-1',
            parentId: null,
            name: 'Perforación',
            slug: 'perforacion',
            description: null,
            sortOrder: 1,
          },
        ],
      },
      gaps: [],
    });

    const BrandPage = (await import('@/app/storefront/marcas/[slug]/page')).default;
    renderWithCartProvider(await BrandPage({ params: Promise.resolve({ slug: 'total' }) }));

    expect(screen.getByText('TOTAL')).toBeInTheDocument();
    expect(screen.getByText(/familias internas relacionadas/i)).toBeInTheDocument();
  });

  it('Brand page maneja marca inexistente', async () => {
    vi.mocked(getBrandDetailData).mockResolvedValue(null);

    const BrandPage = (await import('@/app/storefront/marcas/[slug]/page')).default;
    renderWithCartProvider(await BrandPage({ params: Promise.resolve({ slug: 'desconocida' }) }));

    expect(screen.getByText(/marca no encontrada/i)).toBeInTheDocument();
  });

  it('Brand directory page renderiza marcas reales', async () => {
    vi.mocked(getBrandDirectoryData).mockResolvedValue({
      data: {
        brands: [
          {
            id: 'brand-2',
            name: 'TOTAL',
            slug: 'total',
            description: 'Herramientas y equipos',
            metadata: {
              status: 'active',
              commercialPriority: 90,
              shortDescription: 'Herramientas y equipos',
              longDescription: 'Herramientas para trabajo general y profesional',
              industrialFocus: ['construcción ligera', 'energía'],
              productFamilies: ['herramientas eléctricas', 'generadores'],
              categorySlugs: ['herramientas-electricas', 'generadores'],
              keywords: ['total tools'],
              logo: { assetPath: null, assetStatus: 'pending', notes: 'pendiente' },
              sourceNotes: ['nota'],
              rules: {
                allowProductAutoCreation: false,
                requiresManualSkuApproval: true,
                doNotClaimOfficialDistributor: true,
              },
            },
          },
        ],
      },
      gaps: [],
    });

    const BrandsPage = (await import('@/app/storefront/marcas/page')).default;
    renderWithCartProvider(await BrandsPage());

    expect(screen.getByText(/directorio de marcas/i)).toBeInTheDocument();
    expect(screen.getAllByAltText('TOTAL').length).toBeGreaterThanOrEqual(1);
  });
});
