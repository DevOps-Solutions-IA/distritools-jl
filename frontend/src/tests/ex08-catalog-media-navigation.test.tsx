import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { AdminProductsScreen } from '@/components/admin/AdminCatalogScreens';
import AdminProductDetailPage from '@/app/admin/productos/[id]/page';

const mocks = vi.hoisted(() => ({ permissions: vi.fn(), data: vi.fn() }));
vi.mock('@/features/admin/catalog/server', () => ({ catalogPermissions: mocks.permissions }));
vi.mock('@/lib/admin/server-data', () => ({ getAdminCatalogOperationsData: mocks.data }));
vi.mock('@/features/admin/catalog/useCatalogPermissions', () => ({ CatalogPermissionProvider: ({ children }: { children: ReactNode }) => children }));
vi.mock('@/components/admin/AdminCatalogActions', () => ({ AdminProductActions: () => null, AdminPriceUpdateForm: () => null }));
vi.mock('@/components/layout/AdminShell', () => ({ AdminShell: ({ children }: { children: ReactNode }) => children }));

const id = 'media-product';
const product = {
  id, name: 'Producto con recurso registrado', slug: 'media-product', status: 'inactive', isActive: false,
  brand: null, category: null, primarySku: 'MEDIA-1', variantsCount: 1, priceFrom: 100,
  availableStock: 0, hasApprovedImage: false, hasDimensions: true,
  sellability: { status: 'INCOMPLETE', blockers: ['missing_image'], warnings: [] },
};
const data = {
  products: [product], prices: [{ id: 'variant-1', productId: id, sku: 'MEDIA-1', variant: 'Principal', currentPrice: '100', availableStock: 0, missingCost: true }],
  metrics: {}, readiness: { products: 'INCOMPLETE' }, brands: [], categories: [],
};
const screens = [
  ['lista', () => AdminProductsScreen({})],
  ['detalle', () => AdminProductDetailPage({ params: Promise.resolve({ id }) })],
] as const;

afterEach(cleanup);
beforeEach(() => mocks.data.mockResolvedValue(data));
for (const [name, renderPage] of screens) {
  it(`${name}: permite acceder a gestión de imagen sin variants.read`, async () => {
    mocks.permissions.mockResolvedValue(['catalog.read', 'dashboard.read', 'products.read', 'products.write']);
    render(await renderPage());
    expect(screen.getByRole('link', { name: 'Gestionar imagen' })).toHaveAttribute('href', `/admin/productos/${id}/editar`);
    expect(screen.queryByRole('link', { name: 'Editar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Agregar variante' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar variante' })).not.toBeInTheDocument();
  });
  it(`${name}: conserva Editar y sus destinos para el editor completo`, async () => {
    mocks.permissions.mockResolvedValue(['products.read', 'products.write', 'variants.read']);
    render(await renderPage());
    expect(screen.getByRole('link', { name: 'Editar' })).toHaveAttribute('href', `/admin/productos/${id}/editar`);
    expect(screen.queryByRole('link', { name: 'Gestionar imagen' })).not.toBeInTheDocument();
    if (name === 'detalle') {
      expect(screen.getByRole('link', { name: 'Agregar variante' })).toHaveAttribute('href', `/admin/productos/${id}/editar?variant=new`);
      expect(screen.getByRole('link', { name: 'Editar variante' })).toHaveAttribute('href', `/admin/productos/${id}/editar?variant=variant-1`);
    }
  });
  for (const permissions of [['products.read'], ['products.write'], ['products.read', 'variants.read'], []]) {
    it(`${name}: no ofrece edición ni imagen con permisos insuficientes ${permissions.join(',') || 'ninguno'}`, async () => {
      mocks.permissions.mockResolvedValue(permissions);
      render(await renderPage());
      for (const label of ['Editar', 'Gestionar imagen', 'Agregar variante', 'Editar variante']) {
        expect(screen.queryByRole('link', { name: label })).not.toBeInTheDocument();
      }
    });
  }
}
it('detalle: no inventa un destino de edición para un producto inexistente', async () => {
  mocks.permissions.mockResolvedValue(['products.read', 'products.write']);
  mocks.data.mockResolvedValue({ ...data, products: [] });
  render(await AdminProductDetailPage({ params: Promise.resolve({ id }) }));
  expect(screen.getByRole('heading', { name: 'Producto no encontrado' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Gestionar imagen' })).not.toBeInTheDocument();
});
