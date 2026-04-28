export interface CartLineProduct {
  id: string;
  slug: string;
  name: string;
  brandName: string | null;
  categoryName: string | null;
}

export interface CartLineVariant {
  id: string;
  productId: string | null;
  name: string;
  sku: string;
  price: number;
  priceLabel: string;
  taxRate: string;
  warehouseId?: string | null;
}

export interface CartItem {
  id: string;
  product: CartLineProduct;
  variant: CartLineVariant;
  quantity: number;
  availabilityLabel: string;
  availabilityDescription: string;
  addedAt: string;
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
  subtotalLabel: string;
}

export interface CartState {
  items: CartItem[];
  isHydrated: boolean;
  isDrawerOpen: boolean;
  lastError: string | null;
}

export interface AddCartItemPayload {
  product: CartLineProduct;
  variant: CartLineVariant;
  quantity?: number;
  availabilityLabel: string;
  availabilityDescription: string;
}

export type CartAction =
  | { type: 'HYDRATE'; payload: CartItem[] }
  | { type: 'ADD_ITEM'; payload: AddCartItemPayload }
  | { type: 'SET_QUANTITY'; payload: { variantId: string; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: { variantId: string } }
  | { type: 'CLEAR' }
  | { type: 'OPEN_DRAWER' }
  | { type: 'CLOSE_DRAWER' }
  | { type: 'TOGGLE_DRAWER' }
  | { type: 'SET_ERROR'; payload: string | null };
