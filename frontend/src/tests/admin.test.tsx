import { render, screen } from '@testing-library/react';
import AdminLoginPage from '@/app/admin/login/page';
import AdminNewProductPage from '@/app/admin/productos/nuevo/page';
import AdminProductsPage from '@/app/admin/productos/page';
import AdminSettingsPage from '@/app/admin/configuracion/page';
import AdminShipmentsPage from '@/app/admin/envios/page';
import { AdminShell } from '@/components/layout/AdminShell';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/productos',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next/image', () => ({
  default: ({
    alt,
    src,
    priority: _priority,
    unoptimized: _unoptimized,
    ...props
  }: {
    alt: string;
    src: string;
    priority?: boolean;
    unoptimized?: boolean;
  }) => {
    // next/image is mocked as a plain element in tests.
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} src={src} {...props} />;
  },
}));

vi.mock('@/lib/admin/operations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/admin/operations')>();
  return {
    ...actual,
    getAdminCatalogSnapshot: vi.fn().mockResolvedValue({
      available: true,
      brands: 1,
      categories: 1,
      products: 1,
      variants: 1,
      productsWithoutPrice: 0,
      productsWithoutSku: 0,
      productsWithoutImage: 1,
      quoteOnlyProducts: 0,
      brandRows: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'TOTAL',
          slug: 'total',
          description: null,
          metadata: null,
        },
      ],
      categoryRows: [
        {
          id: '22222222-2222-4222-8222-222222222222',
          parentId: null,
          name: 'Perforación',
          slug: 'perforacion',
          description: null,
          sortOrder: 1,
        },
      ],
      productRows: [
        {
          id: '33333333-3333-4333-8333-333333333333',
          name: 'Taladro percutor TOTAL',
          slug: 'taladro-percutor-total',
          description: 'Herramienta de perforación.',
          longDescription: null,
          presentation: '1/2 pulg',
          brand: {
            id: '11111111-1111-4111-8111-111111111111',
            name: 'TOTAL',
            slug: 'total',
            description: null,
            metadata: null,
          },
          category: {
            id: '22222222-2222-4222-8222-222222222222',
            parentId: null,
            name: 'Perforación',
            slug: 'perforacion',
            description: null,
            sortOrder: 1,
          },
          primaryVariantId: '44444444-4444-4444-8444-444444444444',
          primarySku: 'TOTAL-001',
          primaryPrice: 259900,
          primaryPriceLabel: '$ 259.900',
          availability: {
            status: 'in-stock',
            label: 'Disponible',
            description: 'Disponible.',
            source: 'search',
          },
          image: {
            status: 'pending',
            assetPath: null,
            notes: null,
          },
          attributes: [],
          tags: [],
          seo: {
            title: null,
            description: null,
            keywords: [],
            ogTitle: null,
            ogDescription: null,
            ogImage: null,
          },
          source: {
            name: null,
            url: null,
            retrievedAt: null,
            confidence: null,
          },
        },
      ],
      variantRows: [
        {
          id: '44444444-4444-4444-8444-444444444444',
          productId: '33333333-3333-4333-8333-333333333333',
          sku: 'TOTAL-001',
          name: 'Taladro percutor TOTAL',
          price: '259900.00',
          taxRate: '19.00',
          product: {
            id: '33333333-3333-4333-8333-333333333333',
            name: 'Taladro percutor TOTAL',
            slug: 'taladro-percutor-total',
            isActive: true,
            brand: null,
            category: null,
          },
        },
      ],
    }),
  };
});

vi.mock('@/lib/admin/server-data', () => ({
  getAdminOperationalSnapshot: vi.fn().mockResolvedValue({
    orders: { data: [], meta: { page: 1, limit: 20, total: 0 } },
    quotes: {
      data: [],
      meta: { page: 1, limit: 20, total: 0 },
      operationalState: {
        status: 'not_configured',
        message: 'Sin workflow persistente.',
      },
    },
    payments: { data: [], meta: { page: 1, limit: 20, total: 0 } },
    shipments: {
      data: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          orderId: '66666666-6666-4666-8666-666666666666',
          orderNumber: 'DTJL-20260513-871538',
          provider: 'mock_99envios',
          providerMode: 'mock_local',
          guideSource: 'mock_99envios',
          guideNotice: 'Guía simulada local/test. No existe en panel real 99 Envíos.',
          productionState: 'mock_local',
          autoShippingStatus: 'guide_created',
          selectedCarrierReason: 'Más económica disponible: tcc (11400 COP comparables).',
          labelStatus: 'generated',
          status: 'guide_generated',
          trackingNumber: 'MOCK99-FA1E4626',
          routeNumber: 'RUTA-MOCK-FA1E4626',
          quotedAmount: '12400.00',
          customer: { fullName: 'Cliente Prueba', email: 'cl***@example.com', phone: '300***99' },
          events: [],
          createdAt: '2026-05-13T00:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 0 },
      operationalState: {
        status: 'provider_not_configured',
        message: 'Sin transportadora configurada.',
      },
    },
    customers: { data: [], meta: { page: 1, limit: 20, total: 0 } },
    users: { data: [] },
    roles: { data: [] },
    audit: { data: [] },
    notifications: { data: [] },
    shippingCapabilities: {
      provider: 'mock_99envios',
      mode: 'mock',
      ready: true,
      supportsCashOnDelivery: true,
      providerConfig: {
        status: 'mock_local',
        productionBlocked: false,
      },
    },
    inventoryHistory: { data: [] },
    priceHistory: { data: [] },
    legal: { data: [] },
    footer: {},
    settings: {
      payments: { pseProvider: 'none' },
      shipping: { provider: 'mock_99envios' },
      notifications: { emailProvider: 'mock-email' },
      productionReadiness: {
        status: 'BLOCKED_FOR_PRODUCTION',
        mode: 'mock_local',
        checks: [
          {
            key: 'admin_auth_enabled',
            label: 'ADMIN_AUTH_DISABLED=false',
            status: 'fail',
            message: 'Login admin desactivado; bloquea producción.',
          },
          {
            key: 'no_mock_shipping',
            label: 'Mock 99 Envíos desactivado en producción',
            status: 'fail',
            message: 'mock_99envios no puede operar como producción.',
          },
        ],
      },
    },
    errors: {},
  }),
  getAdminDashboardData: vi.fn().mockResolvedValue({
    range: {
      key: '30d',
      label: 'Últimos 30 días',
      from: '2026-04-14T00:00:00.000Z',
      to: '2026-05-14T00:00:00.000Z',
    },
    refreshedAt: '2026-05-14T12:00:00.000Z',
    readiness: {
      globalStatus: 'BLOCKED_PROVIDER',
      counts: { READY: 4, GO_WITH_RISKS: 2, BLOCKED_PROVIDER: 3, BLOCKED_CONFIGURATION: 1 },
      modules: [
        { key: 'dashboard', label: 'Dashboard', status: 'READY', blockers: [], href: '/admin/dashboard' },
        { key: 'payments', label: 'Pagos', status: 'BLOCKED_PROVIDER', blockers: ['Falta proveedor real de pagos/PSE.'], href: '/admin/pagos' },
        { key: 'shipping', label: 'Envíos', status: 'MOCK_ONLY', blockers: ['Faltan credenciales reales/sandbox de 99 Envíos.'], href: '/admin/envios' },
      ],
      blockedModules: [
        { key: 'payments', label: 'Pagos', status: 'BLOCKED_PROVIDER', blockers: ['Falta proveedor real de pagos/PSE.'], href: '/admin/pagos' },
      ],
    },
    kpis: {
      sales: {
        totalSalesAmount: '259900.00',
        orderCount: 1,
        averageOrderValue: '259900.00',
        ordersToday: 1,
        pendingOrders: 1,
        confirmedOrders: 0,
        cancelledOrders: 0,
        ordersWithoutGuide: 1,
        ordersWithAlerts: 1,
      },
      payments: {
        pendingPayments: 1,
        paidPayments: 0,
        failedPayments: 0,
        manualReviewPayments: 0,
        codPendingReconciliation: 1,
        paymentProviderStatus: 'BLOCKED_PROVIDER',
      },
      inventory: {
        activeProducts: 1,
        activeVariants: 1,
        sellableProducts: 1,
        incompleteProducts: 0,
        outOfStockProducts: 0,
        lowStockProducts: 0,
        missingCostProducts: 1,
        healthyStockProducts: 1,
        inventoryReadiness: 'READY',
      },
      shipping: {
        shipmentsCreated: 1,
        shipmentsPendingGuide: 1,
        autoShippingFailed: 0,
        shippingProviderStatus: 'MOCK_ONLY',
        mockGuidesCount: 1,
        realGuidesCount: 0,
        trackingPublicStatus: 'GO_WITH_RISKS',
      },
      customers: {
        totalCustomers: 1,
        customersWithOrders: 1,
        newCustomersInPeriod: 1,
      },
      notifications: {
        queuedNotifications: 0,
        sentNotifications: 0,
        failedNotifications: 0,
        pendingProviderNotifications: 0,
      },
      system: {
        globalReadinessStatus: 'BLOCKED_PROVIDER',
        blockedModulesCount: 3,
        partialModulesCount: 2,
        readyModulesCount: 4,
        productionBlockersCount: 3,
        lastAuditEventsCount: 1,
      },
    },
    charts: {
      salesByDay: [{ date: '2026-05-14', amount: 259900, orders: 1 }],
      ordersByStatus: [{ label: 'pending_payment', value: 1 }],
      paymentsByStatus: [{ label: 'pending', value: 1 }],
      inventoryByStatus: [{ label: 'Saludable', value: 1, status: 'ready' }],
      readinessByStatus: [{ label: 'READY', value: 4 }],
    },
    alerts: [
      {
        severity: 'warning',
        module: 'Envíos',
        message: '1 pedidos sin guía.',
        actionLabel: 'Ver pedidos sin guía',
        href: '/admin/envios',
        status: 'GO_WITH_RISKS',
        createdAt: '2026-05-14T12:00:00.000Z',
      },
    ],
    quickActions: [
      { label: 'Ver pedidos pendientes', href: '/admin/pedidos?status=pending_payment', permission: 'orders.read', status: 'enabled', reason: null },
      { label: 'Registrar pago manual', href: '/admin/pagos?action=manual', permission: 'payments.write', status: 'disabled', reason: 'Pagos reales bloqueados por provider.' },
    ],
    recentActivity: {
      orders: [
        {
          orderNumber: 'DTJL-20260514-000001',
          status: 'pending_payment',
          paymentStatus: 'pending',
          shippingStatus: 'pending_provider',
          total: '259900.00',
          createdAt: '2026-05-14T12:00:00.000Z',
          href: '/admin/pedidos?search=DTJL-20260514-000001',
        },
      ],
      payments: [],
      audit: [{ actor: 'ad***@distritools.local', module: 'orders', action: 'ORDER_CREATED', createdAt: '2026-05-14T12:00:00.000Z', href: '/admin/auditoria?entity=orders' }],
      failedNotifications: [],
    },
    errors: {},
  }),
  adminFetch: vi.fn().mockResolvedValue({ ok: true, status: 200, data: {}, error: null }),
}));

describe('admin platform', () => {
  it('login landing renderiza sin sidebar administrativo', () => {
    render(<AdminLoginPage />);

    expect(screen.getByRole('heading', { name: /panel administrativo/i })).toBeInTheDocument();
    expect(screen.getByAltText(/equipo operativo distritools jl/i)).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /navegación administrativa/i })).not.toBeInTheDocument();
  });

  it('sidebar premium agrupa módulos y muestra estado activo', () => {
    render(
      <AdminShell>
        <div>Contenido admin</div>
      </AdminShell>,
    );

    expect(screen.getAllByText('Control').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Catálogo').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('link', { name: /productos/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('productos admin muestra tabla real y acciones operativas', async () => {
    render(await AdminProductsPage());

    expect(screen.getByText('Taladro percutor TOTAL')).toBeInTheDocument();
    expect(screen.getByText('$ 259.900')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nuevo producto/i })).toHaveAttribute(
      'href',
      '/admin/productos/nuevo',
    );
  });

  it('formulario de nuevo producto usa datos reales de marca y categoría', async () => {
    render(await AdminNewProductPage());

    expect(screen.getByRole('heading', { name: /nuevo producto/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Marca')).toHaveTextContent('TOTAL');
    expect(screen.getByLabelText('Categoría')).toHaveTextContent('Perforación');
  });

  it('envíos admin marca MOCK99 como mock local y no como guía real', async () => {
    render(await AdminShipmentsPage());

    expect(screen.getByText('Mock local/test activo')).toBeInTheDocument();
    expect(screen.getByText('Mock local/test')).toBeInTheDocument();
    expect(screen.getByText('MOCK99-FA1E4626')).toBeInTheDocument();
    expect(screen.getAllByText(/No existe en panel real 99 Envíos/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('Guía creada en 99 Envíos.')).not.toBeInTheDocument();
  });

  it('configuración admin bloquea producción con checklist PASS/FAIL explícito', async () => {
    render(await AdminSettingsPage());

    expect(screen.getByText('Producción — Checklist de salida')).toBeInTheDocument();
    expect(screen.getByText('BLOCKED_FOR_PRODUCTION')).toBeInTheDocument();
    expect(screen.getByText('ADMIN_AUTH_DISABLED=false')).toBeInTheDocument();
    expect(screen.getByText('Mock 99 Envíos desactivado en producción')).toBeInTheDocument();
  });
});
