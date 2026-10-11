import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

export const buttonVariants = cva(
  'focus-ring inline-flex items-center justify-center gap-2 rounded-md font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--color-industrial-yellow)] text-[#111111] hover:bg-[var(--color-action-primary-hover)]',
        secondary:
          'bg-[var(--color-deep-charcoal)] text-[var(--color-off-white)] hover:bg-[var(--color-action-secondary-hover)]',
        outline:
          'border border-[var(--color-border)] bg-transparent text-[var(--color-off-white)] hover:border-[var(--color-industrial-yellow)] hover:bg-white/5',
        ghost:
          'bg-transparent text-[var(--color-off-white)] hover:bg-white/8',
        danger:
          'bg-[var(--color-error-red)] text-[var(--color-off-white)] hover:bg-[#b91c1c]',
      },
      size: {
        sm: 'h-9 px-3 text-sm',
        md: 'h-11 px-4 text-sm',
        lg: 'h-12 px-5 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading}
      data-admin-tone={variant}
      {...props}
    >
      {loading ? (
        <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      <span>{children}</span>
    </button>
  );
}
