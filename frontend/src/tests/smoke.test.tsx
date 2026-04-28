import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';
import { CartProvider } from '@/features/cart/context';
import AdminPage from '@/app/admin/page';
import { DistriToolsLogo } from '@/components/brand/DistriToolsLogo';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { Button } from '@/components/ui/Button';

describe('smoke frontend base', () => {
  it('DistriToolsLogo renderiza asset real con alt correcto', () => {
    render(<DistriToolsLogo tone="light" />);
    expect(screen.getByAltText('DistriTools JL')).toHaveAttribute(
      'src',
      '/brand/distritools-logo-horizontal-clean.svg',
    );
  });

  it('renderiza la marca DistriTools JL en la landing', () => {
    render(<HomePage />);
    expect(screen.getAllByAltText('DistriTools JL').length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByAltText('Brand board oficial de DistriTools JL'),
    ).toBeInTheDocument();
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

  it('renderiza el shell admin', () => {
    render(<AdminPage />);
    expect(screen.getByText(/ventas del día/i)).toBeInTheDocument();
  });

  it('renderiza button y respeta disabled', () => {
    render(
      <Button disabled variant="secondary">
        Acción
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Acción' })).toBeDisabled();
  });
});
