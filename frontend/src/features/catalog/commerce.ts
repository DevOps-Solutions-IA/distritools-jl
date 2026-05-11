import type { CatalogProduct } from '@/features/catalog/types';

export type ProductCommerceMode = 'buy' | 'quote' | 'advisory' | 'unavailable';

export interface ProductCommerceState {
  label: string;
  primaryAction: string;
  secondaryAction: string;
  canAddToCart: boolean;
  canRequestQuote: boolean;
  showPrice: boolean;
  showSubtotal: boolean;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  cartMode: ProductCommerceMode;
}

export function getProductCommerceState(product: CatalogProduct): ProductCommerceState {
  const hasSellableVariant =
    Boolean(product.primaryVariantId && product.primarySku) && product.primaryPrice !== null;

  if (hasSellableVariant && product.availability.status === 'out-of-stock') {
    return {
      label: 'Por confirmar',
      primaryAction: 'Comprar',
      secondaryAction: 'Ver',
      canAddToCart: false,
      canRequestQuote: true,
      showPrice: true,
      showSubtotal: false,
      badgeVariant: 'danger',
      cartMode: 'advisory',
    };
  }

  if (hasSellableVariant) {
    return {
      label: product.availability.status === 'low-stock' ? 'Bajo stock' : 'Disponible',
      primaryAction: 'Comprar',
      secondaryAction: 'Ver',
      canAddToCart: true,
      canRequestQuote: false,
      showPrice: true,
      showSubtotal: true,
      badgeVariant: product.availability.status === 'low-stock' ? 'warning' : 'success',
      cartMode: 'buy',
    };
  }

  if (product.availability.status === 'out-of-stock') {
    return {
      label: 'Por confirmar',
      primaryAction: 'Comprar',
      secondaryAction: 'Ver',
      canAddToCart: false,
      canRequestQuote: true,
      showPrice: false,
      showSubtotal: false,
      badgeVariant: 'danger',
      cartMode: 'advisory',
    };
  }

  if (product.availability.status === 'check-backend') {
    return {
      label: 'Precio por confirmar',
      primaryAction: 'Comprar',
      secondaryAction: 'Ver',
      canAddToCart: true,
      canRequestQuote: true,
      showPrice: false,
      showSubtotal: false,
      badgeVariant: 'info',
      cartMode: 'quote',
    };
  }

  return {
    label: 'No disponible',
    primaryAction: 'Comprar',
    secondaryAction: 'Ver',
    canAddToCart: false,
    canRequestQuote: true,
    showPrice: false,
    showSubtotal: false,
    badgeVariant: 'neutral',
    cartMode: 'unavailable',
  };
}

export function buildProductQuoteHref(product: CatalogProduct) {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `Hola DistriTools JL, quiero cotizar ${product.name}.`,
  )}`;
}
