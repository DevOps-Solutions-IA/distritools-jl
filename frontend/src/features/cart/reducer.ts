import type { CartAction, CartItem, CartState } from '@/features/cart/types';

function createCartItemId(variantId: string) {
  return `cart-${variantId}`;
}

export const initialCartState: CartState = {
  items: [],
  isHydrated: false,
  isDrawerOpen: false,
  lastError: null,
};

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...state,
        items: action.payload,
        isHydrated: true,
      };
    case 'ADD_ITEM': {
      const quantity = Math.max(1, action.payload.quantity ?? 1);
      const existing = state.items.find(
        (item) => item.variant.id === action.payload.variant.id,
      );

      const items = existing
        ? state.items.map((item) =>
            item.variant.id === action.payload.variant.id
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                }
              : item,
          )
        : [
            ...state.items,
            {
              id: createCartItemId(action.payload.variant.id),
              product: action.payload.product,
              variant: action.payload.variant,
              quantity,
              availabilityLabel: action.payload.availabilityLabel,
              availabilityDescription: action.payload.availabilityDescription,
              addedAt: new Date().toISOString(),
            } satisfies CartItem,
          ];

      return {
        ...state,
        items,
        isDrawerOpen: true,
        lastError: null,
      };
    }
    case 'SET_QUANTITY':
      return {
        ...state,
        items: state.items
          .map((item) =>
            item.variant.id === action.payload.variantId
              ? { ...item, quantity: Math.max(1, action.payload.quantity) }
              : item,
          )
          .filter((item) => item.quantity > 0),
      };
    case 'REMOVE_ITEM':
      return {
        ...state,
        items: state.items.filter((item) => item.variant.id !== action.payload.variantId),
      };
    case 'CLEAR':
      return {
        ...state,
        items: [],
        lastError: null,
      };
    case 'OPEN_DRAWER':
      return {
        ...state,
        isDrawerOpen: true,
      };
    case 'CLOSE_DRAWER':
      return {
        ...state,
        isDrawerOpen: false,
      };
    case 'TOGGLE_DRAWER':
      return {
        ...state,
        isDrawerOpen: !state.isDrawerOpen,
      };
    case 'SET_ERROR':
      return {
        ...state,
        lastError: action.payload,
      };
    default:
      return state;
  }
}
