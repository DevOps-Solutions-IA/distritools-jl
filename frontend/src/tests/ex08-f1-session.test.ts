// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/admin/[...path]/route';
import { proxyAdminRequest } from '@/lib/admin/proxy';
import { proxy } from '@/proxy';
import { getAdminSessionContext } from '@/lib/admin/transport/session';
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'fixture-access' }) }),
}));
vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: 'https://backend.fixture.test' },
}));
const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  fetcher.mockReset();
  vi.stubGlobal('fetch', fetcher);
  vi.stubEnv('ADMIN_AUTH_DISABLED', 'false');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('EX08 F1 session401 local recovery', () => {
  async function readSession() {
    return GET(new Request('https://admin.fixture.test/api/admin/session'), {
      params: Promise.resolve({ path: ['session'] }),
    });
  }

  it('allows login after backend rejects an invalid or revoked cookie without claiming revocation', async () => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );
    const login = new NextRequest('https://admin.fixture.test/admin/login', {
      headers: {
        cookie:
          'dt_admin_access=fixture-access; dt_admin_refresh=fixture-refresh',
      },
    });
    expect(proxy(login).headers.get('location')).toBe(
      'https://admin.fixture.test/admin',
    );
    const response = await readSession();
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const payload = await response.json();
    expect(payload).toMatchObject({ kind: 'auth_required' });
    expect(payload.revocationConfirmed).toBeUndefined();
    for (const name of ['dt_admin_access', 'dt_admin_refresh']) {
      const expired = response.cookies.get(name);
      expect(expired?.value).toBe('');
      const expires = expired?.expires;
      expect(expires instanceof Date ? expires.getTime() : expires).toBe(0);
      login.cookies.delete(name);
    }
    const navigation = proxy(login);
    expect(navigation.status).toBe(200);
    expect(navigation.headers.get('location')).toBeNull();
  });

  it.each([403, 500, 503])(
    'preserves retry cookies for session status %s',
    async (status) => {
      fetcher.mockResolvedValue(
        new Response(JSON.stringify({ error: 'fixture failure' }), { status }),
      );
      const response = await readSession();
      expect(response.status).toBe(status);
      expect(response.cookies.getAll()).toEqual([]);
    },
  );

  it('preserves cookies when the session backend is unreachable', async () => {
    fetcher.mockRejectedValue(new Error('fixture network failure'));
    const response = await readSession();
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ kind: 'network_error' });
    expect(response.cookies.getAll()).toEqual([]);
  });

  it('preserves cookies for malformed successful session response', async () => {
    fetcher.mockResolvedValue(new Response('invalid JSON', { status: 200 }));
    const response = await readSession();
    expect(response.status).toBe(502);
    expect(response.cookies.getAll()).toEqual([]);
  });

  it('clears only local cookies on backend session401 even when its error body is malformed', async () => {
    fetcher.mockResolvedValue(new Response('invalid JSON', { status: 401 }));
    const response = await readSession();
    expect(response.status).toBe(401);
    expect(response.cookies.get('dt_admin_access')?.value).toBe('');
    expect(response.cookies.get('dt_admin_refresh')?.value).toBe('');
    expect(await response.json()).not.toHaveProperty('revocationConfirmed');
  });

  it('does not clear cookies for another admin GET returning401', async () => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );
    const response = await GET(
      new Request('https://admin.fixture.test/api/admin/orders'),
      {
        params: Promise.resolve({ path: ['orders'] }),
      },
    );
    expect(response.status).toBe(401);
    expect(response.cookies.getAll()).toEqual([]);
  });

  it('does not clear cookies for a session mutation returning401', async () => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );
    const response = await proxyAdminRequest(
      new Request('https://admin.fixture.test/api/admin/session', {
        method: 'POST',
      }),
      '/admin/session',
      'POST',
    );
    expect(response.status).toBe(401);
    expect(response.cookies.getAll()).toEqual([]);
  });

  it('does not clear cookies when the mutation Origin guard rejects the request', async () => {
    const response = await proxyAdminRequest(
      new Request('https://admin.fixture.test/api/admin/session', {
        method: 'POST',
        headers: { origin: 'https://impostor.fixture.test' },
      }),
      '/admin/session',
      'POST',
    );
    expect(response.status).toBe(403);
    expect(response.cookies.getAll()).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
describe('EX08 F1 verified session contract adapter', () => {
  it('accepts the minimal DB-authorized contract and strips unrelated fields', async () => {
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 'user-fixture',
            email: 'fixture@example.test',
            role: 'VIEWER',
            permissions: ['orders.read'],
            passwordHash: 'must-not-cross-boundary',
          },
          refreshToken: 'must-not-cross-boundary',
        }),
      ),
    );
    const result = await getAdminSessionContext();
    expect(result).toMatchObject({
      ok: true,
      data: {
        user: {
          id: 'user-fixture',
          email: 'fixture@example.test',
          role: 'VIEWER',
          permissions: ['orders.read'],
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('must-not-cross-boundary');
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://backend.fixture.test/api/v1/admin/session',
    );
  });
  it('fails closed on malformed permissions rather than deriving authority from token text', async () => {
    fetcher.mockResolvedValue(
      new Response(
        JSON.stringify({
          user: {
            id: 'user-fixture',
            email: 'fixture@example.test',
            role: 'VIEWER',
            permissions: 'all',
          },
        }),
      ),
    );
    expect(await getAdminSessionContext()).toMatchObject({
      ok: false,
      kind: 'contract_error',
    });
  });
});
