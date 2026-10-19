import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublishedLegalPage } from '@/components/legal/PublishedLegalPage';
import { getPublishedLegal } from '@/lib/api/legal';
import { getLegalPage } from '@/content/legal-pages';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cambios, devoluciones y garantías | DistriTools JL',
  description: 'Consulta el documento y su estado de publicación en DistriTools JL.',
};

export default async function ReturnsWarrantyPage() {
  const page = getLegalPage('cambios-devoluciones-y-garantias');
  if (!page) notFound();
  return <PublishedLegalPage result={await getPublishedLegal('cambios-devoluciones-y-garantias')} fallback={page} />;
}
