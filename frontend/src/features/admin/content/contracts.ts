import { z } from 'zod';

export const contentStatusSchema = z.enum([
  'draft',
  'pending_legal_review',
  'approved',
  'published',
  'archived',
]);
export type ContentStatus = z.infer<typeof contentStatusSchema>;
export const statusLabel: Record<ContentStatus, string> = {
  draft: 'Borrador',
  pending_legal_review: 'En revisión',
  approved: 'Aprobado',
  published: 'Publicado',
  archived: 'Archivado',
};
const baseSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  status: contentStatusSchema,
  publishedAt: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
  submittedAt: z.string().nullable().optional(),
  approvedAt: z.string().nullable().optional(),
  submittedById: z.string().nullable().optional(),
  approvedById: z.string().nullable().optional(),
  publishedById: z.string().nullable().optional(),
});
export const legalRowSchema = baseSchema.extend({
  pageKey: z.string(),
  title: z.string(),
  slug: z.string(),
  checklistComplete: z.boolean().optional(),
});
export const legalRevisionSchema = legalRowSchema.extend({
  content: z.unknown(),
  checklist: z.record(z.boolean()).nullable(),
});
export const legalListSchema = z.object({ data: z.array(legalRowSchema) });
export const legalDetailSchema = z.object({
  pageKey: z.string(),
  history: z.array(legalRevisionSchema),
  requirements: z.array(z.string()),
  published: legalRevisionSchema.nullable(),
  draft: legalRevisionSchema,
});
export const footerGroupSchema = z.object({
  title: z.string(),
  links: z.array(
    z.object({
      label: z.string(),
      href: z.string(),
      isVisible: z.boolean().optional(),
    }),
  ),
});
export const footerRevisionSchema = baseSchema.extend({
  groupsJson: z.array(footerGroupSchema),
  links: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      href: z.string(),
      isVisible: z.boolean(),
    }),
  ),
});
export const footerSnapshotSchema = z.object({
  data: footerRevisionSchema.nullable(),
  published: footerRevisionSchema.nullable(),
  history: z.array(footerRevisionSchema),
  requiresReview: z.boolean(),
  routeAlerts: z.array(
    z.object({
      id: z.string(),
      createdAt: z.string(),
      version: z.number(),
      invalidLinks: z.array(
        z.object({ linkId: z.string(), reason: z.string() }),
      ),
    }),
  ),
});
export type LegalRow = z.infer<typeof legalRowSchema>;
export function legalDocuments(rows: readonly LegalRow[]): LegalRow[] {
  const documents = new Map<string, LegalRow>();
  for (const row of rows) {
    const current = documents.get(row.pageKey);
    if (!current || row.version > current.version)
      documents.set(row.pageKey, row);
  }
  return [...documents.values()];
}
export const footerValidationSchema = z.object({ valid: z.literal(true) });
export type LegalDetail = z.infer<typeof legalDetailSchema>;
export type LegalRevision = z.infer<typeof legalRevisionSchema>;
export type FooterSnapshot = z.infer<typeof footerSnapshotSchema>;
export type FooterRevision = z.infer<typeof footerRevisionSchema>;
export type Step = 'submit-review' | 'approve' | 'publish';
export const stepLabel: Record<Step, string> = {
  'submit-review': 'Enviar a revisión',
  approve: 'Aprobar versión',
  publish: 'Publicar versión',
};
export function editable(status: ContentStatus) {
  return status === 'draft' || status === 'pending_legal_review';
}
export function permittedSteps(
  domain: 'legal' | 'footer',
  status: ContentStatus,
  permissions: readonly string[],
): Step[] {
  const can = (permission: string) =>
    permissions.includes(`${domain}.${permission}`);
  const steps: Step[] = [];
  if (status === 'draft' && can(domain === 'legal' ? 'review' : 'write'))
    steps.push('submit-review');
  if (
    (status === 'draft' || status === 'pending_legal_review') &&
    can(domain === 'legal' ? 'approve' : 'publish')
  )
    steps.push('approve');
  if (status === 'approved' && can('publish')) steps.push('publish');
  return steps;
}
