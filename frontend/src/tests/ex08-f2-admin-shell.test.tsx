import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AdminShell } from '@/components/layout/AdminShell';
const route = vi.hoisted(() => ({ pathname: '/admin/pedidos', push: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => route.pathname, useRouter: () => ({ push: route.push, replace: vi.fn(), refresh: vi.fn() }) }));
const session = { user: { id: 'fixture-operator', email: 'operator@example.test', role: 'OPERATIONS', permissions: ['orders.read'] } };
let fetchFixture: ReturnType<typeof vi.fn>;
beforeEach(() => {
  route.pathname = '/admin/pedidos';
  fetchFixture = vi.fn().mockResolvedValue(new Response(JSON.stringify(session), { status: 200 }));
  vi.stubGlobal('fetch', fetchFixture);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
function shell() { return render(<AdminShell><p>Datos operativos protegidos</p></AdminShell>); }

describe('EX08 F2 shell integration — HTTP fixtures, no backend certification', () => {
  it('keeps module links and content closed while identity is unverified', () => {
    fetchFixture.mockImplementation(() => new Promise(() => {}));
    shell();
    expect(screen.getByRole('status')).toHaveTextContent(/verificando/i);
    expect(screen.queryByRole('link', { name: /pedidos/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Datos operativos protegidos')).not.toBeInTheDocument();
  });
  it('renders only effective read destinations and the current page after verified response', async () => {
    shell();
    const link = await screen.findByRole('link', { name: /pedidos/i });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByRole('link', { name: /productos/i })).not.toBeInTheDocument();
    expect(screen.getByText('operator@example.test')).toBeInTheDocument();
    expect(screen.getByText('OPERATIONS')).toBeInTheDocument();
    expect(screen.getByText('Datos operativos protegidos')).toBeInTheDocument();
    expect(screen.getByText('Sesión verificada')).toBeInTheDocument();
    expect(screen.queryByText('READY')).not.toBeInTheDocument();
    expect(screen.queryByText('Local')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '30 días' })).not.toBeInTheDocument();
  });
  it('does not use a write permission to grant a read destination', async () => {
    route.pathname = '/admin/productos';
    fetchFixture.mockResolvedValue(new Response(JSON.stringify({ user: { ...session.user, permissions: ['products.write'] } }), { status: 200 }));
    shell();
    await screen.findByText('operator@example.test');
    expect(screen.queryByRole('link', { name: /productos/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Datos operativos protegidos')).not.toBeInTheDocument();
  });
  it('lets a read-only catalog operator find their module without inventing write authority', async () => {
    route.pathname = '/admin/productos';
    fetchFixture.mockResolvedValue(new Response(JSON.stringify({ user: { ...session.user, permissions: ['catalog.read'] } }), { status: 200 }));
    shell();
    expect(await screen.findByRole('link', { name: /productos/i })).toHaveAttribute('href', '/admin/productos');
    expect(screen.getByText('Datos operativos protegidos')).toBeInTheDocument();
  });
  it('presents empty effective permissions explicitly rather than a fictitious dashboard', async () => {
    fetchFixture.mockResolvedValue(new Response(JSON.stringify({ user: { ...session.user, permissions: [] } }), { status: 200 }));
    shell();
    expect(await screen.findByText('Sin módulos disponibles')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Datos operativos protegidos')).not.toBeInTheDocument();
  });
  it.each([[401, /sesión finalizada/i], [403, /acceso denegado/i], [500, /no fue posible verificar/i]])('does not expose navigation or content on HTTP %i', async (status, message) => {
    fetchFixture.mockResolvedValue(new Response('{}', { status }));
    shell();
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByRole('link', { name: /pedidos/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Datos operativos protegidos')).not.toBeInTheDocument();
  });
  it('offers a mobile navigation dialog with authorized links and restores its trigger', async () => {
    shell();
    await screen.findByRole('link', { name: /pedidos/i });
    const trigger = screen.getByRole('button', { name: 'Abrir menú administrativo' });
    trigger.focus(); fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Menú administrativo' });
    expect(within(dialog).getByRole('link', { name: /pedidos/i })).toHaveAttribute('aria-current', 'page');
    expect(within(dialog).queryByRole('link', { name: /productos/i })).not.toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(trigger).toHaveFocus();
  });
  it.each([
    ['/admin', 'dashboard.read', 'Dashboard', '/admin/dashboard'],
    ['/admin/contenido/legal', 'legal.read', 'Legal', '/admin/legal'],
    ['/admin/contenido/footer', 'footer.read', 'Footer', '/admin/footer'],
  ])('resolves existing alias %s to the verified permission and active canonical destination', async (pathname, permission, title, href) => {
    route.pathname = pathname;
    fetchFixture.mockResolvedValue(new Response(JSON.stringify({ user: { ...session.user, permissions: [permission] } }), { status: 200 }));
    shell();
    expect(await screen.findByText('Datos operativos protegidos')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title);
    const link = screen.getByRole('link', { name: new RegExp(title, 'i') });
    expect(link).toHaveAttribute('href', href);
    expect(link).toHaveAttribute('aria-current', 'page');
  });
  it('clears cached identity, links and content after a local-only logout401, then requests fresh session authority', async () => {
    fetchFixture.mockReset().mockResolvedValueOnce(new Response(JSON.stringify(session), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: false, revocationConfirmed: false, localSessionCleared: true, kind: 'auth_required' }), { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 401 }));
    shell();
    await screen.findByText('Datos operativos protegidos');
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/sesión finalizada/i);
    expect(screen.queryByText('operator@example.test')).not.toBeInTheDocument();
    expect(screen.queryByText('Datos operativos protegidos')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /pedidos/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/admin/login');
  });
  it('keeps an unknown route contextual without selecting an arbitrary dashboard', async () => {
    route.pathname = '/admin/unknown-fixture';
    shell();
    await screen.findByText('operator@example.test');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Administración');
    expect(screen.getByRole('link', { name: /pedidos/i })).not.toHaveAttribute('aria-current');
  });
  it('revalidates authority after a route change instead of displaying stale protected content', async () => {
    const view = shell();
    await screen.findByText('Datos operativos protegidos');
    fetchFixture.mockImplementation(() => new Promise(() => {}));
    route.pathname = '/admin/clientes';
    view.rerender(<AdminShell><p>Contenido clientes</p></AdminShell>);
    await waitFor(() => expect(screen.queryByText('Contenido clientes')).not.toBeInTheDocument());
  });
});
