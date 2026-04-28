import '@testing-library/jest-dom/vitest';
import React from 'react';
import { vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({
    alt,
    src,
    fill,
    priority,
    sizes,
    placeholder,
    blurDataURL,
    unoptimized,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { src: string }) =>
    React.createElement('img', {
      alt,
      src,
      ...props,
    }),
}));
