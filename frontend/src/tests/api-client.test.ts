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

    expect(response.status).toBe(200);
    expect(response.data.ok).toBe(true);
  });
});
