import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminProductCompleteForm } from '@/components/admin/forms/AdminProductCompleteForm';
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const brand = { id: '11111111-1111-4111-8111-111111111111', name: 'QA Brand', slug: 'qa-brand', description: null, metadata: null };
const category = { id: '22222222-2222-4222-8222-222222222222', name: 'QA Category', slug: 'qa-category', description: null, parentId: null, sortOrder: 0 };
const product = { id: 'product-qa', name: 'Producto QA', slug: 'producto-qa', brand, category, description: 'Descripción corta QA', longDescription: 'Descripción extensa QA', image: { status: 'approved' as const, assetPath: '/qa.jpg', notes: null }, isActive: true, presentation: null, primaryVariantId: null, primarySku: 'SKU-QA', primaryPrice: 100, primaryPriceLabel: null, availability: { status: 'check-backend' as const, label: '', description: '', source: 'catalog-gap' as const }, attributes: [], tags: [], seo: { title: null, description: null, keywords: [], ogTitle: null, ogDescription: null, ogImage: null }, source: { name: null, url: null, retrievedAt: null, confidence: null } };
const variant = { id: 'variant-qa', productId: product.id, name: 'Variante QA', sku: 'SKU-QA', price: '100', taxRate: '19', product: null };
const metadata = { customRule: { preserved: true }, image: { status: 'approved', assetPath: '/qa.jpg', notes: 'preserve provenance' }, shipping: { weightKg: 1, lengthCm: 2, widthCm: 3, heightCm: 4, carrierNotes: 'keep' } };
let calls: Array<{ path: string; body: Record<string, unknown> }>;
let handler: (path: string) => Promise<Response>;
beforeEach(() => {
  calls = []; handler = async (path) => Response.json(path.includes('validate') ? { status: 'SELLABLE', blockers: [], warnings: [] } : { id: path.includes('variants') ? variant.id : product.id });
  vi.stubGlobal('fetch', vi.fn(async (path: string, init?: RequestInit) => {
    if (path === '/api/admin/session') return Response.json({ user: { id: 'actor', email: 'qa@example.test', role: 'qa', permissions: ['products.write', 'products.read', 'products.publish'] } });
    if (!init?.method || init.method === 'GET') {
      if (path === '/api/admin/media-resources') return Response.json({ data: [{ assetPath: '/products/TOTAL-TG109136.jpg', sha256: 'a'.repeat(64) }] });
      if (path === `/api/admin/products/${product.id}`) return Response.json({ ...product, metadata, updatedAt: '2026-10-11T00:00:00.000Z' });
      throw new Error(`Unrecognized catalog read: ${path}`);
    }
    calls.push({ path, body: init?.body ? JSON.parse(String(init.body)) : {} }); return handler(path);
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function edit() { return render(<AdminProductCompleteForm mode="edit" product={product} primaryVariant={variant} brands={[brand]} categories={[category]} warehouses={[]} originalMetadata={metadata} />); }
async function save() { for (const [label, value] of [['Peso kg', '1'], ['Largo cm', '2'], ['Ancho cm', '3'], ['Alto cm', '4']]) fireEvent.change(screen.getByLabelText(label), { target: { value } }); const button = screen.getByRole('button', { name: 'Guardar producto completo' }); await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button); }
it('hydrates actual shipping dimensions instead of demanding replacement data', () => { edit(); expect(screen.getByLabelText('Peso kg')).toHaveValue(1); expect(screen.getByLabelText('Largo cm')).toHaveValue(2); });
it('preserves activation, unknown metadata, image provenance and variant tax on edit', async () => {
  edit(); await save(); await waitFor(() => expect(router.push).toHaveBeenCalled());
  expect(calls[0].body).not.toHaveProperty('isActive');
  expect(calls[0].body.metadata).toMatchObject(metadata);
  expect(calls[1].body).not.toHaveProperty('taxRate');
  expect(calls[1].body).not.toHaveProperty('isActive');
});
it('reports earlier saved product when variant conflicts and never claims whole workflow success', async () => {
  handler = async (path) => path.includes('variants') ? Response.json({ message: 'duplicate SKU' }, { status: 409 }) : Response.json({ id: product.id });
  edit(); await save();
  expect(await screen.findByRole('alert')).toHaveTextContent(/producto.*guardado|guardado.*producto/i);
  expect(screen.getByRole('link', { name: /revisar producto/i })).toHaveAttribute('href', `/admin/productos/${product.id}/editar`);
  expect(screen.getByRole('button', { name: 'Guardar producto completo' })).toBeDisabled();
  expect(router.push).not.toHaveBeenCalled(); expect(calls).toHaveLength(2);
});
it('does not validate a draft silently or conflate persistence with publication', async () => {
  edit(); await save(); await waitFor(() => expect(router.push).toHaveBeenCalled());
  expect(calls.map((call) => call.path)).toEqual(['/api/admin/products/product-qa', '/api/admin/variants/variant-qa']);
});
it('does not automatically repeat a write after a lost acknowledgement', async () => {
  handler = async () => { throw new TypeError('connection lost'); };
  edit(); await save(); expect(await screen.findByRole('alert')).toHaveTextContent(/confirmar/);
  const button = screen.getByRole('button', { name: 'Guardar producto completo' }); expect(button).toBeDisabled(); fireEvent.click(button); expect(calls).toHaveLength(1);
});

it('gives selection controls stable accessible names without option text', () => { edit(); for (const name of ['Marca', 'Categoría', 'Bodega']) expect(screen.getByRole('combobox', { name })).toBeInTheDocument(); });
