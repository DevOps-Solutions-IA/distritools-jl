# 06 Ecommerce Spec — DistriTools JL

## Storefront
- La tienda principal vive en `/`.
- `/storefront` queda como compatibilidad y no debe competir con `/`.
- La navegación pública no debe exponer administración.
- El copy público debe ser comercial, no técnico.

## Catálogo maestro
- Fuente versionada: `data/catalog/master-products.json`.
- Seed: `src/modules/products/infrastructure/seeds/master-product-catalog.seed.ts`.
- Cada producto debe tener marca, categoría, slug, presentación, descripción comercial, SEO y fuente.
- Los productos sin SKU/precio/stock autorizado quedan en modo consulta comercial (`by-request`).
- No se crean productos, precios, SKUs, stock ni claims sin fuente o autorización.

## ProductCard
- Debe priorizar imagen o fallback visual premium.
- Mostrar solo lo esencial: nombre, precio y CTA.
- CTA obligatorios:
  - `Ver producto`
  - `Agregar al carrito`
- No mostrar texto técnico ni descripciones largas en cards.

## PDP
- Debe mostrar jerarquía de compra: imagen, nombre, marca, precio, disponibilidad, variantes, cantidad, carrito, asesoría y detalles.
- Si faltan imágenes oficiales, usar fallback visual honesto sin hotlink externo.

## Checkout
- Checkout invitado, sin login cliente.
- Backend crea la orden.
- Backend confirma pago por webhook.
- El frontend solo muestra estado informativo y no marca órdenes como pagadas.

## Marcas
- Marcas activas iniciales: Ingersoll Rand, BeA, Pretul, Truper, TOTAL, SENCO, Lincoln Electric.
- Logos de terceros solo si hay asset autorizado por negocio.
- Si no hay asset autorizado, usar wordmark/fallback neutro.
- No afirmar distribución oficial sin autorización expresa.
