import type { ReactElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminShell } from '@/components/layout/AdminShell';
import AdminProductsPage from '@/app/admin/productos/page';
import AdminProductDetailPage from '@/app/admin/productos/[id]/page';

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'fixture-access' }) }),
}));
vi.mock('@/config/env', () => ({
  env: {
    apiBaseUrl: 'https://backend.fixture.test',
    siteUrl: 'https://admin.fixture.test',
  },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/productos',
  useRouter: () => navigation,
}));

type BoundaryModule = {
  default: (props: {
    error: Error & { digest?: string };
    reset: () => void;
  }) => ReactElement;
};
async function loadBoundary() {
  return vi.importActual<BoundaryModule>('@/app/admin/error');
}

const fetcher = vi.fn<typeof fetch>();
beforeEach(() => {
  navigation.refresh.mockReset();
  vi.stubEnv('ADMIN_AUTH_DISABLED', 'false');
  vi.stubGlobal('fetch', fetcher);
  fetcher.mockReset();
  fetcher.mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          user: {
            id: 'fixture-user',
            email: 'fixture@example.test',
            role: 'admin',
            permissions: ['catalog.read'],
          },
        }),
      ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('EX08 F1 admin technical error boundary', () => {
  it('mounts the actual administrative Shell when the page could not return it', async () => {
    const { default: AdminError } = await loadBoundary();
    const element = AdminError({
      error: new Error('fixture read failure'),
      reset: vi.fn(),
    });
    expect(element.type).toBe(AdminShell);
    render(element);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Lectura administrativa no disponible',
    );
  });

  it('invokes Next reset when the user retries the unavailable read', async () => {
    const { default: AdminError } = await loadBoundary();
    const reset = vi.fn();
    render(
      <AdminError error={new Error('fixture read failure')} reset={reset} />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('requests a fresh server payload before resetting the failed read on retry', async () => {
    const { default: AdminError } = await loadBoundary();
    const requests: string[] = [];
    navigation.refresh.mockImplementation(() =>
      requests.push('server-refresh'),
    );
    const reset = vi.fn(() => requests.push('boundary-reset'));
    render(
      <AdminError
        error={new Error('fixture server read failure')}
        reset={reset}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
    expect(requests).toEqual(['server-refresh', 'boundary-reset']);
  });

  it('does not disclose production server error text, stack, digest or private data', async () => {
    const { default: AdminError } = await loadBoundary();
    const error = Object.assign(
      new Error('private@example.test SECRET-PROVIDER'),
      { digest: 'private-digest' },
    );
    error.stack = 'private-stack database detail';
    render(<AdminError error={error} reset={vi.fn()} />);
    const alert = await screen.findByRole('alert');
    for (const secret of [
      'private@example.test',
      'SECRET-PROVIDER',
      'private-digest',
      'private-stack',
    ]) {
      expect(document.body).not.toHaveTextContent(secret);
    }
    expect(alert).not.toHaveTextContent('$ 0');
    expect(alert).not.toHaveTextContent('READY');
    expect(alert).not.toHaveTextContent('NO_GO');
  });

  const pages = [
    {
      name: 'catalog list',
      run: () => AdminProductsPage({ searchParams: Promise.resolve({}) }),
    },
    {
      name: 'catalog detail',
      run: () =>
        AdminProductDetailPage({
          params: Promise.resolve({ id: 'fixture-product' }),
        }),
    },
  ];
  for (const status of [401, 403, 500]) {
    it.each(pages)(
      `provides Shell recovery after the actual $name reader throws status ${status}`,
      async (page) => {
        fetcher.mockImplementation(async (input) =>
          String(input).includes('/admin/session')
            ? new Response(
                JSON.stringify({
                  user: {
                    id: 'fixture-user',
                    email: 'fixture@example.test',
                    role: 'admin',
                    permissions: ['catalog.read'],
                  },
                }),
              )
            : new Response(
                JSON.stringify({ error: 'private-catalog-detail' }),
                { status },
              ),
        );
        const error = await page.run().catch((failure: unknown) => failure);
        expect(error).toMatchObject({
          name: 'AdminReadError',
          result: { status, data: null },
        });
        expect(error).toBeInstanceOf(Error);
        if (!(error instanceof Error))
          throw new Error('Expected the real reader to fail');
        const { default: AdminError } = await loadBoundary();
        const element = AdminError({ error, reset: vi.fn() });
        expect(element.type).toBe(AdminShell);
        render(element);
        const alert = await screen.findByRole('alert');
        expect(alert).toHaveTextContent('Lectura administrativa no disponible');
        expect(alert).not.toHaveTextContent('private-catalog-detail');
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
      },
    );
  }
});
