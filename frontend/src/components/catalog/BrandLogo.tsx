import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import type { CatalogBrand } from '@/features/catalog/types';

const partnerLogoMap: Record<string, string> = {
  'ingersoll-rand': '/brand/partners/ingersoll-rand.svg',
  bea: '/brand/partners/bea.svg',
  pretul: '/brand/partners/pretul.svg',
  truper: '/brand/partners/truper.svg',
  total: '/brand/partners/total.svg',
  senco: '/brand/partners/senco.svg',
  'lincoln-electric': '/brand/partners/lincoln-electric.svg',
};

interface BrandLogoProps {
  brand: CatalogBrand;
  className?: string;
  compact?: boolean;
  decorative?: boolean;
}

export function BrandLogo({
  brand,
  className,
  compact = false,
  decorative = false,
}: BrandLogoProps) {
  const assetPath = brand.metadata?.logo.assetPath ?? partnerLogoMap[brand.slug] ?? null;

  return (
    <Link
      href={`/storefront/marcas/${brand.slug}`}
      aria-label={decorative ? undefined : `Ver marca ${brand.name}`}
      aria-hidden={decorative}
      tabIndex={decorative ? -1 : undefined}
      className={cn(
        'group relative flex h-[5.5rem] min-w-[15rem] items-center justify-center rounded-[1.6rem] border border-white/8 bg-[rgba(255,255,255,0.025)] px-6 transition duration-300 hover:border-white/16 hover:bg-[rgba(255,255,255,0.05)]',
        compact && 'h-[5rem] min-w-[13rem] rounded-[1.35rem] px-5',
        className,
      )}
    >
      <div className="absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),transparent_60%)] opacity-0 transition duration-300 group-hover:opacity-100" />
      {assetPath ? (
        <span className={cn('relative h-12 w-[12.5rem]', compact && 'h-10 w-[11rem]')}>
          <Image
            src={assetPath}
            alt={brand.name}
            fill
            sizes="220px"
            unoptimized
            className="object-contain opacity-80 grayscale transition duration-300 group-hover:opacity-100"
          />
        </span>
      ) : (
        <span className="relative text-center text-lg font-semibold uppercase tracking-[0.32em] text-[#c5c9d3] transition duration-300 group-hover:text-white">
          {brand.name}
        </span>
      )}
    </Link>
  );
}
