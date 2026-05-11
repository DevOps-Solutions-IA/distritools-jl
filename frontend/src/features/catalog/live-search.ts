import type { CatalogBrand, CatalogCategory, CatalogProduct } from '@/features/catalog/types';

export interface LiveSearchResultGroups {
  products: CatalogProduct[];
  brands: CatalogBrand[];
  categories: CatalogCategory[];
}

const synonymMap: Record<string, string[]> = {
  taladro: ['taladro', 'taladros', 'perforacion', 'perforación'],
  taladros: ['taladro', 'taladros', 'perforacion', 'perforación'],
  esmeril: ['esmeril', 'esmeriles', 'pulidora', 'pulidoras', 'angular'],
  pulidora: ['esmeril', 'esmeriles', 'pulidora', 'pulidoras', 'angular'],
  compresor: ['compresor', 'compresores', 'aire'],
  aire: ['compresor', 'compresores', 'aire', 'neumatica', 'neumática'],
  soldadura: ['soldadura', 'soldador', 'soldadora', 'soldadoras'],
  soldador: ['soldadura', 'soldador', 'soldadora', 'soldadoras'],
  fijacion: ['fijacion', 'fijación', 'anclaje', 'anclajes', 'fijar'],
  anclaje: ['fijacion', 'fijación', 'anclaje', 'anclajes'],
  corte: ['corte', 'cortadora', 'cortadoras', 'disco'],
  cortadora: ['corte', 'cortadora', 'cortadoras'],
  manual: ['manual', 'manuales', 'herramienta manual', 'herramientas manuales'],
  electrica: ['electrica', 'eléctrica', 'electricas', 'eléctricas', 'herramienta electrica'],
  neumatica: ['neumatica', 'neumática', 'neumaticas', 'neumáticas', 'aire'],
};

export function normalizeSearchText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-CO')
    .trim();
}

function getQueryTerms(query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) {
    return [];
  }

  const words = normalized.split(/\s+/).filter(Boolean);
  const expanded = new Set<string>(words);
  for (const word of words) {
    for (const synonym of synonymMap[word] ?? []) {
      expanded.add(normalizeSearchText(synonym));
    }
  }

  return [...expanded];
}

export function isPubliclyPurchasable(product: CatalogProduct) {
  const hasPrice = product.primaryPrice !== null && product.primaryPrice > 0;
  const hasVariant = Boolean(product.primaryVariantId && product.primarySku);
  const hasStock =
    product.availability.status === 'in-stock' ||
    product.availability.status === 'low-stock';

  return hasPrice && hasVariant && hasStock;
}

function productSearchText(product: CatalogProduct) {
  return [
    product.name,
    product.description,
    product.presentation,
    product.primarySku,
    product.brand?.name,
    product.brand?.slug,
    product.category?.name,
    product.category?.slug,
    ...product.tags,
  ]
    .map(normalizeSearchText)
    .filter(Boolean)
    .join(' ');
}

function rankText(text: string, primaryName: string, terms: string[]) {
  let score = 0;
  for (const term of terms) {
    if (primaryName === term) score += 120;
    else if (primaryName.startsWith(term)) score += 80;
    else if (text.includes(` ${term}`) || text.startsWith(term)) score += 42;
    else if (text.includes(term)) score += 18;
  }

  return score;
}

export function getLiveSearchResults(input: {
  query: string;
  products: CatalogProduct[];
  brands: CatalogBrand[];
  categories: CatalogCategory[];
  limit?: number;
}): LiveSearchResultGroups {
  const terms = getQueryTerms(input.query);
  const limit = input.limit ?? 8;
  if (normalizeSearchText(input.query).length < 2 || !terms.length) {
    return { products: [], brands: [], categories: [] };
  }

  const products = input.products
    .filter(isPubliclyPurchasable)
    .map((product) => {
      const text = productSearchText(product);
      const score = rankText(text, normalizeSearchText(product.name), terms);
      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      const stockDelta =
        (right.product.availability.quantity ?? 0) -
        (left.product.availability.quantity ?? 0);
      if (stockDelta !== 0) return stockDelta;
      return left.product.name.localeCompare(right.product.name, 'es-CO');
    })
    .slice(0, limit)
    .map((item) => item.product);

  const brands = input.brands
    .map((brand) => ({
      brand,
      score: rankText(
        [brand.name, brand.slug, brand.description, ...(brand.metadata?.keywords ?? [])]
          .map(normalizeSearchText)
          .join(' '),
        normalizeSearchText(brand.name),
        terms,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((item) => item.brand);

  const categories = input.categories
    .map((category) => ({
      category,
      score: rankText(
        [category.name, category.slug, category.description]
          .map(normalizeSearchText)
          .join(' '),
        normalizeSearchText(category.name),
        terms,
      ),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4)
    .map((item) => item.category);

  return { products, brands, categories };
}
