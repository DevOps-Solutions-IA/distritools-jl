# 04_API_SPEC.md — Especificación de APIs

## Principios
- API como contrato único
- respuestas consistentes
- errores tipificados
- validación estricta
- idempotencia en webhooks
- versionado desde el inicio

## Convenciones
- prefijo `/api/v1`
- JSON siempre
- timestamps ISO 8601
- paginación estándar
- filtros y ordenamiento explícitos
- camelCase en respuestas si se define así, o snake_case consistente si se prefiere

## Autenticación admin
### POST /api/v1/auth/login
Request:
```json
{ "email": "admin@dominio.com", "password": "********" }
```

Response:
```json
{
  "accessToken": "jwt",
  "refreshToken": "jwt",
  "user": {
    "id": "1",
    "fullName": "Admin",
    "role": "SuperAdmin"
  }
}
```

### POST /api/v1/auth/logout
Revoca sesión o token.

### POST /api/v1/auth/refresh
Renueva token.

## Catálogo público
### GET /api/v1/categories
Retorna categorías activas con jerarquía por `parentId`.

### GET /api/v1/categories/:id
Retorna detalle de categoría por id.

### GET /api/v1/products
Query params:
- `categoryId`
- `brandId`

### GET /api/v1/products/:id
Retorna detalle del producto por id.

### GET /api/v1/brands
Lista de marcas activas con metadata útil para storefront y administración futura.

Metadata pública esperada por marca:
- `commercialPriority`
- `shortDescription`
- `longDescription`
- `industrialFocus`
- `productFamilies`
- `categorySlugs`
- `keywords`
- `logo`
- `sourceNotes`
- `rules`

### GET /api/v1/brands/:id
Retorna detalle de marca por id.

### GET /api/v1/search
Query params:
- `q`
- `limit`
- `brandSlug`
- `categorySlug`

Permite búsqueda pública por texto con filtros por slug de marca y categoría indexada.

### GET /api/v1/search/autocomplete
Autocompletado público de búsqueda.

## Carrito
Gap actual:
- no existe contrato público de carrito en backend
- el storefront opera con `LocalStorage`
- la sincronización de carrito multi-dispositivo queda pendiente para una fase posterior

## Checkout y pedidos
### POST /api/v1/checkout/guest-order
Crea pedido guest público sin exponer `warehouseId`.

Request:
```json
{
  "customer": {
    "fullName": "Juan Pérez",
    "email": "juan@mail.com",
    "phone": "3000000000",
    "document": "901234567"
  },
  "shippingAddress": {
    "city": "Cali",
    "addressLine1": "Calle 1 #2-3",
    "addressLine2": "Apto 101",
    "notes": "Portería"
  },
  "items": [
    {
      "productId": "uuid-product",
      "variantId": "uuid-variant",
      "quantity": 2
    }
  ],
  "deliveryMethod": "standard",
  "paymentMethod": "mock",
  "notes": "Entrega diurna"
}
```

Response:
```json
{
  "orderId": "uuid-order",
  "orderNumber": "DTJL-2026-0001",
  "status": "pending_payment",
  "total": "350000.00",
  "currency": "COP",
  "payment": {
    "canInitiate": true,
    "initiateUrl": "/api/v1/payments/DTJL-2026-0001/initiate"
  }
}
```

Reglas:
- el frontend no envía `warehouseId`
- el backend resuelve fulfillment internamente
- stock y pricing se validan en backend al crear la orden
- la orden queda en `pending_payment`
- la confirmación de pago sigue dependiendo del webhook

Errores esperados:
- `400` payload inválido
- `404` producto o variante inexistente
- `409` stock insuficiente
- `422` regla de negocio inválida
- `500` error inesperado

### POST /api/v1/orders
Crea pedido con contrato interno/legacy que incluye `warehouseId` por línea.

Request:
```json
{
  "customer": {
    "fullName": "Juan Pérez",
    "email": "juan@mail.com",
    "phone": "3000000000"
  },
  "shipping": {
    "address": "Calle 1 #2-3",
    "city": "Cali",
    "notes": "Apto 101"
  },
  "items": [
    { "variantId": "uuid-variant", "warehouseId": "uuid-warehouse", "quantity": 2 }
  ]
}
```

Response:
```json
{
  "orderId": "123",
  "orderNumber": "DTJL-2026-0001",
  "status": "pending_payment",
  "grandTotal": 350000
}
```

### GET /api/v1/orders/:orderNumber
Consulta estado público del pedido.

### POST /api/v1/orders/:orderNumber/cancel
Reglas definidas por negocio.

## Pagos
### POST /api/v1/payments/:orderNumber/initiate
### POST /api/v1/payments/webhook/:gateway
### GET /api/v1/admin/payments/:id

#### Reglas
- validar firma
- detectar duplicados
- registrar raw payload
- conciliar pedido

## Inventario admin
### GET /api/v1/admin/inventory
### PATCH /api/v1/admin/inventory/:productId/adjust
### GET /api/v1/admin/inventory/movements

#### Ajuste de stock
Request:
```json
{
  "warehouseId": "1",
  "quantity": 10,
  "reason": "Inventario inicial"
}
```

## Productos admin
### GET /api/v1/admin/products
### POST /api/v1/admin/products
### PATCH /api/v1/admin/products/:id
### DELETE /api/v1/admin/products/:id
### PATCH /api/v1/admin/products/:id/status

Reglas de taxonomía:
- `brandId` debe existir
- `categoryId` debe existir
- una marca no puede recibir productos fuera de sus `categorySlugs` permitidos
- el sistema no crea productos, SKUs, precios ni stock de forma automática desde metadata de marca

## Marcas y taxonomía
### GET /api/v1/admin/brands
### GET /api/v1/admin/brands/:id
### POST /api/v1/admin/brands
### PATCH /api/v1/admin/brands/:id
### PATCH /api/v1/admin/brands/:id/activate
### PATCH /api/v1/admin/brands/:id/deactivate

Reglas:
- la metadata de marca es la fuente de verdad taxonómica
- no se deben guardar SKUs, precios ni stock dentro de metadata
- no se debe afirmar distribución oficial sin autorización del negocio

## Pedidos admin
### GET /api/v1/admin/orders
### PATCH /api/v1/admin/orders/:id/status
### PATCH /api/v1/admin/orders/:id/shipping
### POST /api/v1/admin/orders/:id/refund

## Reportes
### GET /api/v1/admin/reports/sales
### GET /api/v1/admin/reports/top-products
### GET /api/v1/admin/reports/stock-low
### GET /api/v1/admin/reports/orders
### GET /api/v1/admin/reports/conversion

## Notificaciones
### POST /api/v1/notifications/test
### GET /api/v1/admin/notifications

## Webhooks
### Reglas
- todo webhook debe tener autenticación
- almacenar payload crudo
- verificar firma
- responder rápido
- procesar tareas pesadas asíncronamente

## Códigos de error
- 400 invalid_request
- 401 unauthorized
- 403 forbidden
- 404 not_found
- 409 conflict
- 422 business_rule_violation
- 429 rate_limited
- 500 internal_error

## Formato de error
```json
{
  "error": {
    "code": "business_rule_violation",
    "message": "Stock insuficiente",
    "details": []
  }
}
```

## Paginación estándar
```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

## Criterios de aceptación
- cada endpoint tiene contrato documentado
- validación completa
- errores consistentes
- soporte de pruebas automatizadas
- seguridad y permisos aplicados
