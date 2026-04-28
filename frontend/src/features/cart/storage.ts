import type { CartItem } from '@/features/cart/types';

export const CART_STORAGE_KEY = 'distritoolsjl.cart.v1';

export function loadCartFromStorage(): CartItem[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function saveCartToStorage(items: CartItem[]) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
}

export function clearCartStorage() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(CART_STORAGE_KEY);
}
