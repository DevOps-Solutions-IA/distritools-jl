import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalPage } from '@/components/legal/LegalPage';
import { getLegalPage } from '@/content/legal-pages';

export const metadata: Metadata = {
  title: 'Cambios, devoluciones y garantías | DistriTools JL',
  description: 'Base de cambios, devoluciones y garantías pendiente de revisión legal.',
};

export default function ReturnsWarrantyPage() {
  const page = getLegalPage('cambios-devoluciones-y-garantias');
  if (!page) notFound();
  return <LegalPage page={page} />;
}
