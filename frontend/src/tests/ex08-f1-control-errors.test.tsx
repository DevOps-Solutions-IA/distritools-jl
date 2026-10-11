import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminReports } from '@/components/admin/AdminReports';
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));
describe('EX08 F1 control pages failed reads', () => {
  it('renders session failure without any synthesized revenue or readiness', async () => {
    render(await AdminDashboard());
    expect(screen.getByRole('alert')).toHaveAttribute(
      'data-state',
      'auth_required',
    );
    expect(
      screen.getByRole('link', { name: 'Iniciar sesión' }),
    ).toHaveAttribute('href', '/admin/login');
    expect(screen.queryByText('$ 0')).not.toBeInTheDocument();
    expect(screen.queryByText('NO_GO')).not.toBeInTheDocument();
  });
  it('renders reports session failure without invented empty success', async () => {
    render(await AdminReports());
    expect(screen.getByRole('alert')).toHaveAttribute(
      'data-state',
      'auth_required',
    );
    expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
  });
});
