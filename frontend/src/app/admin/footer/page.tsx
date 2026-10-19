import { ContentPage } from '@/features/admin/content/ContentPage';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Footer admin | DistriTools JL',
  robots: { index: false, follow: false },
};

export default async function Page() {
  return ContentPage({ domain: 'footer' });
}
