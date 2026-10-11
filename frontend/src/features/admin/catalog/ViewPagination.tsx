import Link from 'next/link';
export function catalogViewPage<T>(rows: T[], requested = '1') {
  const pages = Math.max(1, Math.ceil(rows.length / 20));
  const parsed = /^\d{1,8}$/.test(requested) ? Number(requested) : 1;
  const page = Math.max(1, Math.min(pages, parsed));
  return { rows: rows.slice((page - 1) * 20, page * 20), page, pages, total: rows.length };
}
export function CatalogViewPagination({ path, page, pages, total, filters = {} }: { path: string; page: number; pages: number; total: number; filters?: Record<string, string> }) {
  function href(value: number) { const query = new URLSearchParams(filters); query.set('page', String(value)); return `${path}?${query}`; }
  return <nav aria-label="Páginas del catálogo" className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-4 text-sm"><span>{total} registros · Página {page} de {pages} · 20 por página</span><div className="flex gap-4">{page > 1 ? <Link className="text-[var(--color-industrial-yellow)] underline" href={href(page - 1)}>Anterior</Link> : null}{page < pages ? <Link className="text-[var(--color-industrial-yellow)] underline" href={href(page + 1)}>Siguiente</Link> : null}</div></nav>;
}
