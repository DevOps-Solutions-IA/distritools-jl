import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em]',
  {
    variants: {
      variant: {
        default: 'bg-[rgba(249,115,22,0.14)] text-[var(--color-industrial-orange)]',
        success: 'bg-[rgba(22,163,74,0.14)] text-[var(--color-success-green)]',
        warning: 'bg-[rgba(245,158,11,0.14)] text-[var(--color-amber-highlight)]',
        danger: 'bg-[rgba(220,38,38,0.14)] text-[var(--color-error-red)]',
        info: 'bg-[rgba(37,99,235,0.14)] text-[var(--color-info-blue)]',
        neutral: 'bg-white/8 text-[var(--color-off-white)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
