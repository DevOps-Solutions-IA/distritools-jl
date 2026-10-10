import type { SectionScreenProps } from './types';

export function CompatibilityFallback({
  adminModule,
}: Pick<SectionScreenProps, 'adminModule'>) {
  return (
    <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-off-white)]">
            Estado operativo
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
            Este módulo tiene ruta protegida y contrato definido. No se inventan
            datos si falta provider, listado o flujo final.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">
            Acciones permitidas
          </h3>
          <ul className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
            {adminModule.primaryActions.map((action) => (
              <li
                key={action}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                {action}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">
            Bloqueos de producción
          </h3>
          <ul className="mt-3 grid gap-2 text-sm text-[var(--color-text-secondary)]">
            {adminModule.validations.map((validation) => (
              <li
                key={validation}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
              >
                {validation}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
