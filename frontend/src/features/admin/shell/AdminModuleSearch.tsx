'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { AdminModuleConfig } from '@/lib/admin/transport/navigation';

function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
}

/** Searches only destinations already authorized by the verified session. */
export function AdminModuleSearch({ modules }: { modules: AdminModuleConfig[] }) {
  const router = useRouter();
  const id = React.useId();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const normalized = normalize(query);
  const results = normalized ? modules.filter((item) => normalize(`${item.title} ${item.description}`).includes(normalized)) : [];
  const visible = open && normalized.length > 0;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!normalized) { inputRef.current?.focus(); return; }
    setOpen(true);
    if (results.length === 1) {
      router.push(results[0].href);
      setOpen(false);
    }
  }

  return (
    <form role="search" aria-label="Buscar módulos administrativos" className="admin-module-search" onSubmit={submit}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); inputRef.current?.focus(); setOpen(false); }
        if (event.key === 'ArrowDown' && event.target === inputRef.current && visible) {
          event.preventDefault(); resultsRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
        }
      }}>
      <label htmlFor={id} className="sr-only">Buscar módulo</label>
      <div className="admin-search-control">
        <input ref={inputRef} id={id} type="search" value={query} placeholder="Buscar módulo" autoComplete="off"
          aria-describedby={`${id}-status`} aria-controls={visible ? `${id}-results` : undefined}
          onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} />
        <button type="submit" aria-label="Buscar módulo"><span aria-hidden="true">↵</span></button>
      </div>
      <p id={`${id}-status`} role="status" className={visible ? 'admin-search-summary' : 'sr-only'}>
        {!normalized ? 'Busca un módulo disponible para tu sesión.' : !results.length ? 'Sin resultados. Prueba otro nombre de módulo.' : `${results.length} ${results.length === 1 ? 'módulo disponible' : 'módulos disponibles'}.`}
      </p>
      {visible && results.length > 0 ? (
        <div id={`${id}-results`} ref={resultsRef} className="admin-search-results">
          <ul aria-label="Resultados de módulos">
            {results.map((item) => <li key={item.key}><Link href={item.href} onClick={() => setOpen(false)}>{item.title}<span aria-hidden="true">→</span></Link></li>)}
          </ul>
        </div>
      ) : null}
    </form>
  );
}
