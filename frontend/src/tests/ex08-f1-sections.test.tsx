import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminOrdersPage from '@/app/admin/pedidos/page';
import * as inventoryHistoryPage from '@/app/admin/inventario/historial/page';
import { AdminSectionPage } from '@/components/admin/AdminSectionPage';
import { LegalScreen } from '@/features/admin/screen-adapters/content/SectionScreens';
import {
  getAdminCatalogSnapshot,
  getAdminModule,
} from '@/lib/admin/operations';
import {
  getAdminOperationalSnapshot,
  AdminReadError,
} from '@/lib/admin/server-data';
vi.mock('@/components/layout/AdminShell', () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock('@/lib/admin/operations', async (original) => ({
  ...(await original<typeof import('@/lib/admin/operations')>()),
  getAdminCatalogSnapshot: vi.fn(),
}));
vi.mock('@/lib/admin/server-data', async (original) => ({
  ...(await original<typeof import('@/lib/admin/server-data')>()),
  getAdminOperationalSnapshot: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(getAdminCatalogSnapshot).mockReset();
  vi.mocked(getAdminOperationalSnapshot).mockReset();
});
describe('EX08 F1 section truth', () => {
  it('shows the backend legal status and publication timestamp', () => {
    render(
      <LegalScreen
        moduleKey="contenido-legal"
        adminModule={getAdminModule('contenido-legal')}
        snapshot={{} as never}
        operations={{
          legal: {
            data: [
              {
                id: 'version-1',
                title: 'Privacidad',
                status: 'published',
                publishedAt: '2026-10-09T10:00:00Z',
                updatedAt: '2026-10-09T10:00:00Z',
              },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText('published')).toBeInTheDocument();
    expect(screen.getAllByText(/9\/10\/2026/)).toHaveLength(2);
    expect(screen.queryByText('draft')).not.toBeInTheDocument();
    expect(screen.queryByText('No')).not.toBeInTheDocument();
  });
  it('loads legal alone without a public catalog or unrelated snapshot summary', async () => {
    vi.mocked(getAdminOperationalSnapshot).mockResolvedValue({
      legal: { data: [] },
      errors: {},
    } as never);
    render(await AdminSectionPage({ moduleKey: 'contenido-legal' }));
    expect(getAdminOperationalSnapshot).toHaveBeenCalledWith(['legal']);
    expect(getAdminCatalogSnapshot).not.toHaveBeenCalled();
    expect(screen.queryByText('Snapshot real')).not.toBeInTheDocument();
  });
  it('shows denied access instead of a legal empty table', async () => {
    vi.mocked(getAdminOperationalSnapshot).mockRejectedValue(
      new AdminReadError({
        ok: false,
        kind: 'forbidden',
        status: 403,
        data: null,
        error: 'No tiene permiso para leer este módulo.',
      }),
    );
    render(await AdminSectionPage({ moduleKey: 'contenido-legal' }));
    expect(screen.getByRole('alert')).toHaveTextContent('No tiene permiso');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('EX08 F1 query forwarding from real page wrapper', () => {
  it('forwards page/search/filter params to only the guarded orders read', async () => {
    vi.mocked(getAdminOperationalSnapshot).mockResolvedValue({
      orders: { data: [], meta: { page: 2, limit: 20, total: 21 } },
      errors: {},
    } as never);
    render(
      await AdminOrdersPage({
        searchParams: Promise.resolve({
          page: '2',
          search: 'SKU+1',
          status: 'paid',
          ignored: 'discard',
        }),
      }),
    );
    expect(getAdminOperationalSnapshot).toHaveBeenCalledWith(['orders'], {
      page: '2',
      search: 'SKU+1',
      status: 'paid',
    });
    expect(screen.getByRole('link', { name: 'Anterior' })).toHaveAttribute(
      'href',
      '/admin/pedidos?page=1&search=SKU%2B1&status=paid',
    );
    expect(
      screen.queryByRole('link', { name: 'Siguiente' }),
    ).not.toBeInTheDocument();
  });
});

describe('EX08 F1 failed readiness', () => {
  it('does not show a declarative READY badge when orders were denied', async () => {
    vi.mocked(getAdminOperationalSnapshot).mockRejectedValue(
      new AdminReadError({
        ok: false,
        kind: 'forbidden',
        status: 403,
        data: null,
        error: 'No tiene permiso para leer este módulo.',
      }),
    );
    render(await AdminSectionPage({ moduleKey: 'pedidos' }));
    expect(screen.getByRole('alert')).toHaveTextContent('No tiene permiso');
    expect(screen.queryByText('READY')).not.toBeInTheDocument();
  });
});

describe('EX08 F1 protected inventory history request-time rendering', () => {
  it('explicitly opts out of build-time prerendering for the authenticated history read', () => {
    expect(inventoryHistoryPage).toHaveProperty('dynamic', 'force-dynamic');
  });

  it('selects only the history read and renders its returned ledger', async () => {
    vi.mocked(getAdminOperationalSnapshot).mockResolvedValue({
      inventoryHistory: {
        data: [
          { id: 'movement-fixture', sku: 'SKU-HISTORY', quantityDelta: 3 },
        ],
      },
    } as never);
    render(await inventoryHistoryPage.default());
    expect(getAdminOperationalSnapshot).toHaveBeenCalledWith([
      'inventoryHistory',
    ]);
    expect(getAdminCatalogSnapshot).not.toHaveBeenCalled();
    expect(screen.getByText('SKU-HISTORY')).toBeInTheDocument();
  });

  it.each([
    { kind: 'auth_required', status: 401 },
    { kind: 'forbidden', status: 403 },
    { kind: 'network_error', status: 502 },
  ] as const)(
    'renders $kind as a typed failure without an invented empty ledger',
    async ({ kind, status }) => {
      vi.mocked(getAdminOperationalSnapshot).mockRejectedValue(
        new AdminReadError({
          ok: false,
          kind,
          status,
          data: null,
          error: 'fixture history read failure',
        }),
      );
      render(await inventoryHistoryPage.default());
      expect(screen.getByRole('alert')).toHaveAttribute('data-state', kind);
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
      expect(screen.queryByText('0 movimientos')).not.toBeInTheDocument();
    },
  );
});
