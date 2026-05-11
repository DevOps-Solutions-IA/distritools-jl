import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { KpiCard } from '@/components/ui/KpiCard';
import { adminModules, getAdminCatalogSnapshot } from '@/lib/admin/operations';

export async function AdminDashboard() {
  const snapshot = await getAdminCatalogSnapshot();

  const kpis = [
    {
      title: 'Productos activos',
      value: String(snapshot.products),
      context: snapshot.available ? 'Lectura desde catálogo real.' : 'Catálogo no disponible.',
    },
    {
      title: 'Sin precio',
      value: String(snapshot.productsWithoutPrice),
      context: 'Requieren cotización o precio antes de venta directa.',
    },
    {
      title: 'Sin SKU',
      value: String(snapshot.productsWithoutSku),
      context: 'No publicar como venta directa sin aprobación manual.',
    },
    {
      title: 'Sin imagen',
      value: String(snapshot.productsWithoutImage),
      context: 'Assets pendientes, sin descargar logos o empaques no autorizados.',
    },
  ];

  return (
    <div className="space-y-7">
      <section className="rounded-[2rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,#121212_0%,#0b0b0b_100%)] p-5 shadow-elevated sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
              Operación interna
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-off-white)] sm:text-4xl">
              Centro operativo DistriTools JL
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
              Panel protegido para catálogo, pedidos, cotizaciones, pagos, envíos, contenido y auditoría. Las métricas sin fuente real se muestran como pendientes.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ['Auth', 'Backend JWT + 2FA'],
              ['RBAC', 'Permisos server-side'],
              ['Auditoría', 'Eventos críticos'],
              ['Providers', 'PSE/envíos cerrados sin credenciales'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-[var(--color-border)] bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">{label}</p>
                <p className="mt-2 text-sm font-semibold text-[var(--color-off-white)]">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {adminModules.filter((module) => module.key !== 'dashboard').map((module) => (
          <Link
            key={module.key}
            href={module.href}
            className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition hover:border-[rgba(245,183,0,0.45)] hover:bg-white/[0.04]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--color-off-white)]">{module.title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{module.description}</p>
              </div>
              <Badge variant={module.status === 'operational' ? 'success' : 'warning'}>
                {module.status === 'operational' ? 'Activo' : 'Pendiente'}
              </Badge>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
