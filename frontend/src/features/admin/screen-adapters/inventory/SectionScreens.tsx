import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { AdminTable } from '../shared/AdminTable';
import { moneyValue } from '../shared/display-values';
import type { SectionScreenAdapter, SectionScreenProps } from '../shared/types';

export function InventarioScreen({
  operations,
}: SectionScreenProps<
  | 'inventoryOverview'
  | 'inventoryValuation'
  | 'inventoryWarehouses'
  | 'inventoryAlerts'
  | 'inventoryReservations'
>) {
  return (
    <section className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {[
          [
            'Stock físico',
            operations.inventoryOverview.summary?.physicalStock ?? 0,
          ],
          [
            'Disponible',
            operations.inventoryOverview.summary?.availableStock ?? 0,
          ],
          [
            'Reservado',
            operations.inventoryOverview.summary?.reservedStock ?? 0,
          ],
          [
            'Comprometido',
            operations.inventoryOverview.summary?.committedStock ?? 0,
          ],
          [
            'Valorización',
            moneyValue(operations.inventoryValuation.totalValue ?? 0),
          ],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
              {String(label)}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--color-off-white)]">
              {String(value)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          [
            'Kardex',
            '/admin/inventario/historial',
            'Movimientos con antes/después, referencia, usuario y motivo.',
          ],
          [
            'Ajustes',
            '/admin/inventario#ajustes',
            'Endpoint protegido por inventory.adjust con motivo obligatorio.',
          ],
          [
            'Import/export',
            '/admin/inventario#importacion',
            'Dry-run obligatorio, aplicación auditada y export con permiso.',
          ],
        ].map(([label, href, description]) => (
          <Link key={href} href={href}>
            <div className="h-full rounded-2xl border border-[var(--color-border)] bg-[#0d0d0d] p-4 transition hover:border-[var(--color-industrial-yellow)]">
              <p className="font-semibold text-[var(--color-off-white)]">
                {label}
              </p>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {description}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <AdminTable<Record<string, unknown> & { id: string }>
        title="Stock por SKU"
        description="Inventario real por producto, variante y bodega con stock físico, reservado, comprometido y disponible."
        rows={(
          operations.inventoryOverview.data as Array<
            Record<string, unknown> & { id: string }
          >
        ).slice(0, 80)}
        columns={[
          {
            key: 'sku',
            label: 'SKU',
            render: (row) => (
              <span className="font-semibold text-[var(--color-off-white)]">
                {String(row.sku)}
              </span>
            ),
          },
          {
            key: 'product',
            label: 'Producto',
            render: (row) => String(row.product ?? 'Sin producto'),
          },
          {
            key: 'warehouse',
            label: 'Bodega',
            render: (row) =>
              `${String(row.warehouseCode)} · ${String(row.warehouse)}`,
          },
          {
            key: 'stock',
            label: 'Stock',
            render: (row) => (
              <div>
                <p>Físico: {String(row.physicalStock)}</p>
                <p>Reservado: {String(row.reservedStock)}</p>
                <p>Disponible: {String(row.availableStock)}</p>
              </div>
            ),
          },
          {
            key: 'status',
            label: 'Estado',
            render: (row) => (
              <Badge
                variant={
                  row.stockStatus === 'healthy'
                    ? 'success'
                    : row.stockStatus === 'low_stock'
                      ? 'warning'
                      : 'danger'
                }
              >
                {String(row.stockStatus)}
              </Badge>
            ),
          },
          {
            key: 'value',
            label: 'Valor',
            render: (row) =>
              row.inventoryValue === null
                ? 'Costo no configurado'
                : moneyValue(row.inventoryValue),
          },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminTable<Record<string, unknown> & { id: string }>
          title="Bodegas"
          description="Bodegas activas, prioridad y cantidad de SKUs asociados."
          rows={(
            operations.inventoryWarehouses.data as Array<
              Record<string, unknown> & { id: string }
            >
          ).slice(0, 50)}
          columns={[
            {
              key: 'code',
              label: 'Código',
              render: (row) => (
                <span className="font-semibold text-[var(--color-off-white)]">
                  {String(row.code)}
                </span>
              ),
            },
            { key: 'name', label: 'Bodega', render: (row) => String(row.name) },
            {
              key: 'status',
              label: 'Estado',
              render: (row) => (
                <Badge variant={row.isActive ? 'success' : 'neutral'}>
                  {row.isDefault
                    ? 'Default'
                    : row.isActive
                      ? 'Activa'
                      : 'Inactiva'}
                </Badge>
              ),
            },
            {
              key: 'items',
              label: 'SKUs',
              render: (row) => String(row.inventoryItems ?? 0),
            },
          ]}
        />
        <AdminTable<Record<string, unknown> & { id: string }>
          title="Alertas"
          description="Alertas reales de bajo stock, sin stock, reservas altas o mínimos faltantes."
          rows={(
            operations.inventoryAlerts.data as Array<Record<string, unknown>>
          )
            .map((row, index) => ({
              ...row,
              id: `${row.code}-${row.sku}-${index}`,
            }))
            .slice(0, 50)}
          columns={[
            {
              key: 'severity',
              label: 'Nivel',
              render: (row) => (
                <Badge
                  variant={
                    row.severity === 'danger'
                      ? 'danger'
                      : row.severity === 'warning'
                        ? 'warning'
                        : 'info'
                  }
                >
                  {String(row.severity)}
                </Badge>
              ),
            },
            { key: 'sku', label: 'SKU', render: (row) => String(row.sku) },
            {
              key: 'message',
              label: 'Mensaje',
              render: (row) => String(row.message),
            },
            {
              key: 'available',
              label: 'Disponible',
              render: (row) => String(row.availableStock),
            },
          ]}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <AdminTable<Record<string, unknown> & { id: string }>
          title="Reservas"
          description="Stock reservado o comprometido por SKU para detectar presión operativa."
          rows={(
            operations.inventoryReservations.data as Array<
              Record<string, unknown>
            >
          )
            .map((row, index) => ({
              ...row,
              id: `${row.variantId}-${row.warehouseId}-${index}`,
            }))
            .slice(0, 50)}
          columns={[
            { key: 'sku', label: 'SKU', render: (row) => String(row.sku) },
            {
              key: 'warehouse',
              label: 'Bodega',
              render: (row) => String(row.warehouse),
            },
            {
              key: 'reserved',
              label: 'Reservado',
              render: (row) => String(row.reservedStock),
            },
            {
              key: 'committed',
              label: 'Comprometido',
              render: (row) => String(row.committedStock),
            },
          ]}
        />
        <AdminTable<Record<string, unknown> & { id: string }>
          title="Valorización"
          description="Valor de inventario por SKU; si no hay costo configurado, queda explícito."
          rows={(
            (operations.inventoryValuation.data ?? []) as Array<
              Record<string, unknown>
            >
          )
            .map((row, index) => ({ ...row, id: `${row.variantId}-${index}` }))
            .slice(0, 50)}
          columns={[
            { key: 'sku', label: 'SKU', render: (row) => String(row.sku) },
            {
              key: 'warehouse',
              label: 'Bodega',
              render: (row) => String(row.warehouse),
            },
            {
              key: 'cost',
              label: 'Costo',
              render: (row) =>
                row.costPrice === null
                  ? 'No configurado'
                  : moneyValue(row.costPrice),
            },
            {
              key: 'value',
              label: 'Valor',
              render: (row) =>
                row.inventoryValue === null
                  ? 'Pendiente'
                  : moneyValue(row.inventoryValue),
            },
          ]}
        />
      </div>
    </section>
  );
}

export function PreciosScreen({ snapshot }: SectionScreenProps<never>) {
  const variantRows = snapshot.variantRows.slice(0, 80);
  return (
    <AdminTable
      title="Precios y SKUs"
      description="Variantes reales del backend. Ajustes críticos deben ejecutarse con permiso y quedar auditados."
      rows={variantRows}
      columns={[
        {
          key: 'sku',
          label: 'SKU',
          render: (variant) => (
            <span className="font-semibold text-[var(--color-off-white)]">
              {variant.sku}
            </span>
          ),
        },
        { key: 'name', label: 'Variante', render: (variant) => variant.name },
        {
          key: 'product',
          label: 'Producto',
          render: (variant) => variant.product?.name ?? 'Sin producto',
        },
        {
          key: 'price',
          label: 'Precio',
          render: (variant) =>
            variant.price
              ? `$ ${Number(variant.price).toLocaleString('es-CO')}`
              : 'Cotizar',
        },
      ]}
    />
  );
}

export const inventorySectionAdapters = {
  inventario: {
    Screen: InventarioScreen,
    actions: [{ label: 'Revisar variantes', href: '/admin/precios' }],
  },
  precios: {
    Screen: PreciosScreen,
    actions: [{ label: 'Revisar productos', href: '/admin/productos' }],
  },
} satisfies Record<'inventario' | 'precios', SectionScreenAdapter>;
