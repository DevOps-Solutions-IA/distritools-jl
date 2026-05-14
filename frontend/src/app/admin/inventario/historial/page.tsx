import { AdminShell } from '@/components/layout/AdminShell';
import { Badge } from '@/components/ui/Badge';
import { getAdminOperationalSnapshot } from '@/lib/admin/server-data';

export default async function AdminInventoryHistoryPage() {
  const operations = await getAdminOperationalSnapshot();
  const rows = operations.inventoryHistory.data.slice(0, 150);

  return (
    <AdminShell>
      <div className="space-y-6">
        <section className="rounded-[2rem] border border-[var(--color-border)] bg-[linear-gradient(135deg,#121212_0%,#0b0b0b_62%,rgba(245,183,0,0.09)_100%)] p-5 shadow-elevated sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
            inventory.read
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-off-white)]">
            Kardex de inventario
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
            Ledger operativo con tipo de movimiento, SKU, bodega, cantidad, antes/después, referencia, origen y motivo. Las mutaciones de stock se ejecutan en endpoints protegidos y auditados.
          </p>
        </section>

        <section className="overflow-hidden rounded-[1.5rem] border border-[var(--color-border)] bg-[#0d0d0d]">
          <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--color-off-white)]">Movimientos recientes</h2>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                Últimos 150 movimientos del kardex real.
              </p>
            </div>
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              {rows.length} movimientos
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
                <tr>
                  {['Tipo', 'SKU', 'Bodega', 'Delta', 'Antes/después', 'Referencia', 'Motivo', 'Origen'].map((label) => (
                    <th key={label} className="px-5 py-3 font-semibold">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((row) => (
                  <tr key={String(row.id)} className="align-top">
                    <td className="px-5 py-4"><Badge variant="info">{String(row.type ?? row.movementType)}</Badge></td>
                    <td className="px-5 py-4 font-semibold text-[var(--color-off-white)]">{String(row.sku ?? 'Sin SKU')}</td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)]">{String(row.warehouse ?? 'Sin bodega')}</td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)]">{String(row.quantityDelta ?? row.quantity)}</td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)]">
                      {String(row.quantityBefore ?? 'n/a')} → {String(row.quantityAfter ?? 'n/a')}
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)]">
                      {String(row.referenceType)}:{String(row.referenceId)}
                    </td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)]">{String(row.reasonText ?? row.reason ?? 'Sin motivo')}</td>
                    <td className="px-5 py-4 text-[var(--color-text-secondary)]">{String(row.source ?? 'system')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
