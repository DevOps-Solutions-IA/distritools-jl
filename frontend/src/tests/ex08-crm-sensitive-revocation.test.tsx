import { act, fireEvent, render, screen } from '@testing-library/react';
import { CustomerActions } from '@/features/admin/customers/CustomerActions';
const router = { refresh: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
const permission = ['customers.read_sensitive'];
const privateCustomer = { id: 'customer-a', fullName: 'Synthetic private person', email: 'private@example.invalid', phone: '0000000000', defaultAddress: 'Synthetic private address' };
const reveal = () => fireEvent.click(screen.getByRole('button', { name: 'Consultar datos sensibles con auditoría' }));
const response = () => new Response(JSON.stringify(privateCustomer), { status: 201 });
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('CRM sensitive reveal lifetime', () => {
  it('clears already revealed data on permission rerender and never resurrects it on restoration', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => response()));
    const view = render(<CustomerActions id="customer-a" permissions={permission} />); reveal();
    expect(await screen.findByText(privateCustomer.email)).toBeInTheDocument();
    view.rerender(<CustomerActions id="customer-a" permissions={[]} />);
    expect(screen.queryByLabelText('Datos sensibles consultados')).not.toBeInTheDocument();
    view.rerender(<CustomerActions id="customer-a" permissions={permission} />);
    expect(screen.queryByText(privateCustomer.email)).not.toBeInTheDocument();
    reveal(); expect(await screen.findByText(privateCustomer.email)).toBeInTheDocument();
  });
  it('clears already revealed data when navigating to another customer and back', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => response()));
    const view = render(<CustomerActions id="customer-a" permissions={permission} />); reveal(); await screen.findByText(privateCustomer.email);
    view.rerender(<CustomerActions id="customer-b" permissions={permission} />);
    expect(screen.queryByText(privateCustomer.email)).not.toBeInTheDocument();
    view.rerender(<CustomerActions id="customer-a" permissions={permission} />);
    expect(screen.queryByLabelText('Datos sensibles consultados')).not.toBeInTheDocument();
  });
  for (const change of ['permission', 'customer'] as const) {
    it(`discards a late reveal after ${change} changes, including restoration before response`, async () => {
      let resolve!: (value: Response) => void;
      vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise<Response>(r => { resolve = r; })));
      const view = render(<CustomerActions id="customer-a" permissions={permission} />); reveal();
      view.rerender(<CustomerActions id={change === 'customer' ? 'customer-b' : 'customer-a'} permissions={change === 'permission' ? [] : permission} />);
      view.rerender(<CustomerActions id="customer-a" permissions={permission} />);
      await act(async () => { resolve(response()); });
      expect(screen.queryByLabelText('Datos sensibles consultados')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Consultar datos sensibles con auditoría' })).toBeEnabled();
    });
  }
  it('clears a prior reveal after current backend 403 even before permission props update', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response('{}', { status: 403 })));
    render(<CustomerActions id="customer-a" permissions={permission} />); reveal(); await screen.findByText(privateCustomer.email); reveal();
    expect(await screen.findByRole('status')).toHaveTextContent(/permiso/);
    expect(screen.queryByLabelText('Datos sensibles consultados')).not.toBeInTheDocument();
  });
});
