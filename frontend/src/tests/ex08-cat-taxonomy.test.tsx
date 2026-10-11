import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminTaxonomyForm } from '@/components/admin/forms/AdminTaxonomyForm';
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
let calls: Array<{ path: string; method?: string; body?: Record<string, unknown> }>;
let mutation: (path: string) => Promise<Response>;
let permissions: string[];
beforeEach(() => {
  calls = []; permissions = ['brands.write', 'categories.write'];
  mutation = async () => Response.json({ id: 'record' });
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/admin/session') return Response.json({ user: { id: 'actor', email: 'qa@example.test', role: 'qa', permissions } });
    calls.push({ path, method: init?.method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return mutation(path);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
async function click(name: string) { const button = await screen.findByRole('button', { name }); await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button); }
const initial = { id: 'record', name: 'Marca QA', slug: 'marca-qa', description: 'Descripción original', isActive: true };
it('keeps identity save separate from the explicit brand status operation', async () => {
  render(<AdminTaxonomyForm kind="brand" mode="edit" initial={initial} />);
  await click('Guardar marca');
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0]).toEqual({ path: '/api/admin/brands/record', method: 'PATCH', body: { name: 'Marca QA', slug: 'marca-qa', description: 'Descripción original' } });
});
it('changes brand activity through dedicated deactivate endpoint', async () => {
  render(<AdminTaxonomyForm kind="brand" mode="edit" initial={initial} />);
  await click('Desactivar marca');
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0]).toEqual({ path: '/api/admin/brands/record/deactivate', method: 'PATCH', body: undefined });
});
it('saves category identity without leaking its parent to the wrong endpoint', async () => {
  render(<AdminTaxonomyForm kind="category" mode="edit" initial={{ ...initial, parentId: null }} />);
  await click('Guardar categoría');
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0].body).not.toHaveProperty('parentId');
});
it('retains persisted hierarchy order and uses the tree DTO', async () => {
  render(<AdminTaxonomyForm kind="category" mode="edit" initial={{ ...initial, parentId: null, sortOrder: 7 }} />);
  expect(screen.getByLabelText('Orden en la jerarquía')).toHaveValue(7);
  await click('Guardar jerarquía');
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0]).toEqual({ path: '/api/admin/categories/record/tree', method: 'PATCH', body: { parentId: null, sortOrder: 7 } });
});
it('finishes loading after network failure and presents an accessible uncertain result', async () => {
  mutation = async () => { throw new TypeError('offline'); };
  render(<AdminTaxonomyForm kind="brand" mode="edit" initial={initial} />);
  await click('Guardar marca');
  expect(await screen.findByRole('alert')).toHaveTextContent(/confirmar|conexión/i);
  expect(router.push).not.toHaveBeenCalled();
});
it('does not allow mutation with a read-only verified session', async () => {
  permissions = ['brands.read'];
  render(<AdminTaxonomyForm kind="brand" mode="edit" initial={initial} />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar marca' })).toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Guardar marca' }));
  expect(calls).toHaveLength(0);
});
