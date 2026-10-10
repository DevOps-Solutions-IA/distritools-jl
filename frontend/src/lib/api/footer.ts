import { z } from 'zod';
import { apiRequest } from '@/lib/api/client';

import {
  STOREFRONT_ROUTE_QUERY_KEYS,
  STOREFRONT_QUERY_VALUES,
} from '@/lib/generated/storefront-route-registry';

const queryContracts: Readonly<Record<string, readonly string[]>> =
  STOREFRONT_ROUTE_QUERY_KEYS;
const queryValues: Readonly<Record<string, readonly string[]>> =
  STOREFRONT_QUERY_VALUES;

// Response defense only: existence/publication and dynamic filters are resolved by the backend.
// Query names and UI enum values come from the generated real-page contract, never a client whitelist.
function safeProjectedHref(href: string) {
  if (href.length > 2048 || /[\p{Cc}\p{Cf}#]/u.test(href)) return false;
  const question = href.indexOf('?');
  const pathname = question < 0 ? href : href.slice(0, question);
  if (
    /^\/(?:[A-Za-z0-9-]+(?:\/[A-Za-z0-9-]+)*)?$/.exec(pathname)?.[0] !==
    pathname
  )
    return false;
  if (question < 0) return true;
  const segments = pathname.split('/');
  const contract = Object.entries(queryContracts).find(([pattern]) => {
    const parts = pattern.split('/');
    return (
      parts.length === segments.length &&
      parts.every(
        (part, index) => part === '[slug]' || part === segments[index],
      )
    );
  });
  if (!contract) return false;
  const query = href.slice(question + 1);
  if (
    !query ||
    query.split('&').some((part) => !part || !/^[a-z]+(?:=|$)/.test(part))
  )
    return false;
  try {
    for (const part of query.split('&')) {
      // URLSearchParams tolerates malformed percent escapes; the projection guard does not.
      decodeURIComponent(part.replace(/\+/g, ' '));
    }
  } catch {
    return false;
  }
  const seen = new Set<string>();
  for (const [key, value] of new URLSearchParams(query)) {
    if (
      seen.has(key) ||
      !contract[1].includes(key) ||
      /[\p{Cc}\p{Cf}]/u.test(value)
    )
      return false;
    seen.add(key);
    const values = queryValues[key];
    if (values && value && !values.includes(value)) return false;
  }
  return true;
}
const internalHref = z
  .string()
  .refine(safeProjectedHref, 'Destino interno fuera del contrato público.');
const publicFooterSchema = z.object({
  version: z.number().int().nullable(),
  groups: z.array(
    z.object({
      title: z.string(),
      items: z.array(z.object({ label: z.string(), href: internalHref })),
    }),
  ),
});
export type PublicFooter = z.infer<typeof publicFooterSchema>;
export interface FooterGroup {
  title: string;
  links: Array<{ label: string; href: string; isVisible?: boolean }>;
}
export interface FooterRevisionInput {
  id?: string;
  status?: string;
  groupsJson?: unknown;
}

export async function getPublicFooter(): Promise<PublicFooter> {
  const response = await apiRequest<unknown>('/api/v1/content/footer', {
    cache: 'no-store',
  });
  return publicFooterSchema.parse(response.data);
}

export async function saveFooterGroups(
  groups: FooterGroup[],
  draftId?: string,
) {
  return adminFooterRequest(
    draftId
      ? `/api/admin/content/footer/${draftId}`
      : '/api/admin/content/footer',
    groups,
    draftId ? 'PATCH' : 'POST',
  );
}
export async function validateFooterGroups(groups: FooterGroup[]) {
  return adminFooterRequest(
    '/api/admin/content/footer/validate',
    groups,
    'POST',
  );
}
async function adminFooterRequest(
  path: string,
  groups: FooterGroup[],
  method: 'PATCH' | 'POST',
) {
  const response = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groups }),
    cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? payload.message
        : null;
    throw new Error(
      typeof message === 'string'
        ? message
        : `No fue posible validar o guardar el footer (${response.status}).`,
    );
  }
  return payload;
}
