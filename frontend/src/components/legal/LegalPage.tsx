import { Badge } from '@/components/ui/Badge';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { StorefrontLinkButton } from '@/components/storefront/StorefrontButton';
import type { LegalPageContent } from '@/content/legal-pages';

interface LegalPageProps {
  page: LegalPageContent;
}

export function LegalPage({ page }: LegalPageProps) {
  return (
    <StorefrontShell>
    <article className="mx-auto max-w-4xl space-y-6">
      <header className="rounded-[2rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-elevated sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
              Información legal
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--color-off-white)] sm:text-4xl">
              {page.title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base sm:leading-7">
              {page.description}
            </p>
          </div>
          <Badge variant="warning">Revisión legal</Badge>
        </div>
        <dl className="mt-6 grid gap-3 text-sm text-[var(--color-text-secondary)] sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Versión</dt>
            <dd className="mt-1 text-[var(--color-off-white)]">{page.version}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Actualización</dt>
            <dd className="mt-1 text-[var(--color-off-white)]">{page.updatedAt}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <dt className="text-xs font-semibold uppercase tracking-[0.14em]">Vigencia</dt>
            <dd className="mt-1 text-[var(--color-off-white)]">{page.effectiveAt}</dd>
          </div>
        </dl>
      </header>

      <section className="rounded-[1.35rem] border border-amber-300/25 bg-amber-300/[0.08] p-5 text-sm text-amber-50">
        <h2 className="font-semibold">Aviso de revisión pendiente</h2>
        <p className="mt-2 leading-6">
          Este documento está estructurado para revisión profesional. Los campos entre corchetes deben completarse con datos reales antes de aprobación y publicación definitiva.
        </p>
      </section>

      <nav
        aria-label="Índice del documento"
        className="rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5"
      >
        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-industrial-yellow)]">
          Índice
        </h2>
        <ol className="mt-4 grid gap-2 text-sm text-[var(--color-text-secondary)] sm:grid-cols-2">
          {page.sections.map((section, index) => (
            <li key={section.title}>
              <a className="hover:text-[var(--color-industrial-yellow)]" href={`#section-${index + 1}`}>
                {index + 1}. {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="grid gap-4">
        {page.sections.map((section, index) => (
          <div key={section.title} id={`section-${index + 1}`}>
            <details className="rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d] p-4 sm:hidden">
              <summary className="cursor-pointer list-none text-base font-semibold text-[var(--color-off-white)]">
                {section.title}
              </summary>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{section.body}</p>
            </details>
            <section className="hidden rounded-[1.35rem] border border-[var(--color-border)] bg-[#0d0d0d] p-5 sm:block">
              <h2 className="text-lg font-semibold text-[var(--color-off-white)]">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">{section.body}</p>
            </section>
          </div>
        ))}
      </div>

      <footer className="rounded-[1.35rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm text-[var(--color-text-secondary)]">
        <p>Responsable declarado: {page.responsible}</p>
        <StorefrontLinkButton href={page.contactHref} storefrontVariant="secondary" storefrontSize="compact" className="mt-4">
          Contacto y soporte
        </StorefrontLinkButton>
      </footer>
    </article>
    </StorefrontShell>
  );
}
