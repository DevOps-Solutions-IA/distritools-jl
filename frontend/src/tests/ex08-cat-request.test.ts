import { catalogRequest, CatalogRequestError } from '@/features/admin/catalog/request';
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it.each([401,403,404,409,422])('classifies definitive HTTP%i denial without claiming persistence', async (status) => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status })));
  try { await catalogRequest('/api/admin/products', 'POST', {}); throw new Error('should fail'); }
  catch (error) { expect(error).toBeInstanceOf(CatalogRequestError); expect(error).toHaveProperty('uncertain', false); }
});
it('retains concrete DTO errors supplied by the guarded BFF', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ message: ['sortOrder must be an integer', 'parent cannot be self'] }, { status: 400 })));
  await expect(catalogRequest('/api/admin/categories/id/tree','PATCH',{})).rejects.toThrow('sortOrder must be an integer; parent cannot be self');
});
it.each([500,502,503])('treats HTTP%i as uncertain rather than permitting an automatic repeated write', async (status) => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({}, { status })));
  await expect(catalogRequest('/api/admin/products','POST',{})).rejects.toHaveProperty('uncertain', true);
});
it('treats a malformed success acknowledgement as uncertain', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('not json', { status: 201 })));
  await expect(catalogRequest('/api/admin/products','POST',{})).rejects.toHaveProperty('uncertain', true);
});
it('ends a write that never acknowledges with an uncertain result and does not retry it', async () => {
  vi.useFakeTimers(); let finished = false;
  const transport = vi.fn((_path: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
  vi.stubGlobal('fetch', transport);
  void catalogRequest('/api/admin/products','POST',{}).catch((error) => { expect(error).toHaveProperty('uncertain', true); finished = true; });
  await vi.advanceTimersByTimeAsync(12001);
  expect(finished).toBe(true); expect(transport).toHaveBeenCalledOnce();
});
