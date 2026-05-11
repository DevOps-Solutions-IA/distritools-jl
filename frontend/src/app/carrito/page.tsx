import type { Metadata } from 'next';
import { CartPageContent } from '@/components/cart/CartPageContent';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: `Carrito | ${siteConfig.name}`,
  description: 'Revisa productos, cantidades, subtotal y cotizaciones antes de continuar.',
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <StorefrontShell>
      <CartPageContent />
    </StorefrontShell>
  );
}
