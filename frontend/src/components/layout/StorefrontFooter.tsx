'use client';

import Link from 'next/link';
import { DistriToolsLogo } from '@/components/brand/DistriToolsLogo';
import { useEffect, useState } from 'react';
import { getPublicFooter, type PublicFooter } from '@/lib/api/footer';

export function StorefrontFooter() {
  const [footerLinks, setFooterLinks] = useState<PublicFooter['groups']>([]);
  useEffect(() => {
    let active = true;
    let sequence = 0;
    const refresh = () => {
      const request = ++sequence;
      setFooterLinks([]);
      getPublicFooter()
        .then((footer) => {
          if (active && request === sequence) setFooterLinks(footer.groups);
        })
        .catch(() => {
          if (active && request === sequence) setFooterLinks([]);
        });
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return (
    <footer className="mt-10 border-t border-[var(--color-border)] bg-[#050505] sm:mt-16 lg:mt-20">
      <div className="enterprise-grid grid gap-6 py-7 sm:gap-10 sm:py-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="space-y-2 sm:space-y-3">
          <DistriToolsLogo
            size="sm"
            tone="dark"
            className="h-8 w-[10rem] max-w-full sm:h-11 sm:w-[14rem]"
          />
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-industrial-yellow)]">
            Herramientas que construyen resultados
          </p>
          <p className="max-w-md text-sm leading-6 text-[var(--color-text-secondary)] sm:leading-7">
            Soluciones para industria, mantenimiento, construcción y operación
            técnica.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-8">
          {footerLinks.map((group) => (
            <div key={group.title} className="space-y-3 sm:space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-industrial-yellow)]">
                {group.title}
              </h3>
              <div className="grid gap-3">
                {group.items.map((item) => (
                  <Link
                    key={`${item.label}:${item.href}`}
                    href={item.href}
                    prefetch={false}
                    className="text-sm text-[var(--color-text-secondary)] transition hover:text-[var(--color-off-white)]"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="enterprise-grid border-t border-white/6 py-4 text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)] sm:py-5">
        DistriTools JL
      </div>
    </footer>
  );
}
