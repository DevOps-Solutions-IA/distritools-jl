import { ApiError } from '@/lib/api/errors';
import { listProducts } from '@/lib/api/products';
import { searchCatalogApi } from '@/lib/api/search';

describe('catalog api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('maneja respuesta válida de productos', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'prod-1',
                name: 'Taladro industrial',
                slug: 'taladro-industrial',
                description: 'Equipo de perforación',
                brand: null,
                category: null,
              },
            ],
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    const products = await listProducts();

    expect(products).toHaveLength(1);
    expect(products[0]?.slug).toBe('taladro-industrial');
  });

  it('maneja error HTTP de búsqueda', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Search unavailable' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(searchCatalogApi('taladro')).rejects.toMatchObject({
      message: 'Search unavailable',
      status: 503,
    } satisfies Partial<ApiError>);
  });
});
