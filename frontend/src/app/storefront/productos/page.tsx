import { redirect } from 'next/navigation';

type SearchParamsValue = string | string[] | undefined;

function getSingleValue(value: SearchParamsValue) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LegacyProductsRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const query = new URLSearchParams();
  const brand = getSingleValue(resolvedSearchParams.brand);
  const category = getSingleValue(resolvedSearchParams.category);
  const sort = getSingleValue(resolvedSearchParams.sort);

  if (brand) query.set('brand', brand);
  if (category) query.set('category', category);
  if (sort) query.set('sort', sort);

  redirect(`/productos${query.toString() ? `?${query.toString()}` : ''}`);
}
