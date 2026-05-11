import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LegalPage } from '@/components/legal/LegalPage';
import { getLegalPage } from '@/content/legal-pages';

export const metadata: Metadata = {
  title: 'Tratamiento de datos | DistriTools JL',
  description: 'Autorización de tratamiento de datos pendiente de revisión legal.',
};

export default function DataTreatmentPage() {
  const page = getLegalPage('tratamiento-de-datos');
  if (!page) notFound();
  return <LegalPage page={page} />;
}
