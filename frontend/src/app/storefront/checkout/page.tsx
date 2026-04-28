import type { Metadata } from 'next';
import { CheckoutPageContent } from '@/components/checkout/CheckoutPageContent';
import { StorefrontShell } from '@/components/layout/StorefrontShell';
import { siteConfig } from '@/config/site';

export const metadata: Metadata = {
  title: `${siteConfig.name} | Checkout invitado`,
  description:
    'Checkout invitado de DistriTools JL conectado al backend para crear órdenes cuando el contrato público lo permita completamente.',
};

export default function CheckoutPage() {
  return (
    <StorefrontShell>
      <CheckoutPageContent />
    </StorefrontShell>
  );
}
