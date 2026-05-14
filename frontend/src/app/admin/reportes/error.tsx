'use client';

export default function AdminReportsError({ reset }: { reset: () => void }) {
  return (
    <section className="rounded-[1.75rem] border border-[rgba(220,38,38,0.28)] bg-[rgba(220,38,38,0.08)] p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-error-red)]">
        Reportes no disponibles
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-[var(--color-off-white)]">
        No se pudo cargar el módulo de reportes.
      </h1>
      <button
        type="button"
        onClick={reset}
        className="mt-5 rounded-full bg-[var(--color-industrial-yellow)] px-4 py-2 text-sm font-semibold text-[#050505]"
      >
        Reintentar
      </button>
    </section>
  );
}
