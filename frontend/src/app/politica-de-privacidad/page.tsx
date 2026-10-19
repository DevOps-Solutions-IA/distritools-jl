import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PublishedLegalPage } from '@/components/legal/PublishedLegalPage';
import { getPublishedLegal } from '@/lib/api/legal';
import { getLegalPage } from '@/content/legal-pages';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Política de privacidad | DistriTools JL',
  description: 'Consulta el documento y su estado de publicación en DistriTools JL.',
};

export default async function PrivacyPage() {
  const page = getLegalPage('politica-de-privacidad');
  if (!page) notFound();
  return <PublishedLegalPage result={await getPublishedLegal('politica-de-privacidad')} fallback={page} />;
}
