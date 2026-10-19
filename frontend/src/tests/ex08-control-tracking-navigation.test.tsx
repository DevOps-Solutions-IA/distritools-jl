import { render, screen, waitFor } from '@testing-library/react';
import { ControlLink, ControlNavigation } from '@/features/admin/control/Navigation';

const fetchSession = vi.fn();
function session(permissions: string[], role = 'OPERATOR') {
  return new Response(JSON.stringify({ user: { id: 'control-nav-user', email: 'operator@example.test', role, permissions } }), { status: 200 });
}
function view(href = '/admin/rastreo', context = 'tracking-navigation') {
  return <ControlNavigation context={context}><ControlLink href={href}>Destino operativo</ControlLink></ControlNavigation>;
}
beforeEach(() => { fetchSession.mockReset(); vi.stubGlobal('fetch', fetchSession); });
afterEach(() => vi.unstubAllGlobals());

it('habilita Rastreo con tracking.read confirmado por la sesión actual', async () => {
  fetchSession.mockResolvedValue(session(['tracking.read']));
  render(view('/admin/rastreo?search=ORD-1'));
  expect(await screen.findByRole('link', { name: 'Destino operativo' })).toHaveAttribute('href', '/admin/rastreo?search=ORD-1');
});
it('shipping.read solo no concede autoridad de rastreo', async () => {
  fetchSession.mockResolvedValue(session(['shipping.read'])); render(view());
  expect(await screen.findByText('Requiere tracking.read')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('el nombre SUPER_ADMIN no sustituye el permiso efectivo', async () => {
  fetchSession.mockResolvedValue(session([], 'SUPER_ADMIN')); render(view());
  expect(await screen.findByText('Requiere tracking.read')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('concesión y revocación actuales cambian el enlace para el mismo usuario', async () => {
  fetchSession.mockResolvedValueOnce(session([])).mockResolvedValueOnce(session(['tracking.read'])).mockResolvedValueOnce(session([]));
  const page = render(view('/admin/rastreo', 'before-grant'));
  expect(await screen.findByText('Requiere tracking.read')).toBeInTheDocument();
  page.rerender(view('/admin/rastreo', 'after-grant'));
  expect(await screen.findByRole('link', { name: 'Destino operativo' })).toHaveAttribute('href', '/admin/rastreo');
  page.rerender(view('/admin/rastreo', 'after-revoke'));
  expect(await screen.findByText('Requiere tracking.read')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('una ruta desconocida queda deshabilitada con un motivo concreto', async () => {
  fetchSession.mockResolvedValue(session(['shipping.read', 'reports.read'])); render(view('/admin/no-existe'));
  expect(await screen.findByText('Destino de navegación no reconocido.')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
  expect(screen.queryByText('Requiere')).not.toBeInTheDocument();
});
it('la carga de sesión no habilita un destino conocido', () => {
  fetchSession.mockReturnValue(new Promise<Response>(() => {})); render(view());
  expect(screen.getByText('Verificando permisos…')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it.each([401, 403, 500])('sesión HTTP %s mantiene navegación cerrada', async status => {
  fetchSession.mockResolvedValue(new Response('{}', { status })); render(view());
  expect(await screen.findByText('Permisos de navegación no disponibles.')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('una sesión malformada no habilita Rastreo', async () => {
  fetchSession.mockResolvedValue(new Response(JSON.stringify({ user: { permissions: ['shipping.read'] } }), { status: 200 })); render(view());
  expect(await screen.findByText('Permisos de navegación no disponibles.')).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});
it('los otros destinos conservan sus permisos anteriores', async () => {
  const entries: Array<[string, string[]]> = [
    ['/admin/productos/nuevo', ['catalog.read', 'products.write']], ['/admin/productos', ['catalog.read', 'products.read']],
    ['/admin/reportes', ['reports.read']], ['/admin/dashboard', ['dashboard.read']], ['/admin/inventario', ['inventory.read']],
    ['/admin/pedidos', ['orders.read']], ['/admin/envios', ['shipping.read']], ['/admin/pagos', ['payments.read']],
    ['/admin/auditoria', ['audit.read']], ['/admin/configuracion', ['settings.read']], ['/admin/notificaciones', ['notifications.read']], ['/admin/roles', ['permissions.read']],
  ];
  for (const [href, permissions] of entries) {
    fetchSession.mockResolvedValueOnce(session(permissions));
    const page = render(view(href, href));
    expect(await screen.findByRole('link', { name: 'Destino operativo' })).toHaveAttribute('href', href);
    page.unmount();
    fetchSession.mockResolvedValueOnce(session([]));
    const denied = render(view(href, `${href}-denied`));
    expect(await screen.findByText(`Requiere ${permissions.join(', ')}`)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    denied.unmount();
  }
  await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
});
