import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminProductActions } from '@/components/admin/AdminCatalogActions';
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
let permissions: string[];
let requests: string[];
let mutation: () => Promise<Response>;
beforeEach(() => {
  permissions = ['products.read', 'products.write', 'products.publish', 'products.archive']; requests = [];
  mutation = async () => Response.json({ id: 'product', status: 'INCOMPLETE', blockers: ['MISSING_SKU'], warnings: ['MISSING_MAIN_IMAGE'] });
  vi.stubGlobal('fetch', vi.fn(async (path: string) => {
    if (path === '/api/admin/session') return Response.json({ user: { id: 'actor', email: 'qa@example.test', role: 'qa', permissions } });
    requests.push(path); return mutation();
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
async function click(name: string) { const button = screen.getByRole('button', { name }); await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button); }
it('shows real sellability blockers instead of only the status badge', async () => {
  render(<AdminProductActions productId="product" isActive={false} />); await click('Validar');
  expect(await screen.findByRole('status')).toHaveTextContent('MISSING_SKU'); expect(screen.getByRole('status')).toHaveTextContent('MISSING_MAIN_IMAGE');
});
it('requires an explicit inline archive reason and confirmation', async () => {
  render(<AdminProductActions productId="product" isActive={false} />); await click('Archivar');
  expect(requests).toHaveLength(0); expect(screen.getByRole('button', { name: 'Confirmar archivo' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Motivo del archivo'), { target: { value: 'QA reason' } }); await click('Confirmar archivo');
  await waitFor(() => expect(requests).toEqual(['/api/admin/products/product/archive']));
});
it('keeps write controls unavailable to a read-only session', async () => {
  permissions = ['products.read']; render(<AdminProductActions productId="product" isActive={false} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Validar' })).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Activar' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Archivar' })).toBeDisabled();
});
it('does not repeat an uncertain mutation or announce audit success', async () => {
  mutation = async () => { throw new TypeError('lost acknowledgement'); };
  render(<AdminProductActions productId="product" isActive={false} />); await click('Activar');
  expect(await screen.findByRole('alert')).toHaveTextContent(/confirmar/); expect(screen.getByRole('button', { name: 'Activar' })).toBeDisabled(); expect(router.refresh).not.toHaveBeenCalled();
});
