// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '@/proxy';
import { proxyAdminRequest } from '@/lib/admin/proxy';
const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock('@/config/env', () => ({ env: { apiBaseUrl: 'http://localhost:33833', siteUrl: 'http://localhost:33834' } }));
const fetcher = vi.fn();
beforeEach(() => { cookieGet.mockReturnValue({ value: 'synthetic-access' }); fetcher.mockReset(); vi.stubGlobal('fetch', fetcher); vi.stubEnv('APP_ENV', 'production'); vi.stubEnv('ADMIN_AUTH_DISABLED', 'false'); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function session(payload: unknown, status: number) {
  fetcher.mockResolvedValue(new Response(JSON.stringify(payload), { status }));
  return proxyAdminRequest(new Request('http://localhost:33834/api/admin/session'), '/admin/session', 'GET');
}
describe('Session recovery retains the real proxy authority boundary', () => {
  it('retains the existing login redirect when an access cookie is present', () => {
    const response = proxy(new NextRequest('http://localhost:33834/admin/login', { headers: { cookie: 'dt_admin_access=synthetic-access' } }));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:33834/admin');
  });
  it('permits a fresh login document without cookies and keeps protected routes redirected', () => {
    const login = proxy(new NextRequest('http://localhost:33834/admin/login'));
    expect(login.status).toBe(200); expect(login.headers.get('location')).toBeNull();
    const protectedRoute = proxy(new NextRequest('http://localhost:33834/admin/clientes?pagina=2'));
    expect(protectedRoute.status).toBe(307);
    expect(new URL(protectedRoute.headers.get('location')!).searchParams.get('next')).toBe('/admin/clientes?pagina=2');
  });
  it('naturally clears only local cookies for rejected self-context without claiming revocation', async () => {
    const response = await session({ message: 'Unauthorized' }, 401);
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ kind: 'auth_required' });
    expect(response.cookies.get('dt_admin_access')?.value).toBe('');
    expect(response.cookies.get('dt_admin_refresh')?.value).toBe('');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer synthetic-access');
  });
  it.each([403, 500])('retains retry cookies for real error %i', async (status) => {
    const response = await session({ message: 'synthetic fault' }, status);
    expect(response.status).toBe(status); expect(response.cookies.getAll()).toEqual([]);
  });
  it('retains cookies and fails closed for invalid successful self-context', async () => {
    const response = await session({ user: { permissions: '*' } }, 200);
    expect(response.status).toBe(502); expect(await response.json()).toMatchObject({ kind: 'contract_error' });
    expect(response.cookies.getAll()).toEqual([]);
  });
  it('retains retry cookies when the backend cannot be reached', async () => {
    fetcher.mockRejectedValue(new TypeError('synthetic network fault'));
    const response = await proxyAdminRequest(new Request('http://localhost:33834/api/admin/session'), '/admin/session', 'GET');
    expect(response.status).toBe(502); expect(await response.json()).toMatchObject({ kind: 'network_error' });
    expect(response.cookies.getAll()).toEqual([]);
  });
  it('does not clear cookies for denied mutations or weaken the origin guard', async () => {
    const response = await proxyAdminRequest(new Request('http://localhost:33834/api/admin/session', { method: 'POST', headers: { origin: 'https://evil.invalid' } }), '/admin/session', 'POST');
    expect(response.status).toBe(403); expect(response.cookies.getAll()).toEqual([]); expect(fetcher).not.toHaveBeenCalled();
  });
  it('preserves production fail-closed behavior even when bypass is requested', () => {
    vi.stubEnv('ADMIN_AUTH_DISABLED', 'true');
    expect(proxy(new NextRequest('http://localhost:33834/admin')).status).toBe(307);
  });
});
