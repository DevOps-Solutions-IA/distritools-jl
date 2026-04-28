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
Retorna árbol de categorías.

### GET /api/v1/categories/:slug
Retorna detalle de categoría y subcategorías.

### GET /api/v1/products
Query params:
- category
- brand
- q
- minPrice
- maxPrice
- sort
- page
- limit

### GET /api/v1/products/:slug
Retorna detalle completo del producto.

### GET /api/v1/products/:slug/related
Retorna productos relacionados.

### GET /api/v1/brands
Lista de marcas activas.

## Carrito
### POST /api/v1/cart/items
### PATCH /api/v1/cart/items/:id
### DELETE /api/v1/cart/items/:id
### GET /api/v1/cart

El carrito puede operar por sesión o token temporal.

## Checkout y pedidos
### POST /api/v1/orders
Crea pedido guest.

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
    { "productId": "1", "quantity": 2 }
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
### POST /api/v1/payments/initiate
### POST /api/v1/payments/webhook/:gateway
### GET /api/v1/payments/:id/status

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
