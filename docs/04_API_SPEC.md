# 04 API Spec — DistriTools JL

## Catálogo público

### `GET /api/v1/brands`
- Propósito: listar marcas activas para storefront.
- Devuelve: `id`, `name`, `slug`, `description`, `metadata`.
- `metadata` incluye familias, categorías permitidas, keywords, prioridad comercial, logo y reglas de gobierno.

### `GET /api/v1/categories`
- Propósito: listar categorías activas para navegación y filtros.
- Devuelve: `id`, `parentId`, `name`, `slug`, `description`, `sortOrder`.

### `GET /api/v1/products`
- Propósito: listar productos activos.
- Filtros soportados: `brandId`, `categoryId`.
- Devuelve: `id`, `name`, `slug`, `description`, `metadata`, `brand`, `category`.
- `metadata` público contiene:
  - `family`
  - `subcategory`
  - `longDescription`
  - `presentation`
  - `unit`
  - `packageSize`
  - `availability`
  - `attributes`
  - `tags`
  - `seo`
  - `image`
  - `source`

### `GET /api/v1/products/:id`
- Propósito: obtener detalle público por id.
- Nota: el frontend resuelve slug desde listados mientras exista endpoint directo por slug.

### `GET /api/v1/variants`
- Propósito: listar variantes vendibles con precio.
- Filtros soportados: `productId`.
- Regla: solo debe existir variante cuando hay SKU, precio y disponibilidad operativa verificable.

### `GET /api/v1/search`
- Propósito: búsqueda pública de catálogo.
- Parámetros principales: `q`, `brandSlug`, `categorySlug`.
- Devuelve documentos activos indexados desde variantes y contenido publicado.

## Checkout público

### `POST /api/v1/checkout/guest-order`
- Propósito: crear orden invitada sin login cliente y sin exponer `warehouseId`.
- Backend resuelve internamente producto, variante, precio vigente, allocation, stock y reserva.
- Estado inicial: `pending_payment`.
- El frontend nunca confirma pagos.

## Reglas
- No exponer `warehouseId` al storefront como requisito de compra.
- No confiar en precio, stock o disponibilidad enviados por frontend.
- No crear variantes con precio/stock inventado.
- No afirmar distribución oficial de marcas sin autorización del negocio.
