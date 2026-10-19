import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublishedLegalPage } from '@/components/legal/PublishedLegalPage';
import { getPublishedLegal } from '@/lib/api/legal';
import { getLegalPage } from '@/content/legal-pages';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Términos y condiciones | DistriTools JL',
  description: 'Consulta el documento y su estado de publicación en DistriTools JL.',
};

export default async function TermsPage() {
  const page = getLegalPage('terminos-y-condiciones');
  if (!page) notFound();
  return <PublishedLegalPage result={await getPublishedLegal('terminos-y-condiciones')} fallback={page} />;
}
