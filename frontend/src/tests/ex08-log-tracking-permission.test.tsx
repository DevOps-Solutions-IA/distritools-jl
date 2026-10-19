import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { AdminShell } from '@/components/layout/AdminShell';

const route = vi.hoisted(() => ({ pathname: '/admin/rastreo' }));
vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
const operator = { id: 'tracking-operator', email: 'tracking@example.test', role: 'TRACKING' };
let sessionFetch: ReturnType<typeof vi.fn>;
beforeEach(() => {
  route.pathname = '/admin/rastreo';
  sessionFetch = vi.fn();
  vi.stubGlobal('fetch', sessionFetch);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function shell(permissions: string[]) {
  sessionFetch.mockResolvedValue(new Response(JSON.stringify({ user: { ...operator, permissions } }), { status: 200 }));
  render(<AdminShell><p>Eventos seguros del envío</p></AdminShell>);
}

describe('Tracking route entry follows existing tracking.read authority', () => {
  it('admits a tracking-only operator without granting shipment-list access', async () => {
    shell(['tracking.read']);
    expect(await screen.findByText('Eventos seguros del envío')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rastreo' })).toHaveAttribute('href', '/admin/rastreo');
    expect(screen.queryByRole('link', { name: 'Envíos' })).not.toBeInTheDocument();
  });
  it('does not substitute shipping.read for tracking.read on the tracking route', async () => {
    shell(['shipping.read']);
    await screen.findByText('Sesión verificada');
    expect(screen.queryByText('Eventos seguros del envío')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Rastreo' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Envíos' })).toHaveAttribute('href', '/admin/envios');
  });
  it('preserves both destinations for an operator holding both read authorities', async () => {
    shell(['tracking.read', 'shipping.read']);
    expect(await screen.findByText('Eventos seguros del envío')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rastreo' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Envíos' })).toBeInTheDocument();
  });
  it('keeps the shipments page closed to tracking-only authority', async () => {
    route.pathname = '/admin/envios';
    shell(['tracking.read']);
    await screen.findByText('Sesión verificada');
    expect(screen.queryByText('Eventos seguros del envío')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Envíos' })).not.toBeInTheDocument();
  });
  it('does not show tracking navigation or protected content after a rejected session', async () => {
    sessionFetch.mockResolvedValue(new Response('{}', { status: 401 }));
    render(<AdminShell><p>Eventos seguros del envío</p></AdminShell>);
    expect(await screen.findByRole('alert')).toHaveTextContent(/sesión finalizada/i);
    expect(screen.queryByRole('link', { name: 'Rastreo' })).not.toBeInTheDocument();
    expect(screen.queryByText('Eventos seguros del envío')).not.toBeInTheDocument();
  });
});
