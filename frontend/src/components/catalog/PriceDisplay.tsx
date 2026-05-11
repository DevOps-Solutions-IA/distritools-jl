import { cn } from '@/lib/utils/cn';

interface PriceDisplayProps {
  priceLabel?: string | null;
  mode?: 'card' | 'pdp' | 'cart' | 'checkout' | 'confirmation';
  className?: string;
}

const fallbackByMode = {
  card: 'No publicable',
  pdp: 'No publicable',
  cart: 'Por cotizar',
  checkout: 'Pendiente de confirmación',
  confirmation: 'Por confirmar',
} satisfies Record<NonNullable<PriceDisplayProps['mode']>, string>;

export function PriceDisplay({
  priceLabel,
  mode = 'card',
  className,
}: PriceDisplayProps) {
  const value = priceLabel && priceLabel.trim() ? priceLabel : fallbackByMode[mode];

  return (
    <span className={cn('whitespace-nowrap font-semibold text-[var(--color-off-white)]', className)}>
      {value}
    </span>
  );
}
