import type { CatalogGap } from '@/features/catalog/types';

export const catalogBackendGaps: CatalogGap[] = [
  {
    key: 'product-by-slug',
    title: 'Resolución directa por slug pendiente',
    description:
      'El backend público expone detalle de producto y categoría por id. El storefront resuelve slugs desde listados reales mientras llega un contrato directo.',
  },
  {
    key: 'product-availability',
    title: 'Disponibilidad pública incompleta',
    description:
      'La disponibilidad pública solo llega en resultados de búsqueda. El detalle de producto aún no expone stock público dedicado.',
  },
  {
    key: 'product-images',
    title: 'Imágenes de producto no expuestas públicamente',
    description:
      'El backend público actual no entrega galería de producto. El storefront usa fallback visual honesto mientras se define ese contrato.',
  },
  {
    key: 'product-attributes',
    title: 'Ficha técnica pendiente de endpoint público',
    description:
      'Los atributos técnicos todavía no llegan desde el backend público. La PDP muestra el gap de integración de forma explícita.',
  },
  {
    key: 'related-products',
    title: 'Relacionados no implementados en backend público',
    description:
      'No existe endpoint público de productos relacionados. La UI lo declara sin fingir sugerencias artificiales.',
  },
  {
    key: 'featured-products',
    title: 'Destacados curados no implementados',
    description:
      'No existe endpoint público de destacados. La home muestra una selección real del catálogo y lo etiqueta de forma honesta.',
  },
];

export function getCatalogGap(key: CatalogGap['key']) {
  return catalogBackendGaps.find((gap) => gap.key === key) ?? null;
}
