import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalPage } from '@/components/legal/LegalPage';
import { getLegalPage } from '@/content/legal-pages';

export const metadata: Metadata = {
  title: 'Términos y condiciones | DistriTools JL',
  description: 'Términos comerciales de DistriTools JL pendientes de revisión legal.',
};

export default function TermsPage() {
  const page = getLegalPage('terminos-y-condiciones');
  if (!page) notFound();
  return <LegalPage page={page} />;
}
