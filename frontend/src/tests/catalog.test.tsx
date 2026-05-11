import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CartProvider } from '@/features/cart/context';
import { AvailabilityBadge } from '@/components/catalog/AvailabilityBadge';
import { BrandLogo } from '@/components/catalog/BrandLogo';
import { ProductCard } from '@/components/catalog/ProductCard';
import { ProductGrid } from '@/components/catalog/ProductGrid';
import { ProductSearchBar } from '@/components/catalog/ProductSearchBar';
import { BrandCard } from '@/components/catalog/BrandCard';
import { BrandLogoSlider } from '@/components/catalog/BrandLogoSlider';
import { CategoryCard } from '@/components/catalog/CategoryCard';
import { CatalogToolbar } from '@/components/catalog/CatalogToolbar';
import { getLiveSearchResults } from '@/features/catalog/live-search';
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

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('@/features/catalog/queries', () => ({
  getBrandDirectoryData: vi.fn(),
  getBrandDetailData: vi.fn(),
  getStorefrontHomeData: vi.fn(),
  getProductDetailData: vi.fn(),
}));

const baseProduct: CatalogProduct = {
  id: 'prod-1',
  name: 'Taladro percutor 1/2 TOTAL',
  slug: 'taladro-percutor-1-2-total',
  description: 'Herramienta industrial para perforación.',
  longDescription: 'Taladro TOTAL para perforación, montaje y mantenimiento.',
  presentation: '1/2 pulg',
  brand: {
    id: 'brand-1',
    name: 'TOTAL',
    slug: 'total',
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
  primarySku: 'TOTAL-TG109136',
  primaryPrice: 259900,
  primaryPriceLabel: '$ 259.900',
  availability: {
    status: 'in-stock',
    label: 'Disponible',
    description: 'Producto disponible para agregar al carrito.',
    quantity: 12,
    source: 'search',
  },
  image: {
    status: 'pending',
    assetPath: null,
    notes: 'Imagen pendiente.',
  },
  attributes: [{ label: 'Tipo', value: 'Taladro percutor' }],
  tags: ['taladro', 'total'],
  seo: {
    title: 'Taladro percutor TOTAL',
    description: 'Taladro percutor TOTAL para obra y taller.',
    keywords: ['taladro', 'total'],
    ogTitle: 'Taladro percutor TOTAL',
    ogDescription: 'Herramienta TOTAL para perforación.',
    ogImage: null,
  },
  source: {
    name: 'TOTAL Tools catálogo oficial',
    url: 'https://www.totalbusiness.com/',
    retrievedAt: '2026-04-28',
    confidence: 'medium',
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

    expect(screen.getByText('Taladro percutor 1/2 TOTAL')).toBeInTheDocument();
    expect(screen.getAllByText('TOTAL').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('$ 259.900')).toBeInTheDocument();
    expect(screen.getAllByText(/en stock|disponible/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText(/ver producto taladro percutor/i)).toHaveAttribute(
      'href',
      '/productos/taladro-percutor-1-2-total',
    );
    expect(screen.getAllByRole('button', { name: /comprar/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('link', { name: /^ver$/i })).not.toBeInTheDocument();
  });

  it('ProductGrid excluye productos sin precio o stock de la vitrina pública', () => {
    renderWithCartProvider(
      <ProductGrid
        products={[
          baseProduct,
          {
            ...baseProduct,
            id: 'prod-incomplete',
            name: 'Referencia incompleta',
            slug: 'referencia-incompleta',
            primaryVariantId: null,
            primarySku: null,
            primaryPrice: null,
            primaryPriceLabel: null,
            presentation: 'referencia por asesoría',
            availability: {
              status: 'check-backend',
              label: 'Consultar',
              description: 'Confirmamos disponibilidad.',
              source: 'catalog-gap',
            },
          },
        ]}
      />,
    );

    expect(screen.getByText('Taladro percutor 1/2 TOTAL')).toBeInTheDocument();
    expect(screen.queryByText('Referencia incompleta')).not.toBeInTheDocument();
    expect(screen.queryByText(/por confirmar|precio por confirmar|cotizar/i)).not.toBeInTheDocument();
  });

  it('AvailabilityBadge muestra estado correcto', () => {
    render(<AvailabilityBadge availability={baseProduct.availability} />);

    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText(/producto disponible/i)).toBeInTheDocument();
  });

  it('ProductGrid muestra empty state sin productos', () => {
    render(<ProductGrid products={[]} />);
    expect(screen.getByText(/no encontramos productos/i)).toBeInTheDocument();
  });

  it('SearchBar renderiza query inicial y reduce autocomplete nativo', () => {
    render(<ProductSearchBar defaultValue="taladro" />);
    expect(screen.getByDisplayValue('taladro')).toBeInTheDocument();
    expect(screen.getByLabelText(/buscar en catálogo/i)).toHaveAttribute('autocomplete', 'off');
    expect(screen.getByLabelText(/buscar en catálogo/i)).toHaveClass('text-base');
  });

  it('SearchBar en caliente encuentra taladros y esmeriles con precio y stock', async () => {
    const esmerilProduct: CatalogProduct = {
      ...baseProduct,
      id: 'prod-2',
      name: 'Esmeril angular 4 1/2 pulg TOTAL',
      slug: 'esmeril-angular-total',
      primaryVariantId: 'var-2',
      primarySku: 'TOTAL-ESM-412',
      primaryPrice: 289900,
      primaryPriceLabel: '$ 289.900',
      tags: ['esmeril', 'pulidora'],
    };

    renderWithCartProvider(
      <ProductSearchBar
        products={[baseProduct, esmerilProduct]}
        brands={[baseProduct.brand!]}
        categories={[baseProduct.category!]}
      />,
    );

    const input = screen.getByLabelText(/buscar productos/i);
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveClass('text-base');

    fireEvent.change(input, { target: { value: 'taladro' } });
    await waitFor(() => {
      expect(screen.getByText('Taladro percutor 1/2 TOTAL')).toBeInTheDocument();
    });

    fireEvent.change(input, { target: { value: 'esmeril' } });
    await waitFor(() => {
      expect(screen.getByText('Esmeril angular 4 1/2 pulg TOTAL')).toBeInTheDocument();
    });
  });

  it('ranking de búsqueda en caliente excluye productos sin precio', () => {
    const results = getLiveSearchResults({
      query: 'taladro',
      products: [
        baseProduct,
        {
          ...baseProduct,
          id: 'prod-no-price',
          primaryPrice: null,
          primaryPriceLabel: null,
        },
      ],
      brands: [],
      categories: [],
    });

    expect(results.products).toHaveLength(1);
    expect(results.products[0].id).toBe(baseProduct.id);
  });

  it('CatalogToolbar renderiza búsqueda, filtros y contador compacto', () => {
    render(
      <CatalogToolbar
        action="/marcas/truper"
        clearHref="/marcas/truper"
        brands={[]}
        categories={[
          {
            id: 'cat-1',
            parentId: null,
            name: 'Compresores',
            slug: 'compresores',
            description: null,
            sortOrder: 1,
          },
        ]}
        resultCount={3}
        hideBrandFilter
      />,
    );

    expect(screen.getByText('3 resultados')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar')).toHaveClass('text-base');
    expect(screen.getAllByText('Aplicar').length).toBeGreaterThanOrEqual(1);
  });

  it('BrandLogoSlider tiene autoplay mobile, pausa con interacción y no muestra controles', () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    render(
      <BrandLogoSlider
        brands={[
          {
            id: 'brand-1',
            name: 'TOTAL',
            slug: 'total',
            description: null,
            metadata: null,
          },
        ]}
      />,
    );

    const slider = screen.getByLabelText(/marcas disponibles/i);
    expect(screen.queryByRole('button', { name: /pausar|play|reproducir/i })).not.toBeInTheDocument();
    expect(slider).toHaveAttribute('data-mobile-autoplay', 'true');
    fireEvent.pointerDown(slider);
    expect(slider).toHaveAttribute('data-paused', 'true');
    fireEvent.mouseEnter(slider);
    expect(slider).toHaveAttribute('data-paused', 'true');
    fireEvent.mouseLeave(slider);
    fireEvent.focus(screen.getByLabelText(/ver marca total/i));
    expect(slider).toHaveAttribute('data-paused', 'true');
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: originalMatchMedia,
    });
  });

  it('CategoryCard es compacta en mobile y no repite CTA visible', () => {
    render(
      <CategoryCard
        category={{
          id: 'cat-2',
          parentId: null,
          name: 'Herramientas eléctricas industriales',
          slug: 'herramientas-electricas',
          description: 'Categoría extensa para obra y taller.',
          sortOrder: 1,
        }}
      />,
    );

    expect(screen.getByLabelText(/ver productos de herramientas eléctricas industriales/i)).toBeInTheDocument();
    expect(screen.getByText('Eléctricas')).toBeInTheDocument();
    expect(screen.getByText('Ver productos')).toHaveClass('sr-only');
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
            name: 'TOTAL',
            slug: 'total',
            description: null,
            metadata: null,
          },
        ],
        featuredProducts: [baseProduct],
      },
      gaps: [],
    });

    const HomePage = (await import('@/app/page')).default;
    renderWithCartProvider(await HomePage());

    expect(screen.getByText(/compra herramientas en segundos/i)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /ver productos/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('link', { name: /^rastreo$/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Taladro percutor 1\/2 TOTAL/i)).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: 'TOTAL' })).toBeInTheDocument();
    expect(screen.getByText(/herramientas eléctricas/i)).toBeInTheDocument();
  });

  it('Product detail page maneja producto no encontrado', async () => {
    vi.mocked(getProductDetailData).mockResolvedValue({
      data: null,
      gaps: [],
    });

    const ProductDetailPage = (await import('@/app/productos/[slug]/page')).default;
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
            name: 'Taladro percutor 1/2 TOTAL',
            sku: 'TOTAL-TG109136',
            price: 259900,
            priceLabel: '$ 259.900',
            taxRate: '19.00',
            warehouseId: null,
          },
        ],
        featuredProductsGap: null,
        relatedProductsGap: null,
      },
      gaps: [],
    });

    const ProductDetailPage = (await import('@/app/productos/[slug]/page')).default;
    renderWithCartProvider(
      await ProductDetailPage({ params: Promise.resolve({ slug: 'taladro-percutor-1-2-total' }) }),
    );

    expect(screen.getByRole('button', { name: /comprar/i })).toBeInTheDocument();
  });

  it('Product detail page maneja error de carga', async () => {
    vi.mocked(getProductDetailData).mockRejectedValue(new Error('Servicio no disponible'));

    const ProductDetailPage = (await import('@/app/productos/[slug]/page')).default;
    renderWithCartProvider(
      await ProductDetailPage({ params: Promise.resolve({ slug: 'taladro-percutor-1-2-total' }) }),
    );

    expect(screen.getByText(/servicio no disponible/i)).toBeInTheDocument();
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

    const BrandPage = (await import('@/app/marcas/[slug]/page')).default;
    renderWithCartProvider(
      await BrandPage({
        params: Promise.resolve({ slug: 'total' }),
        searchParams: Promise.resolve({}),
      }),
    );

    expect(screen.getByRole('heading', { name: 'TOTAL' })).toBeInTheDocument();
    expect(screen.getByText('1 productos')).toBeInTheDocument();
    expect(screen.queryByText('Familia')).not.toBeInTheDocument();
    expect(screen.queryByText(/explora esta línea/i)).not.toBeInTheDocument();
    expect(screen.getByText('1 resultado')).toBeInTheDocument();
  });

  it('Brand page maneja marca inexistente', async () => {
    vi.mocked(getBrandDetailData).mockResolvedValue(null);

    const BrandPage = (await import('@/app/marcas/[slug]/page')).default;
    renderWithCartProvider(
      await BrandPage({
        params: Promise.resolve({ slug: 'desconocida' }),
        searchParams: Promise.resolve({}),
      }),
    );

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

    const BrandsPage = (await import('@/app/marcas/page')).default;
    renderWithCartProvider(await BrandsPage());

    expect(screen.getByText(/compra por fabricante/i)).toBeInTheDocument();
    expect(screen.getAllByAltText('TOTAL').length).toBeGreaterThanOrEqual(1);
  });
});
