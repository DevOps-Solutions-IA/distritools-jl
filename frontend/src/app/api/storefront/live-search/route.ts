import { NextRequest, NextResponse } from 'next/server';
import { getLiveSearchResults } from '@/features/catalog/live-search';
import { getProductListingData } from '@/features/catalog/queries';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') ?? '';
  const { data } = await getProductListingData({});
  const results = getLiveSearchResults({
    query,
    products: data.products,
    brands: data.brands,
    categories: data.categories,
  });

  return NextResponse.json({
    products: results.products.slice(0, 6).map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand?.name ?? null,
      priceLabel: product.primaryPriceLabel,
    })),
    brands: results.brands.slice(0, 4).map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
    })),
    categories: results.categories.slice(0, 4).map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
  });
}
