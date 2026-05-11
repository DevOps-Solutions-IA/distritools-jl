import Link from 'next/link';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Button, buttonVariants } from '@/components/ui/Button';
import { cn } from '@/lib/utils/cn';

type StorefrontButtonVariant = 'primary' | 'secondary' | 'ghost';
type StorefrontButtonSize = 'compact' | 'default' | 'large';

const variantClass: Record<StorefrontButtonVariant, string> = {
  primary:
    'rounded-full bg-[var(--color-industrial-yellow)] text-[#111111] hover:bg-[var(--color-action-primary-hover)]',
  secondary:
    'rounded-full border border-white/15 bg-white/[0.055] text-[var(--color-off-white)] hover:border-[var(--color-industrial-yellow)] hover:bg-white/10',
  ghost:
    'rounded-full bg-transparent text-[var(--color-off-white)] hover:bg-white/8',
};

const sizeClass: Record<StorefrontButtonSize, string> = {
  compact: 'h-10 px-4 text-sm',
  default: 'h-11 px-5 text-sm',
  large: 'h-12 px-5 text-base',
};

interface StorefrontButtonProps
  extends Omit<ComponentPropsWithoutRef<typeof Button>, 'variant' | 'size'> {
  storefrontVariant?: StorefrontButtonVariant;
  storefrontSize?: StorefrontButtonSize;
}

interface StorefrontLinkButtonProps
  extends Omit<ComponentPropsWithoutRef<typeof Link>, 'className'> {
  children: ReactNode;
  className?: string;
  storefrontVariant?: StorefrontButtonVariant;
  storefrontSize?: StorefrontButtonSize;
}

export function storefrontButtonClassName({
  variant = 'primary',
  size = 'default',
  className,
}: {
  variant?: StorefrontButtonVariant;
  size?: StorefrontButtonSize;
  className?: string;
}) {
  return cn(
    buttonVariants({ variant: variant === 'primary' ? 'primary' : 'ghost', size: 'md' }),
    variantClass[variant],
    sizeClass[size],
    'font-semibold',
    className,
  );
}

export function StorefrontButton({
  storefrontVariant = 'primary',
  storefrontSize = 'default',
  className,
  ...props
}: StorefrontButtonProps) {
  return (
    <Button
      className={storefrontButtonClassName({
        variant: storefrontVariant,
        size: storefrontSize,
        className,
      })}
      {...props}
    />
  );
}

export function StorefrontLinkButton({
  storefrontVariant = 'primary',
  storefrontSize = 'default',
  className,
  children,
  ...props
}: StorefrontLinkButtonProps) {
  return (
    <Link
      className={storefrontButtonClassName({
        variant: storefrontVariant,
        size: storefrontSize,
        className,
      })}
      {...props}
    >
      {children}
    </Link>
  );
}
