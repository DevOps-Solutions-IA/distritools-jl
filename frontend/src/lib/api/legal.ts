import { z } from 'zod';
import { env } from '@/config/env';

const contentSchema = z.object({
  sections: z.array(z.object({ title: z.string(), body: z.string() })).optional(),
  text: z.string().optional(),
  notice: z.string().optional(),
}).passthrough().refine((content) =>
  content.sections !== undefined || content.text !== undefined || content.notice !== undefined,
);

const publicationSchema = z.object({
  pageKey: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  version: z.number().int().positive(),
  content: contentSchema,
  publishedAt: z.string().datetime({ offset: true }),
}).strict();

export type PublishedLegalDocument = z.infer<typeof publicationSchema>;
export type PublicLegalResult =
  | { status: 'published'; document: PublishedLegalDocument }
  | { status: 'missing' }
  | { status: 'unavailable' };

export async function getPublishedLegal(pageKey: string): Promise<PublicLegalResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${env.apiBaseUrl}/api/v1/content/legal/${encodeURIComponent(pageKey)}`, {
      method: 'GET', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) return { status: 'missing' };
    if (!response.ok) return { status: 'unavailable' };
    const parsed = publicationSchema.safeParse(await response.json());
    if (!parsed.success || parsed.data.pageKey !== pageKey) return { status: 'unavailable' };
    return { status: 'published', document: parsed.data };
  } catch {
    return { status: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}
