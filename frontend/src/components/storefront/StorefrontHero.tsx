'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import * as Separator from '@radix-ui/react-separator';
import { motion } from 'framer-motion';
import { gsap } from 'gsap';
import { DistriToolsLogo } from '@/components/brand/DistriToolsLogo';
import { Badge } from '@/components/ui/Badge';
import { Button, buttonVariants } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';
import { siteConfig } from '@/config/site';

interface StorefrontHeroMetric {
  label: string;
  value: string;
  detail: string;
}

interface StorefrontHeroBrand {
  name: string;
  slug: string;
  summary: string;
}

interface StorefrontHeroProps {
  metrics: StorefrontHeroMetric[];
  featuredFamilies: string[];
  leadingBrands: StorefrontHeroBrand[];
}

export function StorefrontHero({
  metrics,
  featuredFamilies,
  leadingBrands,
}: StorefrontHeroProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const context = gsap.context(() => {
      gsap.fromTo(
        '[data-hero-card]',
        {
          y: 24,
          opacity: 0,
        },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: 'power3.out',
          stagger: 0.08,
          delay: 0.1,
        },
      );

      gsap.fromTo(
        '[data-hero-chip]',
        {
          y: 16,
          opacity: 0,
        },
        {
          y: 0,
          opacity: 1,
          duration: 0.45,
          ease: 'power2.out',
          stagger: 0.04,
          delay: 0.25,
        },
      );
    }, containerRef);

    return () => context.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[radial-gradient(circle_at_top_left,rgba(245,183,0,0.14),transparent_22%),radial-gradient(circle_at_92%_0%,rgba(31,111,235,0.10),transparent_28%),linear-gradient(140deg,#0b0b0b_0%,#070707_48%,#0e0e0f_100%)] p-8 text-[var(--color-off-white)] shadow-elevated lg:p-10"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:84px_84px] opacity-[0.08]" />

      <div className="relative grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-7">
          <motion.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="space-y-4"
          >
            <div className="space-y-4">
              <Badge variant="warning">DistriTools JL</Badge>
              <h1 className="max-w-4xl font-display text-4xl font-semibold leading-[0.95] tracking-tight sm:text-5xl">
                Herramientas, equipos y soluciones para construcción, mantenimiento e industria.
              </h1>
              <p className="max-w-xl text-base leading-7 text-[var(--color-text-secondary)]">
                Catálogo industrial limpio, marcas estratégicas y atención comercial directa.
              </p>
            </div>
          </motion.div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/storefront/productos">
              <Button size="lg" className="w-full sm:w-auto">
                Explorar catálogo
              </Button>
            </Link>
            <Link href="/storefront/marcas">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Ver marcas
              </Button>
            </Link>
            <a
              href={siteConfig.whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'w-full border-white/15 bg-white/5 sm:w-auto',
              )}
            >
              Asesoría comercial
            </a>
          </div>

          <div className="flex flex-wrap gap-3">
            {featuredFamilies.slice(0, 5).map((family) => (
              <motion.span
                key={family}
                data-hero-chip
                whileHover={{ y: -2, scale: 1.01 }}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-off-white)]"
              >
                {family}
              </motion.span>
            ))}
          </div>

          <div
            data-hero-card
            className="grid gap-4 rounded-[1.6rem] border border-white/8 bg-[rgba(255,255,255,0.03)] p-4 shadow-soft sm:grid-cols-3"
          >
            {metrics.map((metric, index) => (
              <div key={metric.label} className="flex min-w-0 items-start gap-4">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-industrial-yellow)]">
                    {metric.label}
                  </p>
                  <p className="text-3xl font-semibold text-white">{metric.value}</p>
                  <p className="max-w-[12rem] text-sm leading-6 text-[var(--color-text-secondary)]">
                    {metric.detail}
                  </p>
                </div>
                {index < metrics.length - 1 ? (
                  <Separator.Root
                    decorative
                    orientation="vertical"
                    className="hidden h-full w-px bg-white/10 sm:block"
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <motion.div
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
          className="grid gap-4"
        >
          <div
            data-hero-card
            className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-6 shadow-soft"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-industrial-yellow)]">Marcas destacadas</p>
            <div className="mt-4 grid gap-3">
              {leadingBrands.map((brand) => (
                <motion.div
                  key={brand.slug}
                  whileHover={{ y: -3 }}
                  className="rounded-2xl border border-white/8 bg-[rgba(0,0,0,0.22)] px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-white">{brand.name}</p>
                      <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
                        {brand.summary}
                      </p>
                    </div>
                    <Link
                      href={`/storefront/marcas/${brand.slug}`}
                      className="text-sm font-semibold text-[var(--color-industrial-yellow)]"
                    >
                      Ver
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div
            data-hero-card
            className="rounded-[1.6rem] border border-white/8 bg-[rgba(255,255,255,0.02)] p-6 shadow-soft"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--color-industrial-yellow)]">Proceso comercial</p>
            <div className="mt-4 grid gap-3">
              {[
                'Exploración simple por marca y familia.',
                'Acompañamiento comercial directo.',
                'Compra limpia y sin fricción.',
              ].map((point) => (
                <div
                  key={point}
                  className="rounded-2xl border border-white/8 bg-[rgba(5,5,5,0.32)] px-4 py-3 text-sm text-[rgba(249,249,249,0.9)]"
                >
                  {point}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
