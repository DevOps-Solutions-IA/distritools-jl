import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

type LogoVariant = 'horizontal' | 'mark';
type LogoTone = 'light' | 'dark';
type LogoSize = 'sm' | 'md' | 'lg';

interface DistriToolsLogoProps {
  className?: string;
  compact?: boolean;
  variant?: LogoVariant;
  tone?: LogoTone;
  size?: LogoSize;
  priority?: boolean;
}

const logoAssetMap: Record<
  LogoVariant,
  Record<LogoTone, { src: string; width: number; height: number }>
> = {
  horizontal: {
    light: {
      src: '/brand/distritools-logo-horizontal-clean.svg',
      width: 960,
      height: 220,
    },
    dark: {
      src: '/brand/distritools-logo-horizontal-dark.svg',
      width: 960,
      height: 220,
    },
  },
  mark: {
    light: {
      src: '/brand/distritools-logo-mark.svg',
      width: 240,
      height: 240,
    },
    dark: {
      src: '/brand/distritools-logo-mark-simple.svg',
      width: 240,
      height: 240,
    },
  },
};

const sizeClassMap: Record<LogoVariant, Record<LogoSize, string>> = {
  horizontal: {
    sm: 'h-9 w-[170px]',
    md: 'h-12 w-[230px]',
    lg: 'h-16 w-[300px]',
  },
  mark: {
    sm: 'h-10 w-10',
    md: 'h-16 w-16',
    lg: 'h-24 w-24',
  },
};

export function DistriToolsLogo({
  className,
  compact = false,
  variant = 'horizontal',
  tone = 'light',
  size = 'md',
  priority = false,
}: DistriToolsLogoProps) {
  const resolvedVariant = compact ? 'horizontal' : variant;
  const resolvedSize = compact && size === 'md' ? 'sm' : size;
  const asset = logoAssetMap[resolvedVariant]?.[tone];

  if (!asset) {
    return (
      <span
        className={cn(
          'inline-flex items-center font-display text-lg font-semibold tracking-tight text-[var(--color-off-white)]',
          className,
        )}
      >
        DistriTools JL
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center',
        sizeClassMap[resolvedVariant][resolvedSize],
        className,
      )}
      aria-label="DistriTools JL"
    >
      <Image
        src={asset.src}
        alt="DistriTools JL"
        width={asset.width}
        height={asset.height}
        unoptimized
        priority={priority}
        className="h-full w-full object-contain"
      />
      <span className="sr-only">DistriTools JL</span>
    </span>
  );
}
