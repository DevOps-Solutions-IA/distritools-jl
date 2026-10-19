import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CartProvider } from '@/features/cart/context';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { DistriToolsLogo } from '@/components/brand/DistriToolsLogo';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { Button } from '@/components/ui/Button';
import { storefrontContactConfig } from '@/config/storefront-contact';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('smoke frontend base', () => {
  it('DistriToolsLogo renderiza asset real con alt correcto', () => {
    render(<DistriToolsLogo tone="light" />);
    expect(screen.getByAltText('DistriTools JL')).toHaveAttribute(
      'src',
      '/brand/distritools-logo-horizontal-clean.svg',
    );
  });

  it('renderiza el shell storefront', () => {
    render(
      <CartProvider>
        <StorefrontShell>
          <div>Sección comercial</div>
        </StorefrontShell>
      </CartProvider>,
    );
    expect(
      screen.getAllByText(/herramientas que construyen resultados/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByAltText('DistriTools JL').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
  });

  it('menú móvil abre desde navegación pública y cierra con Escape', async () => {
    render(
      <CartProvider>
        <StorefrontShell>
          <div>Sección comercial</div>
        </StorefrontShell>
      </CartProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /abrir menú principal/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /abrir menú principal/i }));
    expect(screen.getByRole('dialog', { name: /menú principal/i })).toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Productos' }).some((link) =>
        link.getAttribute('href') === '/productos',
      ),
    ).toBe(true);
    expect(screen.getByRole('link', { name: 'Carrito' })).toHaveAttribute('href', '/carrito');
    expect(screen.getAllByText('Líneas de producto')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /^Legal$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Asesoría$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rastrear pedido/i })).toHaveAttribute(
      'href',
      '/rastreo-de-pedido',
    );
    expect(screen.getAllByRole('search').length).toBeGreaterThanOrEqual(1);

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /menú principal/i })).not.toBeInTheDocument();
    });
  });

  it('renderiza el dashboard admin sin métricas inventadas', async () => {
    render(await AdminDashboard());
    expect(screen.getByText(/centro operativo/i)).toBeInTheDocument();
    expect(screen.getByText(/ventas del periodo/i)).toBeInTheDocument();
    expect(screen.getByText(/alertas críticas/i)).toBeInTheDocument();
    expect(screen.getAllByText(/readiness/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renderiza button y respeta disabled', () => {
    render(
      <Button disabled variant="secondary">
        Acción
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Acción' })).toBeDisabled();
  });

  it('contacto renderiza página profesional y valida formulario', async () => {
    const ContactPage = (await import('@/app/contacto/page')).default;
    render(
      <CartProvider>
        <ContactPage />
      </CartProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Contacto' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /abrir menú principal/i })).toBeInTheDocument();
    expect(screen.getByText(/atención profesional/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(storefrontContactConfig.email, 'i'))).toBeInTheDocument();
    expect(screen.getByText(new RegExp(storefrontContactConfig.base, 'i'))).toBeInTheDocument();
    expect(screen.getByText(storefrontContactConfig.whatsappDisplay)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /comprar/i })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /pedido/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: /enviar solicitud/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /enviar solicitud/i }));
    await waitFor(() => {
      expect(screen.getByText(/completa los campos requeridos/i)).toBeInTheDocument();
    });
  });

  it('página legal renderiza header global, footer e índice', async () => {
    const PrivacyPage = (await import('@/app/politica-de-privacidad/page')).default;
    const originalFetch = globalThis.fetch;
    const publicLegalRead = vi.spyOn(globalThis, 'fetch').mockImplementation((input, options) =>
      String(input).endsWith('/api/v1/content/legal/politica-de-privacidad')
        ? Promise.resolve(new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } }))
        : originalFetch(input, options),
    );
    let legalPage;
    try { legalPage = await PrivacyPage(); } finally { publicLegalRead.mockRestore(); }
    render(
      <CartProvider>
        {legalPage}
      </CartProvider>,
    );

    expect(screen.getByRole('button', { name: /abrir menú principal/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /índice del documento/i })).toBeInTheDocument();
    expect(screen.getByText(/contacto y soporte/i)).toBeInTheDocument();
    expect(screen.getByText(/documento pendiente de revisión jurídica final|revisión profesional/i)).toBeInTheDocument();
    expect(screen.getAllByText(/herramientas que construyen resultados/i).length).toBeGreaterThanOrEqual(1);
  });

  it('botón flotante de WhatsApp usa configuración central y es accesible', () => {
    render(
      <CartProvider>
        <StorefrontShell>
          <div>Tienda</div>
        </StorefrontShell>
      </CartProvider>,
    );

    expect(screen.getByLabelText(/escribir por whatsapp/i)).toHaveAttribute(
      'href',
      expect.stringContaining('573000000000'),
    );
    expect(screen.getByLabelText(/escribir por whatsapp/i)).toHaveClass(
      'bg-[var(--color-industrial-yellow)]',
    );
    expect(screen.getByLabelText(/escribir por whatsapp/i).querySelector('svg')).toBeInTheDocument();
    expect(screen.queryByText(/^WA$/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/escribir por whatsapp/i).innerHTML).toContain('whatsappPulse');
  });
});
