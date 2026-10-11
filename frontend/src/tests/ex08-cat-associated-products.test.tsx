import { render, screen } from '@testing-library/react';
import BrandPage from '@/app/admin/marcas/[id]/page';
const data = vi.hoisted(() => ({ brands: [{ id: 'brand', name: 'QA Brand', slug: 'qa-brand', productCount: 25, sellableProductCount: 0, status: 'inactive', description: null }], products: Array.from({ length: 25 }, (_, i) => ({ id: `p${String(i).padStart(2, '0')}`, name: `Product ${i}`, primarySku: null, brand: { id: 'brand' }, sellability: { status: 'INCOMPLETE' } })) }));
vi.mock('@/lib/admin/server-data', () => ({ getAdminCatalogOperationsData: async () => data }));
vi.mock('@/features/admin/catalog/server', () => ({ catalogPermissions: async () => [] }));
vi.mock('@/components/layout/AdminShell', () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => children }));
it('makes associations after the first20 reachable on a second page', async () => {
  render(await BrandPage({ params: Promise.resolve({ id: 'brand' }), searchParams: Promise.resolve({ page: '2' }) }));
  expect(screen.getByRole('link', { name: /Product 24/ })).toHaveAttribute('href', '/admin/productos/p24');
  expect(screen.queryByRole('link', { name: /Product 0 / })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Anterior' })).toHaveAttribute('href', '/admin/marcas/brand?page=1');
});
