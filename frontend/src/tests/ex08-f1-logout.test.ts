// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/admin/session/logout/route';
const cookie = vi.hoisted(() => ({ token: 'fixture-access' as string | null }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => (cookie.token ? { value: cookie.token } : undefined),
  }),
}));
vi.mock('@/config/env', () => ({
  env: {
    apiBaseUrl: 'https://backend.fixture.test',
    siteUrl: 'https://admin.fixture.test',
  },
}));
const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  cookie.token = 'fixture-access';
  fetcher.mockReset();
  vi.stubGlobal('fetch', fetcher);
  vi.stubEnv('ADMIN_AUTH_DISABLED', 'false');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('EX08 F1 logout revocation confirmation', () => {
  it('calls the authenticated backend logout and only confirms after its accepted response', async () => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 201 }),
    );
    const response = await POST(
      new Request('https://admin.fixture.test/api/admin/session/logout', {
        method: 'POST',
      }),
    );
    expect(fetcher.mock.calls[0][0]).toBe(
      'https://backend.fixture.test/api/v1/auth/logout',
    );
    expect(fetcher.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer fixture-access' },
    });
    expect(await response.json()).toEqual({
      success: true,
      revocationConfirmed: true,
    });
    expect(response.cookies.get('dt_admin_access')?.value).toBe('');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
  it('does not claim revocation or discard retry cookies when the backend is unreachable', async () => {
    fetcher.mockRejectedValue(new Error('fixture-private-detail'));
    const response = await POST(
      new Request('https://admin.fixture.test/api/admin/session/logout', {
        method: 'POST',
      }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      success: false,
      revocationConfirmed: false,
      kind: 'network_error',
    });
    expect(response.cookies.get('dt_admin_access')).toBeUndefined();
  });
  it('explicitly distinguishes clearing expired local cookies from confirmed revocation', async () => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );
    const response = await POST(
      new Request('https://admin.fixture.test/api/admin/session/logout', {
        method: 'POST',
      }),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      success: false,
      revocationConfirmed: false,
      localSessionCleared: true,
    });
  });
  it('rejects a forged cross-origin logout before any backend call', async () => {
    const response = await POST(
      new Request('https://admin.fixture.test/api/admin/session/logout', {
        method: 'POST',
        headers: { origin: 'https://other.fixture.test' },
      }),
    );
    expect(response.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('EX08 F1 empty logout body', () => {
  it('accepts an empty POST stream rather than requiring JSON for a bodyless contract', async () => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 201 }),
    );
    const response = await POST(
      new Request('https://admin.fixture.test/api/admin/session/logout', {
        method: 'POST',
        body: '',
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ revocationConfirmed: true });
  });
});

describe('EX08 F1 logout response integrity', () => {
  it('treats a bodyless204 as unconfirmed contract failure without throwing or deleting cookies', async () => {
    fetcher.mockResolvedValue(new Response(null, { status: 204 }));
    const response = await POST(
      new Request('https://admin.fixture.test/api/admin/session/logout', {
        method: 'POST',
      }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      success: false,
      revocationConfirmed: false,
      kind: 'contract_error',
    });
    expect(response.cookies.get('dt_admin_access')).toBeUndefined();
  });
  it('uses configured public origin when Next internally aliases its request URL', async () => {
    fetcher.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), { status: 201 }),
    );
    const response = await POST(
      new Request('http://localhost:3327/api/admin/session/logout', {
        method: 'POST',
        headers: { origin: 'https://admin.fixture.test' },
      }),
    );
    expect(response.status).toBe(201);
  });
  it('does not trust an impostor Origin matching an attacker-controlled Host', async () => {
    const response = await POST(
      new Request('https://admin.fixture.test/api/admin/session/logout', {
        method: 'POST',
        headers: {
          origin: 'https://other.fixture.test',
          host: 'other.fixture.test',
        },
      }),
    );
    expect(response.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
