'use client';

import { useEffect, useCallback, useState } from 'react';
import Image from 'next/image';

interface LightboxImage {
  src: string;
  alt: string;
  isPlaceholder?: boolean;
}

interface ProductImageLightboxProps {
  images: LightboxImage[];
}

export function ProductImageLightbox({ images }: ProductImageLightboxProps) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const onOpen = useCallback((i: number) => {
    setIndex(i);
    setOpen(true);
  }, []);

  const onClose = useCallback(() => setOpen(false), []);

  const onPrev = useCallback(() => {
    setIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const onNext = useCallback(() => {
    setIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onPrev();
      if (e.key === 'ArrowRight') onNext();
    };
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose, onPrev, onNext]);

  if (images.length === 0) return null;

  const current = images[index];

  return (
    <>
      {/* Thumbnail trigger — renders first image as clickable */}
      <button
        type="button"
        onClick={() => onOpen(0)}
        className="relative w-full h-full cursor-zoom-in focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[var(--color-industrial-yellow)]"
        aria-label={`Ampliar imagen de ${current.alt}`}
      >
        <Image
          src={current.src}
          alt={current.alt}
          fill
          sizes="(max-width: 768px) 100vw, 45vw"
          className="object-contain p-1 sm:p-2"
          priority
        />
      </button>

      {/* Lightbox modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,0,0,0.92)] backdrop-blur-xs"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Visor de imagen ampliada"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[rgba(0,0,0,0.6)] text-white text-xl hover:bg-[rgba(255,255,255,0.1)] transition"
            aria-label="Cerrar visor"
          >
            ×
          </button>

          {/* Prev */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onPrev(); }}
              className="absolute left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-[rgba(0,0,0,0.6)] text-white text-2xl hover:bg-[rgba(255,255,255,0.1)] transition"
              aria-label="Imagen anterior"
            >
              ‹
            </button>
          )}

          {/* Image wrapper — minimal shell, no visible card */}
          <div
            className="relative max-h-[90vh] max-w-[94vw] overflow-hidden rounded-[1.5rem] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={current.src}
              alt={current.alt}
              width={800}
              height={800}
              className="object-contain max-h-[86vh] max-w-[94vw] w-auto h-auto"
            />
            {current.isPlaceholder ? (
              <div className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs text-[var(--color-industrial-yellow)]">
                Imagen referencial
              </div>
            ) : null}
          </div>

          {/* Next */}
          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onNext(); }}
              className="absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-[rgba(0,0,0,0.6)] text-white text-2xl hover:bg-[rgba(255,255,255,0.1)] transition"
              aria-label="Imagen siguiente"
            >
              ›
            </button>
          )}

          {/* Dots indicator */}
          {images.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                  className={`w-2 h-2 rounded-full transition ${i === index ? 'bg-[var(--color-industrial-yellow)]' : 'bg-white/30'}`}
                  aria-label={`Ir a imagen ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
