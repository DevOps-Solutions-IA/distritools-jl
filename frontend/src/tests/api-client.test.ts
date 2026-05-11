import { createApiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

describe('api client base', () => {
  it('maneja error HTTP con status y payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Forbidden' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const client = createApiClient('/admin');

    await expect(client.get('/orders')).rejects.toMatchObject({
      message: 'Forbidden',
      status: 403,
    } satisfies Partial<ApiError>);
  });

  it('maneja respuesta JSON válida', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    const client = createApiClient('/public');
    const response = await client.get<{ ok: boolean }>('/health');

    expect(fetch).toHaveBeenCalledWith('/public/health', expect.any(Object));
    expect(response.status).toBe(200);
    expect(response.data.ok).toBe(true);
  });

  it('normaliza fallos de red del navegador sin mostrar Load failed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Load failed')),
    );

    const client = createApiClient('/api/v1');

    await expect(client.post('/checkout/guest-order', {})).rejects.toMatchObject({
      message:
        'No pudimos completar tu pedido en este momento. Revisa tus datos e inténtalo nuevamente.',
      status: 500,
    } satisfies Partial<ApiError>);
  });
});
