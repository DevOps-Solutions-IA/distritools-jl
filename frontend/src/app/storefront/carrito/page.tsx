import type { Metadata } from 'next';
import { CartPageContent } from '@/components/cart/CartPageContent';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: `${siteConfig.name} | Carrito`,
  description:
    'Revisa tu carrito invitado de DistriTools JL antes de pasar al checkout conectado al backend.',
};

export default function CartPage() {
  return (
    <StorefrontShell>
      <CartPageContent />
    </StorefrontShell>
  );
}
