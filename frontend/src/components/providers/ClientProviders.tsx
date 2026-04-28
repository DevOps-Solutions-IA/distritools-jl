'use client';

import type { ReactNode } from 'react';
import { CartProvider } from '@/features/cart/context';

export function ClientProviders({ children }: { children: ReactNode }) {
  return <CartProvider>{children}</CartProvider>;
}
