import Image from 'next/image';
import type { CatalogProduct } from '@/features/catalog/types';
import { cn } from '@/lib/utils/cn';

interface ProductImageFrameProps {
  product: CatalogProduct;
  priority?: boolean;
  compact?: boolean;
  className?: string;
}

function getCategoryMark(product: CatalogProduct) {
  const slug = product.category?.slug ?? '';

  if (slug.includes('soldadura')) {
    return 'M12 27h16l3-6H9l3 6Zm1-16h14l2 7H11l2-7Zm-4 7h22';
  }

  if (slug.includes('compresores') || slug.includes('aire')) {
    return 'M8 23c0-5 4-9 9-9h6c5 0 9 4 9 9v2H8v-2Zm7 2v6m10-6v6M13 31h14';
  }

  if (slug.includes('fijacion') || slug.includes('clavadoras') || slug.includes('grapadoras')) {
    return 'M10 13h12l8 8v6H10V13Zm12 0v8h8M14 27v5m12-5v5';
  }

  return 'M10 25h9l11-11 4 4-11 11v4H10v-8Zm4 4h7M29 11l2-2 4 4-2 2';
}

export function ProductImageFrame({
  product,
  priority = false,
  compact = false,
  className,
}: ProductImageFrameProps) {
  const imagePath =
    product.image.status === 'approved' && product.image.assetPath
      ? product.image.assetPath
      : null;

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-[1.15rem] border border-white/10 bg-[radial-gradient(circle_at_50%_10%,rgba(245,183,0,0.20),rgba(255,255,255,0.045)_38%,rgba(0,0,0,0.42)_100%)] md:rounded-[1.35rem]',
        compact ? 'aspect-[1.22]' : 'aspect-[1.08]',
        className,
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.055),transparent_42%,rgba(245,183,0,0.06))]" />
      <div className="absolute inset-x-8 bottom-5 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      {imagePath ? (
        <Image
          src={imagePath}
          alt={product.name}
          fill
          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 33vw, 90vw"
          priority={priority}
          className="object-contain p-7 transition duration-500 group-hover:scale-[1.035]"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center md:gap-4 md:px-8">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[rgba(245,183,0,0.28)] bg-[rgba(245,183,0,0.08)] shadow-[0_24px_80px_rgba(245,183,0,0.14)] md:h-20 md:w-20">
            <svg aria-hidden="true" viewBox="0 0 44 44" className="h-8 w-8 text-[var(--color-industrial-yellow)] md:h-10 md:w-10" fill="none">
              <path d={getCategoryMark(product)} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="hidden space-y-1 md:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
              {product.category?.name ?? 'Producto'}
            </p>
            {product.brand ? (
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-industrial-yellow)]">
                {product.brand.name}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
