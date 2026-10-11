import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AdminSessionFeedback } from '@/features/admin/shell/AdminSessionFeedback';
afterEach(cleanup);
describe('EX08 F2 session feedback — distinct adverse states', () => {
  it('announces loading without offering an unverified action', () => {
    render(<AdminSessionFeedback status="loading" onRetry={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent(/verificando/i);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
  it('offers login for expired session instead of declaring an empty module', () => {
    render(<AdminSessionFeedback status="auth_required" onRetry={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/sesión/i);
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/admin/login');
  });
  it('explains insufficient permissions separately from connection error', () => {
    render(<AdminSessionFeedback status="forbidden" onRetry={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/acceso denegado/i);
    expect(screen.queryByText(/sin conexión/i)).not.toBeInTheDocument();
  });
  it('wires retry to a real handler for network failure', () => {
    const retry = vi.fn();
    render(<AdminSessionFeedback status="network_error" onRetry={retry} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/sin conexión/i);
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
