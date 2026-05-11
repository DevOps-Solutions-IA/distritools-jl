import { redirect } from 'next/navigation';

export default async function LegacyProductRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/productos/${slug}`);
}
