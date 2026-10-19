import { GET } from '@/app/api/admin/reports/export/route';
const auth = vi.hoisted(() => ({ token: 'test-token' as string | undefined }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => auth.token ? { value: auth.token } : undefined }) }));
vi.mock('@/lib/admin/dev-auth-bypass', () => ({ isDevAdminAuthDisabled: () => false }));
const request = (query = 'range=30d&type=orders&format=csv') => new Request(`http://localhost/api/admin/reports/export?${query}`);
beforeEach(() => { auth.token = 'test-token'; vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => vi.unstubAllGlobals());
it('rechaza formato inválido sin consultar backend', async () => {
  const response = await GET(request('format=html'));
  expect(response.status).toBe(400); expect(fetch).not.toHaveBeenCalled();
});
it('requiere sesión para exportar', async () => {
  auth.token = undefined; const response = await GET(request());
  expect(response.status).toBe(401); expect(fetch).not.toHaveBeenCalled();
});
it('rechaza navegación de otro sitio antes del endpoint auditado', async () => {
  const response = await GET(new Request(request(), { headers: { 'sec-fetch-site': 'cross-site' } }));
  expect(response.status).toBe(403); expect(fetch).not.toHaveBeenCalled();
});
it('rechaza Origin extranjero incluso si sec-fetch-site no está presente', async () => {
  const response = await GET(new Request(request(), { headers: { origin: 'https://foreign.example.test' } }));
  expect(response.status).toBe(403); expect(fetch).not.toHaveBeenCalled();
});
it('un fallo de conexión es un error controlado, no una descarga', async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new Error('transport-down'));
  const response = await GET(request()); expect(response.status).toBe(502);
  expect(await response.text()).not.toContain('transport-down');
});
it('una respuesta HTML exitosa no se ofrece como CSV', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('<html>gateway</html>', { headers: { 'content-type': 'text/html' } }));
  const response = await GET(request()); expect(response.status).toBe(502);
});
it('valida PDF por firma y no sólo MIME', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('not-a-pdf', { headers: { 'content-type': 'application/pdf' } }));
  expect((await GET(request('format=pdf'))).status).toBe(502);
});
it('rechaza el tamaño declarado excesivo antes de materializar los bytes', async () => {
  const upstream = new Response('title,DistriTools\n', { headers: { 'content-type': 'text/csv', 'content-length': '10485761' } });
  vi.mocked(fetch).mockResolvedValueOnce(upstream);
  expect((await GET(request())).status).toBe(502);
  expect(upstream.bodyUsed).toBe(false);
});
it('cancela una respuesta sin Content-Length al superar 10 MiB sin consumir todo el stream', async () => {
  const chunk = new Uint8Array(1024 * 1024).fill(97);
  chunk.set(new TextEncoder().encode('title,DistriTools\nproduct,quantity\n'));
  let pulls = 0; let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++;
      // Finite fallback keeps the test bounded if the route regresses to reading everything.
      if (pulls > 20) { controller.close(); return; }
      controller.enqueue(chunk);
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const upstream = new Response(stream, { headers: { 'content-type': 'text/csv' } });
  expect(upstream.headers.has('content-length')).toBe(false);
  vi.mocked(fetch).mockResolvedValueOnce(upstream);
  const response = await GET(request());
  expect(response.status).toBe(502);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.has('content-disposition')).toBe(false);
  expect(cancelled).toBe(true);
  expect(pulls).toBe(11);
});
it('acepta un CSV sin Content-Length de exactamente 10 MiB y conserva sus extremos', async () => {
  const limit = 10 * 1024 * 1024;
  const bytes = new Uint8Array(limit).fill(97);
  const prefix = new TextEncoder().encode('title,DistriTools\nproduct,quantity\n"');
  const suffix = new TextEncoder().encode('",1\n');
  bytes.set(prefix); bytes.set(suffix, limit - suffix.length);
  let offset = 0; let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset === limit) { controller.close(); return; }
      const end = Math.min(offset + 1024 * 1024, limit);
      controller.enqueue(bytes.subarray(offset, end)); offset = end;
    },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const upstream = new Response(stream, { headers: { 'content-type': 'text/csv' } });
  expect(upstream.headers.has('content-length')).toBe(false);
  vi.mocked(fetch).mockResolvedValueOnce(upstream);
  const response = await GET(request()); const received = new Uint8Array(await response.arrayBuffer());
  expect(response.status).toBe(200); expect(received.byteLength).toBe(limit);
  expect(Array.from(received.subarray(0, prefix.length))).toEqual(Array.from(prefix));
  expect(Array.from(received.subarray(limit - suffix.length))).toEqual(Array.from(suffix));
  expect(cancelled).toBe(false); expect(offset).toBe(limit);
});
it('conserva bytes CSV válidos, filtros y autorización, con caché privada', async () => {
  const csv = 'title,DistriTools\nproduct,quantity\n"\'=2+2",1';
  vi.mocked(fetch).mockResolvedValueOnce(new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="distritools-report-orders.csv"' } }));
  const response = await GET(request('range=7d&type=orders&format=csv&status=paid'));
  expect(await response.text()).toBe(csv); expect(response.headers.get('cache-control')).toContain('no-store');
  expect(response.headers.get('content-disposition')).toContain('orders.csv');
  expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toMatchObject({ range: '7d', status: 'paid', type: 'orders' });
});
it('no transforma una denegación RBAC en éxito ni expone detalle interno', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({ error: 'private-stack' }, { status: 403 }));
  const response = await GET(request()); expect(response.status).toBe(403);
  expect(await response.text()).not.toContain('private-stack');
});
