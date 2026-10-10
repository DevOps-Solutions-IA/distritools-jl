import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { STOREFRONT_PUBLIC_ROUTES, STOREFRONT_ROUTE_QUERY_KEYS, STOREFRONT_QUERY_VALUES } from './storefront-route-registry';

export type FooterRouteClient = Pick<Prisma.TransactionClient, 'product' | 'category' | 'brand'>;
export interface FooterRouteInspection { valid: boolean; reason: string }
export interface FooterRouteGroup { links: readonly { href: string }[] }

// Bounds database lookups and public projection, including legacy revisions.
export const FOOTER_LINK_LIMIT = 1000;

const staticRoutes = new Set<string>(STOREFRONT_PUBLIC_ROUTES.filter((route) => !route.includes('[')));
const dynamicRoutes = STOREFRONT_PUBLIC_ROUTES.filter((route) => route.includes('['));
const queryKeys: Readonly<Record<string, readonly string[]>> = STOREFRONT_ROUTE_QUERY_KEYS;
const queryValues: Readonly<Record<string, readonly string[]>> = STOREFRONT_QUERY_VALUES;
const validResource: FooterRouteInspection = { valid: true, reason: 'Recurso público existente y activo.' };
const invalidResource: FooterRouteInspection = { valid: false, reason: 'El recurso no existe o no está activo/publicado.' };

export async function inspectFooterHref(client: FooterRouteClient, href: string): Promise<FooterRouteInspection> {
  // Literal path authority: do not normalize/URL-decode manipulated path segments.
  if (typeof href !== 'string' || href.length > 2048 || /[\p{Cc}\p{Cf}#]/u.test(href)) {
    return { valid: false, reason: 'Ruta interna manipulada o sintaxis no permitida.' };
  }
  const queryAt = href.indexOf('?');
  const pathname = queryAt === -1 ? href : href.slice(0, queryAt);
  const rawQuery = queryAt === -1 ? null : href.slice(queryAt + 1);
  if (/^\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/i.exec(pathname)?.[0] !== pathname) {
    return { valid: false, reason: 'Ruta interna manipulada o sintaxis no permitida.' };
  }
  const segments = pathname.slice(1).split('/');
  const matched = staticRoutes.has(pathname) ? pathname : dynamicRoutes.find((route) => {
    const pattern = route.slice(1).split('/');
    return pattern.length === segments.length && pattern.every((part, index) => part === '[slug]' || part === segments[index]);
  });
  if (!matched) return { valid: false, reason: 'La ruta no existe en el storefront público.' };

  const filters: { kind: 'brand' | 'category'; slug: string }[] = [];
  if (rawQuery !== null) {
    const invalidQuery: FooterRouteInspection = { valid: false, reason: 'Parámetros de ruta no permitidos o manipulados.' };
    if (!rawQuery || rawQuery.split('&').some((pair) => !pair || !/^[a-z]+(?:=|$)/.test(pair))) return invalidQuery;
    // URLSearchParams alone tolerates invalid percent escapes/UTF8; refuse them first.
    try { decodeURIComponent(rawQuery.replace(/\+/g, ' ')); } catch { return invalidQuery; }
    const params = new URLSearchParams(rawQuery);
    const seen = new Set<string>();
    for (const [key, value] of params) {
      if (seen.has(key) || !(queryKeys[matched] ?? []).includes(key) || /[\p{Cc}\p{Cf}]/u.test(value)) return invalidQuery;
      seen.add(key);
      switch (key) {
        case 'q': break; // Safe bounded search data, including percent-encoded UTF8; never a redirect destination.
        case 'brand':
        case 'category':
          if (!/^[a-z0-9-]*$/i.test(value)) return invalidQuery;
          if (value) filters.push({ kind: key, slug: value });
          break;
        case 'status':
        case 'sort':
          if (value && !(queryValues[key] ?? []).includes(value)) return invalidQuery;
          break;
        default: return invalidQuery;
      }
    }
  }

  if (!staticRoutes.has(matched)) {
    const pattern = matched.slice(1).split('/');
    const canonical = pattern[0] === 'storefront' ? pattern.slice(1) : pattern;
    if (canonical.length !== 2 || canonical[1] !== '[slug]') {
      return { valid: false, reason: 'La ruta dinámica no tiene un recurso público autorizado.' };
    }
    const slug = segments[segments.length - 1];
    // Existing public catalog semantics are existence + isActive. Stock/pricing/sellability are separate.
    const select = { isActive: true } as const;
    let resource: { isActive: boolean } | null;
    switch (canonical[0]) {
      case 'productos': resource = await client.product.findUnique({ where: { slug }, select }); break;
      case 'categorias': resource = await client.category.findUnique({ where: { slug }, select }); break;
      case 'marcas': resource = await client.brand.findUnique({ where: { slug }, select }); break;
      default: return { valid: false, reason: 'La ruta dinámica no tiene un recurso público autorizado.' };
    }
    if (resource?.isActive !== true) return { ...invalidResource };
  }
  for (const filter of filters) {
    const resource = filter.kind === 'brand'
      ? await client.brand.findUnique({ where: { slug: filter.slug }, select: { isActive: true } })
      : await client.category.findUnique({ where: { slug: filter.slug }, select: { isActive: true } });
    if (resource?.isActive !== true) return { ...invalidResource };
  }
  return staticRoutes.has(matched) && !filters.length ? { valid: true, reason: 'Ruta pública existente.' } : { ...validResource };
}

export async function assertFooterRoutes(client: FooterRouteClient, groups: readonly FooterRouteGroup[]): Promise<void> {
  if (!Array.isArray(groups)) throw new BadRequestException('Los grupos de footer son obligatorios.');
  let linkCount = 0;
  for (const [groupIndex, group] of groups.entries()) {
    if (!group || !Array.isArray(group.links)) throw new BadRequestException(`El grupo ${groupIndex + 1} requiere enlaces válidos.`);
    linkCount += group.links.length;
    if (linkCount > FOOTER_LINK_LIMIT) throw new BadRequestException(`El footer supera el límite técnico de ${FOOTER_LINK_LIMIT} enlaces.`);
  }
  for (const [groupIndex, group] of groups.entries()) {
    for (const [linkIndex, link] of group.links.entries()) {
      const result = await inspectFooterHref(client, link?.href);
      if (!result.valid) throw new BadRequestException(`Footer grupo ${groupIndex + 1}, enlace ${linkIndex + 1}: ${result.reason}`);
    }
  }
}
