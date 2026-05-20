import type { CatalogProduct } from '@/features/catalog/types';
import { cn } from '@/lib/utils/cn';
import { getProductPlaceholderImages } from '@/lib/product-placeholder-image';
import { ProductImageLightbox } from '@/components/catalog/ProductImageLightbox';

interface ProductImageFrameProps {
  product: CatalogProduct;
  priority?: boolean;
  compact?: boolean;
  className?: string;
}

function getProductImages(product: CatalogProduct) {
  const approvedImagePath =
    product.image.status === 'approved' && product.image.assetPath
      ? product.image.assetPath
      : null;

  const sku = product.primarySku ?? '';
  const localImagePath = sku ? `/products/${sku}.jpg` : null;
  const imagePath = approvedImagePath ?? localImagePath;

  if (imagePath) {
    return [{
      src: imagePath,
      alt: product.name,
      isPlaceholder: false,
      badgeLabel: approvedImagePath ? null : 'Imagen de catálogo',
    }];
  }

  const placeholders = getProductPlaceholderImages(product);
  if (placeholders.length > 0) {
    return [{
      src: placeholders[0].src,
      alt: placeholders[0].alt,
      isPlaceholder: true,
      badgeLabel: 'Imagen referencial',
    }];
  }

  return [];
}

export function ProductImageFrame({
  product,
  className,
}: ProductImageFrameProps) {
  const images = getProductImages(product).slice(0, 4);
  const hasImage = images.length > 0;
  const imageBadgeLabel = images[0]?.badgeLabel ?? null;

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden rounded-[1.15rem] border border-white/10 bg-[radial-gradient(circle_at_50%_10%,rgba(245,183,0,0.20),rgba(255,255,255,0.045)_38%,rgba(0,0,0,0.42)_100%)] md:rounded-[1.35rem]',
        'min-h-[300px] sm:min-h-[380px] lg:min-h-[440px]',
        'flex items-center justify-center',
        className,
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.055),transparent_42%,rgba(245,183,0,0.06))]" />
      <div className="absolute inset-x-8 bottom-5 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

      {hasImage ? (
        <div className="relative z-10 w-full h-full">
          <ProductImageLightbox images={images} />
        </div>
      ) : (
        <div
          aria-label="Imagen de producto pendiente"
          className="relative z-10 w-full h-full flex items-center justify-center"
        >
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[rgba(245,183,0,0.28)] bg-[rgba(245,183,0,0.08)] shadow-[0_24px_80px_rgba(245,183,0,0.14)] md:h-20 md:w-20">
            <span className="text-lg font-bold text-[var(--color-industrial-yellow)] md:text-2xl">?</span>
          </div>
        </div>
      )}

      {imageBadgeLabel ? (
        <div className="absolute bottom-2 left-2.5 z-10 rounded-full bg-[rgba(0,0,0,0.6)] px-2 py-0.5 text-[9px] font-medium text-white/50">
          {imageBadgeLabel}
        </div>
      ) : null}
    </div>
  );
}
