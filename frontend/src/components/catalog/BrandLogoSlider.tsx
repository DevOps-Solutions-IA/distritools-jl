'use client';

import { motion } from 'framer-motion';
import { BrandLogo } from '@/components/catalog/BrandLogo';
import type { CatalogBrand } from '@/features/catalog/types';

interface BrandLogoSliderProps {
  brands: CatalogBrand[];
}

export function BrandLogoSlider({ brands }: BrandLogoSliderProps) {
  if (!brands.length) {
    return null;
  }

  const duplicatedBrands = [...brands, ...brands];

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-4 py-5">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-[linear-gradient(90deg,#060606_0%,rgba(6,6,6,0)_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-[linear-gradient(270deg,#060606_0%,rgba(6,6,6,0)_100%)]" />
      <motion.div
        className="flex w-max gap-4"
        animate={{ x: ['0%', '-50%'] }}
        transition={{
          duration: 32,
          ease: 'linear',
          repeat: Infinity,
        }}
      >
        {duplicatedBrands.map((brand, index) => (
          <BrandLogo
            key={`${brand.id}-${index}`}
            brand={brand}
            compact
            decorative={index >= brands.length}
          />
        ))}
      </motion.div>
    </div>
  );
}
