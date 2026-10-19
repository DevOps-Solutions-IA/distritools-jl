import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { LegalPage } from '@/components/legal/LegalPage';
import type { LegalPageContent } from '@/content/legal-pages';
import type { PublicLegalResult } from '@/lib/api/legal';

export function PublishedLegalPage({ result, fallback }: { result: PublicLegalResult; fallback: LegalPageContent }) {
  if (result.status === 'missing') return <LegalPage page={fallback} />;
  if (result.status === 'unavailable') {
    return (
      <StorefrontShell>
        <article className="mx-auto max-w-4xl space-y-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-8">
          <h1 className="text-2xl font-semibold text-[var(--color-off-white)]">{fallback.title}</h1>
          <p role="alert" className="text-sm leading-6 text-[var(--color-text-secondary)]">
            El documento legal no está disponible en este momento. Vuelve a cargar la página para consultar su publicación.
          </p>
        </article>
      </StorefrontShell>
    );
  }
  const { document } = result;
  const hasText = Boolean(
    document.content.notice?.trim() || document.content.text?.trim() ||
    document.content.sections?.some((section) => section.title.trim() || section.body.trim()),
  );
  return (
    <StorefrontShell>
      <article className="mx-auto max-w-4xl space-y-6 break-words [overflow-wrap:anywhere]">
        <header className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--color-industrial-yellow)]">Documento publicado</p>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--color-off-white)] sm:text-4xl">{document.title}</h1>
          <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3 text-sm text-[var(--color-text-secondary)]">
            <div><dt>Versión</dt><dd className="mt-1 text-[var(--color-off-white)]">{document.version}</dd></div>
            <div><dt>Publicación</dt><dd className="mt-1 text-[var(--color-off-white)]"><time dateTime={document.publishedAt}>{document.publishedAt}</time></dd></div>
          </dl>
        </header>
        {!hasText && <p role="status" className="text-sm text-[var(--color-text-secondary)]">Esta versión publicada no contiene texto.</p>}
        {document.content.notice && <p className="whitespace-pre-wrap rounded-2xl border border-[var(--color-border)] p-5 text-sm leading-7 text-[var(--color-text-secondary)]">{document.content.notice}</p>}
        {document.content.text && <p className="whitespace-pre-wrap rounded-2xl border border-[var(--color-border)] p-5 text-sm leading-7 text-[var(--color-text-secondary)]">{document.content.text}</p>}
        {document.content.sections?.map((section, index) => (
          <section key={index} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-[var(--color-off-white)]">{section.title}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--color-text-secondary)]">{section.body}</p>
          </section>
        ))}
      </article>
    </StorefrontShell>
  );
}
