import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAdminSession } from '@/features/admin/shell/useAdminSession';

function Harness({ route = '/admin/pedidos' }: { route?: string }) {
  const { state, retry } = useAdminSession(route);
  return <><output aria-label="Estado">{state.status}</output>{state.status === 'success' ? <p>{state.user.email} · {state.user.role} · {state.user.permissions.join(',')}</p> : null}<button onClick={retry}>Reintentar</button></>;
}
const user = { id: 'operator-fixture', email: 'operator@example.test', role: 'OPERATIONS', permissions: ['orders.read'] };
let fetchFixture: ReturnType<typeof vi.fn>;
beforeEach(() => { fetchFixture = vi.fn(); vi.stubGlobal('fetch', fetchFixture); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('EX08 F2 session response boundary — HTTP fixtures only', () => {
  it('starts loading without exposing identity or effective authority', () => {
    fetchFixture.mockImplementation(() => new Promise(() => {}));
    render(<Harness />);
    expect(screen.getByLabelText('Estado')).toHaveTextContent('loading');
    expect(screen.queryByText(/operator@example/)).not.toBeInTheDocument();
  });
  it('uses only a validated self-context response with same-origin credentials and no-store', async () => {
    fetchFixture.mockResolvedValue(new Response(JSON.stringify({ user }), { status: 200 }));
    render(<Harness />);
    expect(await screen.findByText(/operator@example.test/)).toHaveTextContent('OPERATIONS · orders.read');
    expect(fetchFixture).toHaveBeenCalledWith('/api/admin/session', expect.objectContaining({ method: 'GET', cache: 'no-store', credentials: 'same-origin', signal: expect.any(AbortSignal) }));
  });
  it.each([[401, 'auth_required'], [403, 'forbidden'], [500, 'server_error']])('distinguishes HTTP %i without treating it as an empty successful session', async (status, expected) => {
    fetchFixture.mockResolvedValue(new Response(JSON.stringify({ message: 'fixture only' }), { status }));
    render(<Harness />);
    await waitFor(() => expect(screen.getByLabelText('Estado')).toHaveTextContent(expected));
    expect(screen.queryByText(/operator@example/)).not.toBeInTheDocument();
  });
  it.each([
    { user: { ...user, permissions: '*' } },
    { user: { ...user, permissions: [null] } },
    { user: { ...user, role: { name: 'ADMIN' } } },
    { user: { ...user, id: '' } },
    { accessToken: 'untrusted.fixture.token' },
  ])('rejects malformed self-context and never infers authority from a token', async (payload) => {
    fetchFixture.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));
    render(<Harness />);
    await waitFor(() => expect(screen.getByLabelText('Estado')).toHaveTextContent('invalid_response'));
    expect(screen.queryByText(/operator@example/)).not.toBeInTheDocument();
  });
  it('keeps successful empty permissions distinct from a failed request', async () => {
    fetchFixture.mockResolvedValue(new Response(JSON.stringify({ user: { ...user, permissions: [] } }), { status: 200 }));
    render(<Harness />);
    await waitFor(() => expect(screen.getByLabelText('Estado')).toHaveTextContent('success'));
    expect(screen.getByText(/operator@example/)).toBeInTheDocument();
  });
  it('permits retry after network failure and does not retain a fabricated identity', async () => {
    fetchFixture.mockRejectedValueOnce(new TypeError('fixture network failure')).mockResolvedValueOnce(new Response(JSON.stringify({ user }), { status: 200 }));
    render(<Harness />);
    await waitFor(() => expect(screen.getByLabelText('Estado')).toHaveTextContent('network_error'));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText(/operator@example/)).toBeInTheDocument();
  });
  it('discards stale response after route change and revalidates the session', async () => {
    let resolveFirst!: (response: Response) => void;
    fetchFixture.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve; })).mockResolvedValueOnce(new Response(JSON.stringify({ user: { ...user, email: 'current@example.test' } }), { status: 200 }));
    const { rerender } = render(<Harness />);
    rerender(<Harness route="/admin/clientes" />);
    expect(await screen.findByText(/current@example/)).toBeInTheDocument();
    resolveFirst(new Response(JSON.stringify({ user }), { status: 200 }));
    await waitFor(() => expect(screen.queryByText(/operator@example/)).not.toBeInTheDocument());
  });
});
