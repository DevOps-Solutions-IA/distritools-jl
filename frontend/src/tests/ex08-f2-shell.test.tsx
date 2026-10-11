import * as React from 'react';
import Link from 'next/link';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AdminModuleSearch } from '@/features/admin/shell/AdminModuleSearch';
import { AdminDrawer } from '@/features/admin/shell/AdminDrawer';
import type { AdminModuleConfig } from '@/lib/admin/transport/navigation';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const modules: AdminModuleConfig[] = [
  { key: 'productos', title: 'Productos', href: '/admin/productos', description: 'Catálogo de herramientas', permission: 'products.write', status: 'READY', primaryActions: [], validations: [], endpoints: [] },
  { key: 'pedidos', title: 'Pedidos', href: '/admin/pedidos', description: 'Operación de pedidos', permission: 'orders.read', status: 'READY', primaryActions: [], validations: [], endpoints: [] },
];
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('EX08 F2 module search: permitted destinations only', () => {
  it('has an explicit empty result instead of navigating to unrelated reports', () => {
    render(<AdminModuleSearch modules={modules} />);
    const input = screen.getByRole('searchbox', { name: 'Buscar módulo' });
    fireEvent.change(input, { target: { value: 'factura inexistente' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByRole('status')).toHaveTextContent('Sin resultados');
    expect(push).not.toHaveBeenCalled();
  });
  it('navigates to the sole matching authorized module and normalizes accents', () => {
    render(<AdminModuleSearch modules={modules} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: ' catalogo ' } });
    expect(screen.getByRole('link', { name: /productos/i })).toHaveAttribute('href', '/admin/productos');
    fireEvent.submit(screen.getByRole('search'));
    expect(push).toHaveBeenCalledWith('/admin/productos');
  });
  it('never offers modules outside the supplied effective permission set', () => {
    render(<AdminModuleSearch modules={[modules[1]]} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'productos' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
  it('keeps multiple results selectable and supports keyboard focus without guessing', () => {
    render(<AdminModuleSearch modules={modules} />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'operación' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('link', { name: /pedidos/i })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('link'), { key: 'Escape' });
    expect(input).toHaveFocus();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

function DrawerHarness() {
  const [open, setOpen] = React.useState(false);
  const backgroundRef = React.useRef<HTMLDivElement>(null);
  return <><div ref={backgroundRef}><button onClick={() => setOpen(true)}>Abrir menú</button><a href="/outside">Fuera</a></div>{open ? <AdminDrawer backgroundRef={backgroundRef} onClose={() => setOpen(false)}><Link href="/admin/pedidos">Pedidos</Link><button>Salir</button></AdminDrawer> : null}</>;
}
describe('EX08 F2 modal drawer keyboard and background isolation', () => {
  it('moves focus, traps both tab directions, locks background and restores focus on Escape', () => {
    render(<DrawerHarness />);
    const opener = screen.getByRole('button', { name: 'Abrir menú' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Menú administrativo' });
    const close = within(dialog).getByRole('button', { name: 'Cerrar menú administrativo' });
    expect(close).toHaveFocus();
    expect(opener.parentElement).toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    const last = within(dialog).getByRole('button', { name: 'Salir' });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
    expect(opener.parentElement).not.toHaveAttribute('inert');
    expect(document.body.style.overflow).toBe('');
  });
  it('closes on explicit close without leaving page content inert', () => {
    render(<DrawerHarness />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar menú administrativo' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fuera' }).parentElement).not.toHaveAttribute('inert');
  });
});
