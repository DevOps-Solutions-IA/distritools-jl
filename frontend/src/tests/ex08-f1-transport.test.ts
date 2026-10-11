// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  adminFetch,
  getAdminOperationalSnapshot,
  getAdminCatalogOperationsData,
} from '@/lib/admin/server-data';
import { proxyAdminRequest } from '@/lib/admin/proxy';
import { adminFailure } from '@/lib/admin/transport/result';
import { getAdminCatalogSnapshot } from '@/lib/admin/operations';
import { GET, POST, PATCH } from '@/app/api/admin/[...path]/route';
const cookie = vi.hoisted(() => ({ token: 'fixture-access' as string | null }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (cookie.token ? { value: cookie.token } : undefined),
  }),
}));
vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: 'https://backend.fixture.test' },
}));
const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  cookie.token = 'fixture-access';
  vi.stubGlobal('fetch', fetcher);
  fetcher.mockReset();
  vi.stubEnv('ADMIN_AUTH_DISABLED', 'false');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('EX08 F1 authenticated read contracts', () => {
  it('returns a typed missing-session failure without any backend call', async () => {
    cookie.token = null;
    expect(await adminFetch('/admin/orders')).toMatchObject({
      ok: false,
      kind: 'auth_required',
      status: 401,
      data: null,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    [401, 'auth_required'],
    [403, 'forbidden'],
    [400, 'validation_error'],
    [500, 'server_error'],
  ])('preserves status %s as %s', async (status, kind) => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ message: 'denied' }), { status }),
    );
    expect(await adminFetch('/admin/orders')).toMatchObject({
      ok: false,
      kind,
      status,
      data: null,
    });
  });
  it('contains network failure without exposing the upstream exception', async () => {
    fetcher.mockRejectedValue(new Error('fixture-private-detail'));
    const result = await adminFetch('/admin/orders');
    expect(result).toMatchObject({
      ok: false,
      kind: 'network_error',
      status: 0,
      data: null,
    });
    expect(JSON.stringify(result)).not.toContain('fixture-private-detail');
  });
  it('rejects invalid JSON as a contract error instead of success with an empty object', async () => {
    fetcher.mockResolvedValue(new Response('not JSON', { status: 200 }));
    expect(await adminFetch('/admin/orders')).toMatchObject({
      ok: false,
      kind: 'contract_error',
      data: null,
    });
  });
  it('loads only selected orders with real pagination/filter query and authenticated no-store headers', async () => {
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({ data: [], meta: { page: 2, limit: 20, total: 21 } }),
      ),
    );
    // New overload intentionally exercised before implementation.
    const snapshot = await getAdminOperationalSnapshot(['orders'], {
      page: '2',
      limit: '20',
      status: 'pending',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://backend.fixture.test/api/v1/admin/orders?page=2&limit=20&status=pending',
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      headers: { Authorization: 'Bearer fixture-access' },
      cache: 'no-store',
    });
    expect(snapshot.orders.meta?.total).toBe(21);
    expect(snapshot).not.toHaveProperty('payments');
  });
  it('does not convert an operational 403 to a successful empty collection', async () => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }),
    );
    await expect(getAdminOperationalSnapshot(['orders'])).rejects.toMatchObject(
      { result: { kind: 'forbidden', status: 403 } },
    );
  });
  it('does not manufacture catalog zero metrics after an upstream failure', async () => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ message: 'failure' }), { status: 500 }),
    );
    await expect(getAdminCatalogOperationsData()).rejects.toMatchObject({
      result: { kind: 'server_error' },
    });
  });
});
describe('EX08 F1 BFF contracts', () => {
  it.each([
    { action: 'validate-sellability', method: 'POST', status: 201 },
    { action: 'activate', method: 'PATCH', status: 200 },
    { action: 'deactivate', method: 'PATCH', status: 200 },
  ] as const)(
    'forwards bodyless JSON $method product $action without inventing a payload',
    async ({ action, method, status }) => {
      const upstream = { fixture: 'transport-response' };
      fetcher.mockResolvedValue(
        new Response(JSON.stringify(upstream), { status }),
      );
      const handler = method === 'POST' ? POST : PATCH;
      const response = await handler(
        new Request(
          `https://admin.fixture.test/api/admin/products/product-fixture/${action}`,
          {
            method,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
        {
          params: Promise.resolve({
            path: ['products', 'product-fixture', action],
          }),
        },
      );
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(upstream);
      expect(fetcher.mock.calls[0][0]).toBe(
        `https://backend.fixture.test/api/v1/admin/products/product-fixture/${action}`,
      );
      expect(fetcher.mock.calls[0][1]).toMatchObject({
        method,
        body: undefined,
        headers: { Authorization: 'Bearer fixture-access' },
      });
    },
  );

  it('treats whitespace JSON body as a bodyless mutation', async () => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ fixture: 'transport-response' }), {
        status: 201,
      }),
    );
    const response = await proxyAdminRequest(
      new Request(
        'https://admin.fixture.test/api/admin/products/product-fixture/validate-sellability',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: ' \n\t ',
        },
      ),
      '/admin/products/product-fixture/validate-sellability',
      'POST',
    );
    expect(response.status).toBe(201);
    expect(fetcher.mock.calls[0][1]?.body).toBeUndefined();
  });

  it.each(['null', '[]', '7', 'true', '"text"'])(
    'rejects non-object JSON %s before the backend',
    async (body) => {
      const response = await proxyAdminRequest(
        new Request('https://admin.fixture.test/api/admin/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        }),
        '/admin/orders',
        'POST',
      );
      expect(response.status).toBe(400);
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it('retains GET pagination, filters and encoded search from the actual route', async () => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ data: [] })));
    const response = await GET(
      new Request(
        'https://admin.fixture.test/api/admin/orders?page=2&search=SKU%2B1',
      ),
      { params: Promise.resolve({ path: ['orders'] }) },
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://backend.fixture.test/api/v1/admin/orders?page=2&search=SKU%2B1',
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('returns controlled 502 on network failure', async () => {
    fetcher.mockRejectedValue(new Error('fixture-private-detail'));
    const response = await proxyAdminRequest(
      new Request('https://admin.fixture.test/api/admin/orders'),
      '/admin/orders',
      'GET',
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ kind: 'network_error' });
  });
  it('rejects malformed mutation JSON without a backend call', async () => {
    const response = await proxyAdminRequest(
      new Request('https://admin.fixture.test/api/admin/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
      '/admin/orders',
      'POST',
    );
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects cross-origin cookie mutations without a backend call', async () => {
    const response = await proxyAdminRequest(
      new Request('https://admin.fixture.test/api/admin/orders', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'https://other.fixture.test',
        },
        body: '{}',
      }),
      '/admin/orders',
      'POST',
    );
    expect(response.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('EX08 F1 administrative catalog source', () => {
  it('reads protected admin collections including an inactive product', async () => {
    fetcher.mockImplementation(async (input) => {
      const path = String(input);
      if (path.endsWith('/admin/products'))
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'inactive-fixture',
                name: 'Borrador',
                slug: 'borrador',
                description: null,
                metadata: null,
                brand: null,
                category: null,
                isActive: false,
              },
            ],
          }),
        );
      if (
        path.endsWith('/admin/brands') ||
        path.endsWith('/admin/categories') ||
        path.endsWith('/admin/variants')
      )
        return new Response(JSON.stringify({ data: [] }));
      throw new Error('Public catalog reader must not be used');
    });
    const snapshot = await getAdminCatalogSnapshot();
    expect(snapshot.productRows.map((row) => row.id)).toContain(
      'inactive-fixture',
    );
    expect(fetcher.mock.calls.map((call) => String(call[0])).sort()).toEqual(
      ['brands', 'categories', 'products', 'variants']
        .map(
          (resource) => `https://backend.fixture.test/api/v1/admin/${resource}`,
        )
        .sort(),
    );
  });
});

describe('EX08 F1 session BFF redaction', () => {
  it('returns only the accepted minimal self-context at the browser boundary', async () => {
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 'user-fixture',
            email: 'fixture@example.test',
            role: 'VIEWER',
            permissions: ['orders.read'],
            secret: 'must-not-cross-boundary',
          },
          extra: 'must-not-cross-boundary',
        }),
      ),
    );
    const response = await proxyAdminRequest(
      new Request('https://admin.fixture.test/api/admin/session'),
      '/admin/session',
      'GET',
    );
    expect(await response.json()).toEqual({
      user: {
        id: 'user-fixture',
        email: 'fixture@example.test',
        role: 'VIEWER',
        permissions: ['orders.read'],
      },
    });
  });
});

describe('EX08 F1 catalog form options', () => {
  it('requires only protected brand and category reads to create a product', async () => {
    fetcher.mockImplementation(
      async () => new Response(JSON.stringify({ data: [] })),
    );
    await getAdminCatalogSnapshot('options');
    expect(fetcher.mock.calls.map((call) => String(call[0])).sort()).toEqual(
      ['brands', 'categories']
        .map(
          (resource) => `https://backend.fixture.test/api/v1/admin/${resource}`,
        )
        .sort(),
    );
  });
});

describe('EX08 F1 contract and path boundaries', () => {
  it('rejects a missing collection data field instead of entering a domain adapter', async () => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ wrong: [] })));
    await expect(getAdminOperationalSnapshot(['orders'])).rejects.toMatchObject(
      { result: { kind: 'contract_error' } },
    );
  });
  it('does not let decoded catch-all segments escape the admin namespace', async () => {
    const response = await GET(
      new Request('https://admin.fixture.test/api/admin/invalid'),
      { params: Promise.resolve({ path: ['..', 'auth', 'login'] }) },
    );
    expect(response.status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('EX08 F1 provider failure source contract', () => {
  it('distinguishes the actual serialized quote-provider503 from a generic server outage', () => {
    expect(
      adminFailure(503, {
        statusCode: 503,
        error:
          'El envío de cotizaciones no está disponible para el proveedor configurado.',
      }),
    ).toMatchObject({
      ok: false,
      status: 503,
      kind: 'provider_blocked',
      data: null,
    });
  });
  it('does not mislabel every503 as a provider block', () => {
    expect(
      adminFailure(503, { error: 'Infrastructure unavailable' }),
    ).toMatchObject({ ok: false, kind: 'server_error' });
  });
});
