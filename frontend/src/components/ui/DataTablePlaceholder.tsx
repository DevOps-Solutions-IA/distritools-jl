import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

export function DataTablePlaceholder() {
  return (
    <Card
      variant="elevated"
      className="overflow-hidden border-[var(--color-border)] bg-[linear-gradient(180deg,#111111_0%,#0c0c0c_100%)]"
    >
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-graphite-black)]">
            Operación reciente
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Vista lista para filtros, trazabilidad y acciones administrativas controladas.
          </p>
        </div>
        <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-xl">
          <Input label="Buscar" placeholder="Pedido, SKU o cliente" />
          <Input label="Filtro rápido" placeholder="Estado, módulo, rol..." />
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-4 gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          <span>Entidad</span>
          <span>Estado</span>
          <span>Última actualización</span>
          <span>Acción</span>
        </div>
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-4 items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
