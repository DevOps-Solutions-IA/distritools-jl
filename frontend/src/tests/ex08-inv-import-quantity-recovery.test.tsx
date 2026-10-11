import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DryRunImportForm } from '@/features/admin/inventory/OperationForms';
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
const header = 'sku,warehouseCode,quantity,mode,reason\n';
const batch = { id: 'persisted-batch', status: 'dry_run_valid', createdAt: '2026-10-11T00:00:00Z', updatedAt: '2026-10-11T00:00:00Z', filename: 'inventory-import.csv', totalRows: 1, validRows: 1, errorRows: 0, rows: [{ id: 'row', rowNumber: 1, sku: 'SKU', warehouseCode: 'W', quantity: 2, mode: 'increment', reason: 'Reason', valid: true, errors: null }] };
beforeEach(() => { cleanup(); vi.clearAllMocks(); vi.stubGlobal('fetch', vi.fn()); });
describe('CSV quantity recovery uses concrete400 without enabling uncertain replay', () => {
  it('keeps rejected CSV editable, shows quantity/row detail and sends corrected CSV only on explicit submit', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Fila 1: quantity debe ser un entero entre -2147483648 y 2147483647.' }), { status: 400 })).mockResolvedValueOnce(new Response(JSON.stringify(batch), { status: 201 }));
    render(<DryRunImportForm />); const csv = screen.getByLabelText('CSV de inventario'); const button = screen.getByRole('button', { name: 'Ejecutar dry-run' });
    fireEvent.change(csv, { target: { value: header + 'SKU,W,not-a-number,increment,Reason' } }); fireEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Fila 1: quantity'); expect(csv).toBeEnabled(); expect(button).toBeEnabled(); expect(screen.queryByRole('link', { name: 'Consultar resultado persistido' })).not.toBeInTheDocument(); expect(push).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(1);
    fireEvent.change(csv, { target: { value: header + 'SKU,W,2,increment,Reason' } }); expect(fetch).toHaveBeenCalledTimes(1); fireEvent.click(button);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/admin/inventario/importaciones/persisted-batch'));
    expect(fetch).toHaveBeenCalledTimes(2); const body = JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body)); expect(body.csv).toBe(header + 'SKU,W,2,increment,Reason');
  });
  it('still blocks edits and blind retry for500 rather than treating any import failure as recoverable', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: 'Failure' }), { status: 500 })); render(<DryRunImportForm />);
    fireEvent.change(screen.getByLabelText('CSV de inventario'), { target: { value: header + 'SKU,W,2,increment,Reason' } }); fireEvent.click(screen.getByRole('button', { name: 'Ejecutar dry-run' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Resultado incierto'); expect(screen.getByLabelText('CSV de inventario')).toBeDisabled(); expect(screen.getByRole('button', { name: 'Ejecutar dry-run' })).toBeDisabled(); expect(screen.getByRole('link', { name: 'Consultar resultado persistido' })).toHaveAttribute('href', '/admin/inventario/importaciones'); expect(fetch).toHaveBeenCalledTimes(1); expect(push).not.toHaveBeenCalled();
  });
});
