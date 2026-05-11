import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalPage } from '@/components/legal/LegalPage';
import { getLegalPage } from '@/content/legal-pages';

export const metadata: Metadata = {
  title: 'Política de envíos | DistriTools JL',
  description: 'Política de envíos pendiente de revisión legal y configuración logística.',
};

export default function ShippingPolicyPage() {
  const page = getLegalPage('politica-de-envios');
  if (!page) notFound();
  return <LegalPage page={page} />;
}
