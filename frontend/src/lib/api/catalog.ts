import type { CatalogGap } from '@/features/catalog/types';

export const catalogBackendGaps: CatalogGap[] = [
  {
    key: 'product-by-slug',
    title: 'Detalle comercial en preparación',
    description:
      'Estamos organizando la ficha comercial para que el producto se consulte con mayor precisión.',
  },
  {
    key: 'product-availability',
    title: 'Disponibilidad por confirmar',
    description:
      'Confirmaremos unidades y tiempos de entrega con nuestro equipo comercial.',
  },
  {
    key: 'product-images',
    title: 'Imagen pendiente',
    description:
      'La imagen final del producto será cargada cuando el asset comercial esté aprobado.',
  },
  {
    key: 'product-attributes',
    title: 'Especificaciones por completar',
    description:
      'Nuestro equipo validará especificaciones completas antes de la venta.',
  },
  {
    key: 'related-products',
    title: 'Relacionados en preparación',
    description:
      'Estamos curando alternativas compatibles para mejorar la compra.',
  },
  {
    key: 'featured-products',
    title: 'Destacados comerciales',
    description:
      'Mostramos una selección inicial del catálogo disponible para compra o asesoría.',
  },
];

export function getCatalogGap(key: CatalogGap['key']) {
  return catalogBackendGaps.find((gap) => gap.key === key) ?? null;
}
