import { describe, expect, it } from 'vitest';
import {
  legalDetailSchema,
  footerSnapshotSchema,
  permittedSteps,
  editable,
  legalDocuments,
} from '@/features/admin/content/contracts';

describe('CONTENT persisted contracts and capabilities', () => {
  it('shows the latest document title without an older revision overwriting it', () => {
    const old = {
      id: 'old',
      version: 1,
      status: 'published' as const,
      pageKey: 'privacy',
      title: 'Old title',
      slug: 'privacy',
    };
    const latest = {
      ...old,
      id: 'new',
      version: 2,
      status: 'draft' as const,
      title: 'Latest title',
    };
    expect(legalDocuments([latest, old])).toEqual([latest]);
    expect(legalDocuments([old, latest])).toEqual([latest]);
  });
  it('requires actual status/version/id and never accepts legacy flags as workflow', () => {
    expect(
      legalDetailSchema.safeParse({
        history: [{ id: 'a', workflowStatus: 'approved', isPublished: true }],
      }).success,
    ).toBe(false);
    expect(
      footerSnapshotSchema.safeParse({
        data: { id: 'a', status: 'ready' },
        history: [],
      }).success,
    ).toBe(false);
  });
  it('keeps approved, published and archived immutable and follows distinct backend phase permissions', () => {
    expect(editable('approved')).toBe(false);
    expect(editable('published')).toBe(false);
    expect(editable('archived')).toBe(false);
    expect(editable('pending_legal_review')).toBe(true);
    expect(permittedSteps('legal', 'draft', ['legal.write'])).toEqual([]);
    expect(permittedSteps('legal', 'draft', ['legal.review'])).toEqual([
      'submit-review',
    ]);
    expect(permittedSteps('legal', 'approved', ['legal.approve'])).toEqual([]);
    expect(
      permittedSteps('footer', 'pending_legal_review', ['footer.publish']),
    ).toEqual(['approve']);
    expect(permittedSteps('footer', 'approved', ['footer.publish'])).toEqual([
      'publish',
    ]);
    expect(permittedSteps('legal', 'published', ['legal.publish'])).toEqual([]);
  });
  it('preserves independently published footer and latest revision instead of conflating versions', () => {
    const row = {
      id: 'a',
      version: 4,
      status: 'draft',
      groupsJson: [],
      links: [],
    };
    const published = {
      ...row,
      id: 'p',
      version: 2,
      status: 'published',
      publishedAt: '2026-10-11T00:00:00Z',
    };
    const parsed = footerSnapshotSchema.parse({
      data: row,
      published,
      history: [row, published],
      routeAlerts: [],
      requiresReview: false,
    });
    expect(parsed.data?.version).toBe(4);
    expect(parsed.published?.version).toBe(2);
  });
});
