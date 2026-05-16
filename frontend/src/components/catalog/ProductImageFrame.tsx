import Image from 'next/image';
import type { CatalogProduct } from '@/features/catalog/types';
import { cn } from '@/lib/utils/cn';
import { getProductPlaceholderImages } from '@/lib/product-placeholder-image';

interface ProductImageFrameProps {
  product: CatalogProduct;
  priority?: boolean;
  compact?: boolean;
  className?: string;
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

  const placeholders = !imagePath ? getProductPlaceholderImages(product) : [];
  const placeholderSrc = placeholders.length > 0 ? placeholders[0].src : null;
  const placeholderAlt = placeholders.length > 0 ? placeholders[0].alt : 'Imagen de producto pendiente';

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
      ) : placeholderSrc ? (
        <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
          <Image
            src={placeholderSrc}
            alt={placeholderAlt}
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 33vw, 90vw"
            priority={priority}
            className="object-contain p-4 md:p-6"
          />
        </div>
      ) : (
        <div
          aria-label="Imagen de producto pendiente"
          className="absolute inset-0 flex items-center justify-center px-4 text-center md:px-8"
        >
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[rgba(245,183,0,0.28)] bg-[rgba(245,183,0,0.08)] shadow-[0_24px_80px_rgba(245,183,0,0.14)] md:h-20 md:w-20">
            <span className="text-lg font-bold text-[var(--color-industrial-yellow)] md:text-2xl">?</span>
          </div>
        </div>
      )}
      {!imagePath && placeholderSrc ? (
        <div className="absolute bottom-1.5 right-2.5 rounded-full bg-[rgba(0,0,0,0.6)] px-2 py-0.5 text-[9px] font-medium text-white/50">
          Imagen referencial
        </div>
      ) : null}
    </div>
  );
}
