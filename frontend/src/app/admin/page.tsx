import { DataTablePlaceholder } from '@/components/ui/DataTablePlaceholder';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { KpiCard } from '@/components/ui/KpiCard';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AdminPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#121212_0%,#0b0b0b_100%)] p-8 shadow-elevated">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
              Centro de operación interna
            </p>
            <h2 className="text-4xl font-semibold tracking-tight text-[var(--color-off-white)]">
              Controla catálogo, inventario, órdenes y pagos desde una sola vista.
            </h2>
            <p className="max-w-3xl text-base leading-7 text-[var(--color-text-secondary)]">
              El entorno administrativo queda separado de la tienda pública y prioriza lectura rápida, estados operativos y acciones con contexto.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              'Acceso interno',
              'RBAC backend',
              'Auditoría operativa',
              'Métricas listas para integración',
            ].map((item) => (
              <div
                key={item}
                className="rounded-2xl border border-[var(--color-border)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm font-medium text-[var(--color-off-white)]"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Ventas del día"
          value="$ 12.4M"
          context="Lectura rápida para la operación comercial del día."
          trend="+8.2%"
        />
        <KpiCard
          title="Pedidos pendientes"
          value="48"
          context="Pedidos que requieren seguimiento o gestión operativa."
          trend="+5"
        />
        <KpiCard
          title="Stock crítico"
          value="12"
          context="Referencias que deben revisarse antes de afectar disponibilidad."
          trend="Atención"
        />
        <KpiCard
          title="Pagos aprobados"
          value="91%"
          context="Indicador visual para control de desempeño en cobro."
          trend="+1.4%"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <DataTablePlaceholder />
        <div className="space-y-6">
          <Skeleton className="h-40 rounded-lg" />
          <EmptyState
            title="Sin alertas críticas activas"
            description="La consola queda lista para mostrar colas, alertas y eventos relevantes cuando aparezcan incidencias."
          />
          <ErrorState
            title="Acceso administrativo pendiente de autenticación"
            description="La vista ya separa operación interna y quedará conectada a auth/RBAC backend sin fingir sesión real ni exponer datos sensibles."
          />
        </div>
      </section>
    </div>
  );
}
