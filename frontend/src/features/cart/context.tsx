'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react';
import { cartReducer, initialCartState } from '@/features/cart/reducer';
import {
  clearCartStorage,
  loadCartFromStorage,
  saveCartToStorage,
} from '@/features/cart/storage';
import type { AddCartItemPayload, CartState } from '@/features/cart/types';

interface CartContextValue {
  state: CartState;
  addItem: (...args: [AddCartItemPayload]) => void;
  setQuantity: (...args: [string, number]) => void;
  removeItem: (...args: [string]) => void;
  clearCart(): void;
  openDrawer(): void;
  closeDrawer(): void;
  toggleDrawer(): void;
  setError: (...args: [string | null]) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialCartState);

  useEffect(() => {
    dispatch({ type: 'HYDRATE', payload: loadCartFromStorage() });
  }, []);

  useEffect(() => {
    if (!state.isHydrated) {
      return;
    }

    if (!state.items.length) {
      clearCartStorage();
      return;
    }

    saveCartToStorage(state.items);
  }, [state.isHydrated, state.items]);

  const value = useMemo<CartContextValue>(
    () => ({
      state,
      addItem: (payload) => dispatch({ type: 'ADD_ITEM', payload }),
      setQuantity: (variantId, quantity) =>
        dispatch({ type: 'SET_QUANTITY', payload: { variantId, quantity } }),
      removeItem: (variantId) =>
        dispatch({ type: 'REMOVE_ITEM', payload: { variantId } }),
      clearCart: () => dispatch({ type: 'CLEAR' }),
      openDrawer: () => dispatch({ type: 'OPEN_DRAWER' }),
      closeDrawer: () => dispatch({ type: 'CLOSE_DRAWER' }),
      toggleDrawer: () => dispatch({ type: 'TOGGLE_DRAWER' }),
      setError: (message) => dispatch({ type: 'SET_ERROR', payload: message }),
    }),
    [state],
  );

  if (!state.isHydrated) {
    return null;
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCartContext must be used within CartProvider');
  }

  return context;
}
