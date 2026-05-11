'use client';

import { useId, useState } from 'react';
import { cn } from '@/lib/utils/cn';

interface ProductDetailAccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function ProductDetailAccordion({
  title,
  children,
  defaultOpen = false,
}: ProductDetailAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <section className="rounded-[1.15rem] border border-white/10 bg-white/[0.025]">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className="focus-ring flex w-full items-center justify-between gap-4 rounded-[1.15rem] px-4 py-3 text-left text-base font-semibold text-[var(--color-off-white)] sm:px-5 sm:py-4 sm:text-lg"
      >
        <span>{title}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={cn(
            'h-5 w-5 flex-none text-[var(--color-industrial-yellow)] transition-transform duration-200',
            open ? 'rotate-180' : 'rotate-0',
          )}
          fill="none"
        >
          <path
            d="m5 7.5 5 5 5-5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        id={id}
        hidden={!open}
        className="px-4 pb-4 data-[open=true]:animate-[accordionFade_180ms_ease-out] sm:px-5 sm:pb-5"
        data-open={open}
      >
        {children}
      </div>
    </section>
  );
}
