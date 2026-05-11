import { redirect } from 'next/navigation';

type SearchParamsValue = string | string[] | undefined;

function getSingleValue(value: SearchParamsValue) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LegacySearchRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = getSingleValue(resolvedSearchParams.q);
  redirect(`/buscar${query ? `?q=${encodeURIComponent(query)}` : ''}`);
}
