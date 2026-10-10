import { Badge } from '@/components/ui/Badge';
import { AdminTable } from '../shared/AdminTable';
import { FooterRouteEditor } from '@/components/admin/FooterRouteEditor';
import type { FooterRevisionInput } from '@/lib/api/footer';
import type { SectionScreenAdapter, SectionScreenProps } from '../shared/types';

export function LegalScreen({ operations }: SectionScreenProps<'legal'>) {
  return (
    <AdminTable<Record<string, unknown> & { id: string }>
      title="Workflow legal"
      description="Contenido legal existente con estado de revisión guardado en el backend."
      rows={operations.legal.data.map((row, index) => ({
        ...row,
        id: String(row.id ?? `legal-${index}`),
      }))}
      columns={[
        {
          key: 'title',
          label: 'Página',
          render: (row) => String(row.title ?? 'Sin título'),
        },
        {
          key: 'status',
          label: 'Workflow',
          render: (row) => (
            <Badge
              variant={
                row.workflowStatus === 'published' ? 'success' : 'warning'
              }
            >
              {String(row.workflowStatus ?? 'draft')}
            </Badge>
          ),
        },
        {
          key: 'published',
          label: 'Publicado',
          render: (row) => (row.isPublished ? 'Sí' : 'No'),
        },
        {
          key: 'updated',
          label: 'Actualizado',
          render: (row) =>
            row.updatedAt
              ? new Date(String(row.updatedAt)).toLocaleString('es-CO')
              : 'Sin fecha',
        },
      ]}
    />
  );
}

export function FooterScreen({ operations }: SectionScreenProps<'footer'>) {
  return (
    <section className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h2 className="text-xl font-semibold text-[var(--color-off-white)]">
        Footer versionado
      </h2>
      <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
        Footer editable con validación de links internos, revisión, aprobación y
        publicación auditada.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
            Versión actual
          </p>
          <p className="mt-2 text-xl font-semibold text-[var(--color-off-white)]">
            {String(
              (operations.footer.data as { version?: number } | undefined)
                ?.version ?? 'Pendiente',
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
            Estado
          </p>
          <p className="mt-2 text-xl font-semibold text-[var(--color-off-white)]">
            {String(
              (operations.footer.data as { status?: string } | undefined)
                ?.status ?? 'Sin revisión',
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">
            Links
          </p>
          <p className="mt-2 text-xl font-semibold text-[var(--color-off-white)]">
            {
              (
                (operations.footer.data as { links?: unknown[] } | undefined)
                  ?.links ?? []
              ).length
            }
          </p>
        </div>
      </div>
      {operations.footer.requiresReview ? (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-amber-300/25 p-4 text-amber-100"
        >
          Hay destinos publicados que dejaron de estar disponibles. Los enlaces
          afectados se ocultan en la tienda. Cree una nueva revisión para
          corregirlos y solicitar aprobación.
        </div>
      ) : null}
      {Array.isArray(operations.footer.routeAlerts) ? (
        <p className="mt-2 text-sm">
          Alertas de destinos: {operations.footer.routeAlerts.length}
        </p>
      ) : null}
      <FooterRouteEditor
        key={String(
          (operations.footer.data as FooterRevisionInput | undefined)?.id ??
            'new',
        )}
        revision={operations.footer.data as FooterRevisionInput | undefined}
      />
    </section>
  );
}

export const contentSectionAdapters = {
  'contenido-legal': {
    Screen: LegalScreen,
    actions: [
      { label: 'Ver páginas legales', href: '/politica-de-privacidad' },
    ],
  },
  'contenido-footer': {
    Screen: FooterScreen,
    actions: [{ label: 'Ver tienda', href: '/' }],
  },
} satisfies Record<
  'contenido-legal' | 'contenido-footer',
  SectionScreenAdapter
>;
