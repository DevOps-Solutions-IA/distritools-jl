import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AdminSessionExit } from '@/features/admin/shell/AdminSessionExit';
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
let fetchFixture: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchFixture = vi.fn(); vi.stubGlobal('fetch', fetchFixture); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('EX08 F2 logout BFF boundary — component fixtures', () => {
  it('prevents duplicate submissions while the existing cookie-clearing endpoint is pending', () => {
    fetchFixture.mockImplementation(() => new Promise(() => {}));
    render(<AdminSessionExit />);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(screen.getByRole('button', { name: 'Saliendo…' })).toBeDisabled();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it('leaves the current page with an explicit error on HTTP failure instead of claiming logout', async () => {
    fetchFixture.mockResolvedValue(new Response('{}', { status: 503 }));
    render(<AdminSessionExit />);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/no fue posible cerrar/i);
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Salir' })).toBeEnabled();
  });
  it('does not redirect on network failure or malformed success and permits retry', async () => {
    fetchFixture.mockRejectedValueOnce(new TypeError('fixture network error')).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    render(<AdminSessionExit />);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Salir' })).toBeEnabled());
    expect(router.replace).not.toHaveBeenCalled();
  });
  it.each([
    [200, { success: true }],
    [200, { success: true, revocationConfirmed: true }],
    [201, { success: true, revocationConfirmed: false }],
    [403, { success: false, revocationConfirmed: false }],
  ])('never claims revocation or redirects for unconfirmed response %i', async (status, payload) => {
    fetchFixture.mockResolvedValue(new Response(JSON.stringify(payload), { status }));
    render(<AdminSessionExit />);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await screen.findByRole('alert');
    expect(router.replace).not.toHaveBeenCalled();
  });
  it('discards cached authority on confirmed local-only401 and offers login without a success redirect', async () => {
    const expire = vi.fn();
    fetchFixture.mockResolvedValue(new Response(JSON.stringify({ success: false, revocationConfirmed: false, localSessionCleared: true, kind: 'auth_required' }), { status: 401 }));
    render(<AdminSessionExit onSessionExpired={expire} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/sesión finalizó/i);
    expect(expire).toHaveBeenCalledOnce();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/admin/login');
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Salir' })).not.toBeInTheDocument();
  });
  it('redirects only after the exact backend-revocation BFF success', async () => {
    fetchFixture.mockResolvedValue(new Response('{"success":true,"revocationConfirmed":true}', { status: 201 }));
    render(<AdminSessionExit />);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/admin/login'));
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(fetchFixture).toHaveBeenCalledWith('/api/admin/session/logout', expect.objectContaining({ method: 'POST', cache: 'no-store', credentials: 'same-origin' }));
  });
});
