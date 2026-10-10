import {
  getPublicFooter,
  saveFooterGroups,
  validateFooterGroups,
} from '@/lib/api/footer';
import { apiRequest } from '@/lib/api/client';
vi.mock('@/lib/api/client', () => ({ apiRequest: vi.fn() }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('public footer requests fresh projection and strips extra audit metadata', async () => {
  vi.mocked(apiRequest).mockResolvedValue({
    data: {
      version: 2,
      groups: [
        {
          title: 'Catálogo',
          items: [
            { label: 'Productos', href: '/productos', token: 'never-public' },
          ],
        },
      ],
      routeAlerts: ['private'],
    },
    status: 200,
    headers: new Headers(),
  });
  expect(await getPublicFooter()).toEqual({
    version: 2,
    groups: [
      {
        title: 'Catálogo',
        items: [{ label: 'Productos', href: '/productos' }],
      },
    ],
  });
  expect(apiRequest).toHaveBeenCalledWith('/api/v1/content/footer', {
    cache: 'no-store',
  });
});
it.each([
  'javascript:alert(1)',
  '//host.test',
  '/products?private=token',
  '/a/../admin',
  '/productos\n',
])('rejects unsafe returned href %s', async (href) => {
  vi.mocked(apiRequest).mockResolvedValue({
    data: {
      version: 1,
      groups: [{ title: 'A', items: [{ label: 'A', href }] }],
    },
    status: 200,
    headers: new Headers(),
  });
  await expect(getPublicFooter()).rejects.toThrow();
});
it('admin validation and draft save use cookie proxy without client tokens', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue({ ok: true, json: async () => ({ valid: true }) });
  vi.stubGlobal('fetch', fetch);
  const groups = [{ title: 'T', links: [{ label: 'Inicio', href: '/' }] }];
  await validateFooterGroups(groups);
  await saveFooterGroups(groups);
  await saveFooterGroups(groups, 'draft-id');
  expect(fetch.mock.calls.map(([path]) => path)).toEqual([
    '/api/admin/content/footer/validate',
    '/api/admin/content/footer',
    '/api/admin/content/footer/draft-id',
  ]);
  expect(fetch.mock.calls[2][1]).toMatchObject({
    method: 'PATCH',
    body: JSON.stringify({ groups }),
    headers: { 'Content-Type': 'application/json' },
  });
});
it('authorization denial is shown without mutation retries', async () => {
  const fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 403,
    json: async () => ({ message: 'Permiso footer.write requerido.' }),
  });
  vi.stubGlobal('fetch', fetch);
  await expect(saveFooterGroups([])).rejects.toThrow(
    'Permiso footer.write requerido.',
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});

it.each([
  '/productos?category=compresores',
  '/productos?brand=total&status=available&sort=price-asc',
  '/buscar?q=taladro+industrial',
  '/categorias/herramientas?brand=total&sort=name-asc',
  '/marcas/total?category=compresores',
  '/storefront/productos?category=compresores',
])('accepts a backend-validated public catalog query %s', async (href) => {
  vi.mocked(apiRequest).mockResolvedValue({
    data: {
      version: 3,
      groups: [
        { title: 'Catálogo', items: [{ label: 'Destino validado', href }] },
      ],
    },
    status: 200,
    headers: new Headers(),
  });
  expect((await getPublicFooter()).groups[0].items[0].href).toBe(href);
});
it.each([
  '/productos?private=token',
  '/productos?status=unauthorized-state',
  '/productos?category=compresores&category=otra',
])(
  'rejects returned queries outside the generated page contract %s',
  async (href) => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        version: 3,
        groups: [{ title: 'Catálogo', items: [{ label: 'Destino', href }] }],
      },
      status: 200,
      headers: new Headers(),
    });
    await expect(getPublicFooter()).rejects.toThrow();
  },
);
