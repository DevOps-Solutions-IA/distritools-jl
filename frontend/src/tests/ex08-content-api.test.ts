import { z } from 'zod';
import { contentRequest } from '@/features/admin/content/api';
afterEach(() => vi.unstubAllGlobals());
it('refuses a successful HTTP response with malformed or absent persisted identity', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ status: 'published' }), { status: 201 }),
      ),
  );
  await expect(
    contentRequest('legal', z.object({ id: z.string() }), 'POST', {
      title: 'Existing fixture',
    }),
  ).rejects.toMatchObject({ kind: 'contract_error', status: 201 });
});
it('distinguishes auth, permission, validation, server and transport failures', async () => {
  for (const [status, kind] of [
    [401, 'auth_required'],
    [403, 'forbidden'],
    [400, 'validation_error'],
    [500, 'server_error'],
  ] as const) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'Checklist incompleto.' }), {
          status,
        }),
      ),
    );
    await expect(
      contentRequest('legal/a/publish', z.object({ id: z.string() }), 'POST'),
    ).rejects.toMatchObject({ status, kind });
  }
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
  await expect(
    contentRequest('footer', z.object({ id: z.string() })),
  ).rejects.toMatchObject({ status: 0, kind: 'network_error' });
});
it('sends JSON for bodyless transitions and reads are always uncached', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ id: 'persisted' }), { status: 201 }),
    );
  vi.stubGlobal('fetch', fetch);
  await contentRequest(
    'footer/persisted/approve',
    z.object({ id: z.string() }),
    'POST',
  );
  expect(fetch).toHaveBeenCalledWith(
    '/api/admin/content/footer/persisted/approve',
    expect.objectContaining({ method: 'POST', body: '{}', cache: 'no-store' }),
  );
});

it('preserves the proxy transport outage instead of reporting it as server rejection', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          kind: 'network_error',
          message: 'No se pudo conectar con el servicio administrativo.',
        }),
        { status: 502 },
      ),
    ),
  );
  await expect(
    contentRequest('legal/privacy', z.object({ id: z.string() })),
  ).rejects.toMatchObject({ status: 502, kind: 'network_error' });
});
