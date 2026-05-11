'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { BrandLogo } from '@/components/catalog/BrandLogo';
import type { CatalogBrand } from '@/features/catalog/types';
import { cn } from '@/lib/utils/cn';

interface BrandLogoSliderProps {
  brands: CatalogBrand[];
}

export function BrandLogoSlider({ brands }: BrandLogoSliderProps) {
  const [paused, setPaused] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(false);
  const controls = useAnimationControls();
  const reduceMotion = useReducedMotion();
  const sliderRef = useRef<HTMLDivElement>(null);
  const resumeTimerRef = useRef<number | null>(null);

  const pauseTemporarily = () => {
    setPaused(true);
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
    }
  };

  const resumeAfterInteraction = () => {
    if (resumeTimerRef.current) {
      window.clearTimeout(resumeTimerRef.current);
    }

    resumeTimerRef.current = window.setTimeout(() => {
      if (!sliderRef.current?.contains(document.activeElement)) {
        setPaused(false);
      }
    }, 1800);
  };

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      setMobileViewport(false);
      return;
    }

    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setMobileViewport(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    return () => {
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (reduceMotion || paused) {
      controls.stop();
      return;
    }

    void controls.start({
      x: ['0%', '-50%'],
      transition: {
        duration: mobileViewport ? 24 : 32,
        ease: 'linear',
        repeat: Infinity,
      },
    });
  }, [controls, mobileViewport, paused, reduceMotion]);

  if (!brands.length) {
    return null;
  }

  const duplicatedBrands = [...brands, ...brands];

  return (
    <div
      className={cn(
        'relative rounded-[1.35rem] border border-[var(--color-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] px-3 py-3 sm:rounded-[2rem] sm:px-4 sm:py-5',
        mobileViewport
          ? 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'overflow-hidden',
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-[linear-gradient(90deg,#060606_0%,rgba(6,6,6,0)_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-[linear-gradient(270deg,#060606_0%,rgba(6,6,6,0)_100%)]" />
      <motion.div
        ref={sliderRef}
        aria-label="Marcas disponibles"
        data-paused={paused || reduceMotion ? 'true' : 'false'}
        data-mobile-autoplay={mobileViewport && !reduceMotion ? 'true' : 'false'}
        className="flex w-max touch-pan-y gap-3 sm:gap-4"
        animate={controls}
        onPointerDown={pauseTemporarily}
        onPointerUp={resumeAfterInteraction}
        onPointerCancel={resumeAfterInteraction}
        onMouseEnter={pauseTemporarily}
        onMouseLeave={resumeAfterInteraction}
        onFocusCapture={pauseTemporarily}
        onBlurCapture={(event) => {
          const nextFocus = event.relatedTarget;
          if (
            !(nextFocus instanceof Node) ||
            !sliderRef.current?.contains(nextFocus)
          ) {
            resumeAfterInteraction();
          }
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
