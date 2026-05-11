import type { Metadata } from 'next';
import { CheckoutPageContent } from '@/components/checkout/CheckoutPageContent';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: `Checkout | ${siteConfig.name}`,
  description: 'Envía tu pedido o solicitud de cotización sin crear cuenta.',
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <StorefrontShell>
      <CheckoutPageContent />
    </StorefrontShell>
  );
}
