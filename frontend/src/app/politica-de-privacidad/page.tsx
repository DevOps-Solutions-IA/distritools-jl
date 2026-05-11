import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalPage } from '@/components/legal/LegalPage';
import { getLegalPage } from '@/content/legal-pages';

export const metadata: Metadata = {
  title: 'Política de privacidad | DistriTools JL',
  description: 'Política de privacidad de DistriTools JL pendiente de revisión legal.',
};

export default function PrivacyPage() {
  const page = getLegalPage('politica-de-privacidad');
  if (!page) notFound();
  return <LegalPage page={page} />;
}
