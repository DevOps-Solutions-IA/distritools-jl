// @vitest-environment node

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from '@/proxy';

describe('Next 16 admin proxy', () => {
  beforeEach(() => {
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('ADMIN_AUTH_DISABLED', 'false');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function expectPassThrough(request: NextRequest) {
    const response = proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(response.headers.get('location')).toBeNull();
  }

  it('passes through a public path without an access cookie', () => {
    expectPassThrough(new NextRequest('https://example.test/productos?q=taladro'));
  });

  it('redirects unauthenticated admin requests and preserves the path and query', () => {
    const request = new NextRequest(
      'https://example.test/admin/pedidos?estado=pendiente&pagina=2',
    );
    const response = proxy(request);
    const location = response.headers.get('location');

    expect(response.status).toBe(307);
    expect(location).not.toBeNull();
    const redirect = new URL(location!);
    expect(redirect.origin).toBe(request.nextUrl.origin);
    expect(redirect.pathname).toBe('/admin/login');
    expect(redirect.searchParams.get('next')).toBe(
      '/admin/pedidos?estado=pendiente&pagina=2',
    );
  });

  it('redirects an authenticated login request to the admin home', () => {
    const request = new NextRequest('https://example.test/admin/login', {
      headers: { cookie: 'dt_admin_access=test-access' },
    });
    const response = proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://example.test/admin');
  });

  it('passes through an authenticated admin request', () => {
    expectPassThrough(
      new NextRequest('https://example.test/admin/pedidos', {
        headers: { cookie: 'dt_admin_access=test-access' },
      }),
    );
  });

  it('allows the auth bypass outside production', () => {
    vi.stubEnv('APP_ENV', 'local');
    vi.stubEnv('ADMIN_AUTH_DISABLED', 'true');

    expectPassThrough(new NextRequest('https://example.test/admin'));
  });

  it('does not allow the auth bypass for an unrecognized APP_ENV', () => {
    vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('ADMIN_AUTH_DISABLED', 'true');

    const response = proxy(new NextRequest('https://example.test/admin'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://example.test/admin/login?next=%2Fadmin',
    );
  });

  it('ignores the auth bypass in production', () => {
    vi.stubEnv('ADMIN_AUTH_DISABLED', 'true');

    const response = proxy(new NextRequest('https://example.test/admin'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://example.test/admin/login?next=%2Fadmin',
    );
  });

  it('ignores the auth bypass when NODE_ENV is production and APP_ENV is unset', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_ENV', '');
    vi.stubEnv('ADMIN_AUTH_DISABLED', 'true');

    const response = proxy(new NextRequest('https://example.test/admin'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'https://example.test/admin/login?next=%2Fadmin',
    );
  });
});
