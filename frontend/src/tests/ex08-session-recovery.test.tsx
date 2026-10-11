import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRouterContext, type AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';
import type { NextRouter } from 'next/router';
import { AdminSessionFeedback } from '@/features/admin/shell/AdminSessionFeedback';
import { AdminSessionExit } from '@/features/admin/shell/AdminSessionExit';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn(), bfcacheId: 'test-only-current-segment' }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const fetcher = vi.fn();
beforeEach(() => { vi.stubGlobal('fetch', fetcher); fetcher.mockReset(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

// Observe whether the component intercepts the native navigation, then suppress
// only jsdom's unsupported document navigation after React has handled the event.
function expectDocumentNavigation(link: HTMLElement) {
  let intercepted: boolean | undefined;
  document.addEventListener('click', (event) => {
    intercepted = event.defaultPrevented;
    event.preventDefault();
  }, { once: true });
  fireEvent.click(link);
  expect(intercepted).toBe(false);
  expect(link).toHaveAttribute('href', '/admin/login');
}
function wrapper({ children }: { children: React.ReactNode }) {
  // Outside a Next build, next/link resolves its Pages Router entrypoint.
  // Supply both real contexts so its native-click interception is exercised.
  return <RouterContext.Provider value={{ ...router, pathname: '/admin', asPath: '/admin', route: '/admin', query: {}, basePath: '' } as unknown as NextRouter}><AppRouterContext.Provider value={router as AppRouterInstance}>{children}</AppRouterContext.Provider></RouterContext.Provider>;
}

describe('Expired-session recovery document navigation', () => {
  it('uses a fresh document request for the real feedback login action', () => {
    render(<AdminSessionFeedback status="auth_required" onRetry={vi.fn()} />, { wrapper });
    expectDocumentNavigation(screen.getByRole('link', { name: 'Iniciar sesión' }));
  });
  it('uses a fresh document request after an explicitly local-only logout401', async () => {
    const expired = vi.fn();
    fetcher.mockResolvedValue(new Response(JSON.stringify({ success: false, revocationConfirmed: false, localSessionCleared: true, kind: 'auth_required' }), { status: 401 }));
    render(<AdminSessionExit onSessionExpired={expired} />, { wrapper });
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expectDocumentNavigation(await screen.findByRole('link', { name: 'Iniciar sesión' }));
    expect(expired).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });
  it.each(['forbidden', 'network_error', 'server_error', 'invalid_response'] as const)('preserves %s retry without an unsolicited login action', (status) => {
    const retry = vi.fn();
    render(<AdminSessionFeedback status={status} onRetry={retry} />);
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledOnce();
  });
  it('keeps loading free of login or retry actions', () => {
    render(<AdminSessionFeedback status="loading" onRetry={vi.fn()} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it.each([
    [401, {}], [403, {}], [500, {}], [200, { success: true, revocationConfirmed: true }],
    [201, { success: true, revocationConfirmed: false }],
  ])('keeps unconfirmed logout %i fail-closed', async (status, body) => {
    fetcher.mockResolvedValue(new Response(JSON.stringify(body), { status }));
    render(<AdminSessionExit />);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('link', { name: 'Iniciar sesión' })).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
  it('preserves the existing confirmed backend-revocation redirect and refresh', async () => {
    fetcher.mockResolvedValue(new Response(JSON.stringify({ success: true, revocationConfirmed: true }), { status: 201 }));
    render(<AdminSessionExit />);
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/admin/login'));
    expect(router.refresh).toHaveBeenCalledOnce();
  });
});
