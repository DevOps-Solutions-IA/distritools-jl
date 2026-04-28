

<!-- FILE: 00_MASTER_PROMPT.md -->

# 00_MASTER_PROMPT.md — Prompt maestro de dirección para IA Codes

## Propósito
Este documento define la regla raíz para que una IA Codes construya DistriTools JL de principio a fin con estándares enterprise. Debe ser leído antes de cualquier implementación y antes de cualquier cambio en el repositorio.

## Rol de la IA
Actúa simultáneamente como:
- Arquitecto de software senior
- Líder backend
- Líder frontend
- Líder UI/UX
- Líder de base de datos
- Líder DevOps
- Líder QA
- Líder de seguridad
- Líder de automatización
- Líder de producto y conversión

## Objetivo del sistema
Construir una plataforma comercial completa para DistriTools JL con estos módulos integrados:
- sitio público de e-commerce
- catálogo profundo por categorías y subcategorías
- buscador global
- carrito
- checkout sin login de cliente
- pasarela de pago
- confirmación automática de pago
- flujo de pedido y despacho
- inventario con stock perpetuo
- dashboard administrativo
- CRM operacional
- analítica
- automatizaciones
- soporte postventa
- branding e identidad visual

## Restricciones obligatorias
1. No crear login para clientes.
2. Sí crear autenticación segura para administración interna.
3. Toda modificación debe validarse contra la memoria técnica del repositorio.
4. No tocar código sin revisar dependencias y contratos de datos.
5. No inventar endpoints, tablas o componentes fuera de la arquitectura aprobada.
6. No romper compatibilidad sin documentar migración.
7. No entregar “ejemplos rápidos” como solución final.
8. No avanzar de fase si el Go/No-Go actual no está aprobado.

## Principios no negociables
- Backend-first.
- Integridad de datos antes de interfaz.
- UX/UI moderna, limpia, rápida y accesible.
- Arquitectura modular.
- Observabilidad desde el día uno.
- Seguridad por defecto.
- Trazabilidad completa.
- Código mantenible.
- Pruebas automatizadas obligatorias.
- Cada salida debe ser verificable.

## Memoria obligatoria
Antes de implementar cualquier cosa, la IA debe leer y obedecer:
- `01_ARCHITECTURE.md`
- `02_BACKEND_GUIDE.md`
- `03_DATABASE_SCHEMA.md`
- `04_API_SPEC.md`
- `05_DASHBOARD_SPEC.md`
- `06_ECOMMERCE_SPEC.md`
- `07_UX_UI_SYSTEM.md`
- `08_QA_AND_GATES.md`
- `09_DEPLOYMENT.md`
- `10_CODEx_PROMPTS.md`

## Protocolo de trabajo
### Fase 0 — Lectura obligatoria
- Leer toda la memoria técnica.
- Detectar conflictos.
- Identificar dependencias.
- Confirmar stack, dominio y límites.
- Marcar riesgos y supuestos.

### Fase 1 — Arquitectura
- Definir módulos.
- Definir contratos de datos.
- Definir responsabilidades.
- Definir flujos críticos.
- Definir permisos.
- Definir estrategia de despliegue.

### Fase 2 — Backend
- Implementar dominio.
- Implementar base de datos.
- Implementar APIs.
- Implementar validaciones.
- Implementar seguridad.
- Implementar automatizaciones.
- Implementar pruebas.

### Fase 3 — Frontend
- Implementar experiencia pública.
- Implementar navegación.
- Implementar catálogo.
- Implementar ficha de producto.
- Implementar checkout.
- Implementar componentes reutilizables.

### Fase 4 — Dashboard
- Implementar administración.
- Implementar inventario.
- Implementar pedidos.
- Implementar ventas.
- Implementar reportes.
- Implementar roles.

### Fase 5 — QA y despliegue
- Pruebas unitarias.
- Pruebas de integración.
- Pruebas e2e.
- Pruebas de accesibilidad.
- Pruebas de rendimiento.
- CI/CD.
- Observabilidad.
- Release controlado.

## Formato de respuesta esperado de la IA
Cada entrega debe responder exactamente con:
1. Objetivo
2. Alcance
3. Supuestos
4. Dependencias
5. Riesgos
6. Cambios propuestos
7. Archivos afectados
8. Validaciones
9. Criterios Go/No-Go
10. Resultado verificable

## Regla de decisión
Si existe ambigüedad:
- no improvisar
- proponer la opción más segura y escalable
- documentar el criterio
- continuar solo si no rompe el sistema

## Criterios de calidad
Toda salida debe cumplir:
- consistencia semántica
- consistencia técnica
- consistencia visual
- consistencia operacional
- consistencia entre archivos
- consistencia con el dominio comercial

## Definición de “listo”
Un módulo solo se considera listo si:
- compila
- pasa pruebas
- tiene documentación
- está enlazado al sistema
- tiene manejo de errores
- tiene validación
- tiene trazabilidad
- no rompe nada existente

## Instrucción final
La IA no está aquí para experimentar sin control. Está aquí para construir una plataforma enterprise sólida, medible, mantenible y escalable.


<!-- FILE: 01_ARCHITECTURE.md -->

# 01_ARCHITECTURE.md — Arquitectura general de DistriTools JL

## Visión
DistriTools JL será una plataforma de e-commerce industrial con catálogo profundo, checkout sin login para clientes, administración centralizada, inventario perpetuo, pagos integrados y panel de control robusto. La arquitectura debe equilibrar velocidad, SEO, mantenibilidad y escalabilidad.

## Decisión base
### Estrategia
- **Backend-first**
- **Frontend desacoplado del dominio**
- **UI moderna basada en componentes**
- **Base de datos relacional**
- **API como contrato central**
- **Dashboard administrativo protegido**
- **Automatización de inventario, pagos y pedidos**

### Estilo arquitectónico
Se recomienda una de estas dos opciones:

#### Opción recomendada: modular monolith
Adecuada para fase 1 y fase 2.
- Menor complejidad operativa
- Más rapidez de entrega
- Mejor trazabilidad
- Facilidad para escalar por módulos

#### Evolución posterior: servicios separados
Cuando el volumen lo exija:
- auth
- catálogo
- pedidos
- pagos
- inventario
- notificaciones
- analítica

## Stack recomendado
### Frontend público
- Next.js
- React
- TypeScript
- Tailwind CSS o sistema de design tokens equivalente
- React Server Components donde aporte valor
- SSR/SSG/ISR para SEO y performance

### Backend
- Node.js
- TypeScript
- Framework: NestJS o Express estructurado por módulos
- Validación con DTOs y schemas
- Jobs asíncronos con cola
- OpenAPI como contrato

### Datos
- PostgreSQL
- Redis para caché, sesiones internas, rate limiting y colas ligeras
- ORM: Prisma o equivalente con migraciones

### Infraestructura
- Docker
- CI/CD
- Entornos: dev, staging, prod
- Object storage para imágenes
- CDN para assets
- Observabilidad centralizada

## Capas del sistema
### 1. Capa pública
- Home
- Categorías
- Subcategorías
- Buscador global
- Producto
- Carrito
- Checkout
- FAQ
- Soporte
- Contacto

### 2. Capa transaccional
- Pedido
- Pago
- Confirmación
- Facturación si aplica
- Actualización de stock
- Notificaciones

### 3. Capa administrativa
- Dashboard
- Productos
- Categorías
- Inventario
- Pedidos
- Domicilios
- Clientes de pedido
- Reportes
- Métricas
- Promociones
- Contenido
- Usuarios internos
- Roles

### 4. Capa de automatización
- confirmación de pedido
- recordatorios de pago
- actualización de stock
- alerta de stock bajo
- notificación a operaciones
- alertas de caída de pasarela
- reportes diarios y semanales

## Flujo de negocio principal
1. Usuario entra al catálogo.
2. Busca o navega por categorías.
3. Agrega productos al carrito.
4. Completa checkout sin registro.
5. El sistema crea el pedido.
6. Se inicia el cobro.
7. El webhook confirma pago.
8. El stock se descuenta.
9. Operaciones recibe la orden.
10. Se despacha el pedido.
11. El dashboard refleja el estado.

## Principios de diseño técnico
- No duplicar lógica de negocio.
- El stock se calcula a partir del inventario disponible menos reservas y salidas.
- Toda transacción crítica debe ser idempotente.
- Los eventos importantes deben persistirse.
- Los estados de pedidos deben ser explícitos.
- Los pagos deben verificarse por webhook y no solo por frontend.
- El dashboard no debe depender de información manual cuando exista fuente oficial.

## Entidades del dominio
- Product
- Category
- Brand
- InventoryItem
- StockMovement
- Cart
- Order
- OrderItem
- Payment
- Shipment
- CustomerLead
- AdminUser
- Role
- Permission
- Promotion
- Review
- Notification
- AuditLog

## Eventos de dominio
- product.created
- product.updated
- stock.adjusted
- order.created
- payment.initiated
- payment.confirmed
- payment.failed
- shipment.created
- shipment.delivered
- low_stock.alerted
- promotion.activated

## Reglas de escalabilidad
- Separar lectura y escritura cuando el volumen lo requiera.
- Evitar queries pesadas en páginas públicas.
- Paginación y filtros obligatorios.
- Índices en campos de búsqueda y relaciones críticas.
- Imágenes optimizadas y servidas por CDN.
- Procesos largos deben ir a cola.
- Webhooks validados con firma.
- Logs estructurados y correlacionados.

## Reglas de seguridad
- HTTPS obligatorio
- JWT o sesión segura para admin
- RBAC para permisos
- protección CSRF si aplica
- rate limiting
- sanitización de inputs
- headers de seguridad
- control de acceso por rol
- auditoría de acciones críticas
- secretos fuera del código

## Reglas de UX/SEO
- navegación clara
- URLs limpias
- breadcrumbs
- metadatos por página
- structured data donde aplique
- contenido indexable en categorías y productos
- performance móvil primero

## Go/No-Go de arquitectura
### Go
- el modelo de datos está definido
- las relaciones están claras
- el stack está aprobado
- el flujo de pedido/pago/stock está cerrado

### No-Go
- hay ambigüedad en el flujo de pago
- no existe plan de inventario
- el dashboard no tiene permisos
- la experiencia depende de login del cliente

## Resultado esperado
Esta arquitectura debe permitir construir una plataforma robusta, clara y escalable con una base adecuada para crecer sin reescrituras tempranas.


<!-- FILE: 02_BACKEND_GUIDE.md -->

# 02_BACKEND_GUIDE.md — Guía de backend

## Objetivo
Definir cómo se construye el backend enterprise de DistriTools JL para que la IA no improvise y mantenga consistencia entre dominio, base de datos, APIs y operaciones.

## Responsabilidad del backend
El backend es la fuente de verdad para:
- productos
- categorías
- inventario
- pedidos
- pagos
- domicilios
- promociones
- permisos
- reportes
- notificaciones
- auditoría

## Estructura recomendada del proyecto
```text
src/
  app/
    app.module.ts
    bootstrap.ts
  modules/
    auth/
    users/
    roles/
    products/
    categories/
    brands/
    inventory/
    stock-movements/
    carts/
    orders/
    order-items/
    payments/
    shipments/
    notifications/
    promotions/
    reports/
    analytics/
    audit/
    settings/
  common/
    dto/
    guards/
    interceptors/
    pipes/
    filters/
    utils/
    constants/
    errors/
    pagination/
  infra/
    db/
    cache/
    queue/
    storage/
    payment-gateway/
    whatsapp/
    email/
    logger/
  tests/
  contracts/
  docs/
```

## Principios de implementación
- Cada módulo debe ser independiente.
- Cada módulo debe exponer su contrato.
- La lógica debe vivir en servicios de dominio, no en controladores.
- Los controladores solo validan, enrutan y traducen respuestas.
- Las operaciones críticas deben ser transaccionales.
- Todo cambio debe registrar audit log.

## Autenticación
### Admin
- solo usuarios internos
- login seguro
- refresh token o sesión segura
- RBAC
- opcional 2FA

### Cliente
- no hay cuenta obligatoria
- el flujo es guest checkout
- se identifican por datos de contacto en pedido

## Módulos backend críticos
### Auth
- iniciar sesión admin
- renovar sesión
- cerrar sesión
- recuperar contraseña admin
- 2FA si se activa

### Products
- crear producto
- actualizar producto
- cambiar estado
- asignar categorías
- asignar marca
- precio
- imágenes
- atributos
- variantes si aplica

### Categories
- CRUD jerárquico
- categorías padres e hijas
- orden
- slugs
- SEO metadata

### Inventory
- stock actual
- stock reservado
- stock disponible
- stock mínimo
- stock por almacén si aplica
- stock bajo
- movimientos
- ajustes manuales con motivo

### Orders
- crear pedido
- reservar stock
- consultar pedido
- actualizar estado
- cancelar
- marcar despachado
- marcar entregado
- notas internas

### Payments
- iniciar pago
- registrar intención
- confirmar webhook
- manejar rechazo
- prevenir duplicados
- conciliar estado

### Shipments
- crear domicilio
- asignar transportador
- número de guía
- estado de entrega
- actualización manual o por webhook

### Reports
- ventas por día
- productos más vendidos
- categoría top
- tasa de conversión
- stock crítico
- pedidos pendientes
- pagos aprobados
- devoluciones

### Notifications
- correo
- WhatsApp
- alertas internas
- eventos de negocio

### Audit
- quien hizo qué
- cuándo
- desde qué IP o sesión
- antes/después si aplica

## Reglas de consistencia
- Un pedido no puede existir sin items.
- Un pago no puede confirmarse sin referencia y validación.
- Un stock no puede quedar negativo.
- Un ajuste manual requiere motivo.
- Un producto desactivado no debe venderse.
- Un estado de pedido no puede saltarse pasos inválidos.
- Una orden pagada no se puede duplicar.

## Manejo de transacciones
### Casos que deben ser atómicos
- crear pedido + items + reserva de stock
- confirmar pago + actualizar pedido + descontar stock
- cancelar pedido + revertir reserva
- devolver pedido + ajustar stock

### Recomendación
Usar transacciones SQL para las operaciones críticas. Si falla un paso, revertir todo el bloque.

## Idempotencia
Todo webhook debe ser idempotente.
Todo proceso de pago debe tolerar reintentos sin duplicar pedido o cobro.

## Validación de input
- DTOs
- schemas estrictos
- sanitización
- campos requeridos
- formatos válidos
- límites de tamaño
- tipos correctos

## Logging
Cada solicitud relevante debe registrar:
- request id
- user id si existe
- módulo
- operación
- duración
- estado
- error si existe

## Manejo de errores
Definir errores estándar:
- 400 invalid_request
- 401 unauthorized
- 403 forbidden
- 404 not_found
- 409 conflict
- 422 business_rule_violation
- 500 internal_error

## Jobs y colas
Usar jobs para:
- envío de correos
- notificaciones WhatsApp
- reconciliación de pagos
- reporte diario
- alerta de stock bajo
- limpieza de registros temporales

## Performance backend
- índices SQL correctos
- consultas paginadas
- evitar N+1
- cache para datos de lectura frecuentes
- respuestas compactas
- serialización consistente

## Seguridad backend
- rate limit en login admin
- validación de webhooks por firma
- hashes seguros de contraseña
- secretos en vault o env seguro
- auditoría en cambios críticos
- CORS controlado
- headers de seguridad

## Pruebas backend
- unit tests por servicio
- integration tests por módulo
- contract tests para APIs
- tests de webhook
- tests de transacciones
- tests de permisos

## Criterio de calidad
Un módulo backend no se considera listo si:
- no tiene pruebas
- no tiene logs
- no tiene validaciones
- no maneja errores
- no documenta contrato
- no respeta roles
- no protege datos

## Entregable esperado
El backend debe quedar como una base sólida para operar el e-commerce y administrar la empresa sin deuda técnica inmediata.


<!-- FILE: 03_DATABASE_SCHEMA.md -->

# 03_DATABASE_SCHEMA.md — Esquema de base de datos

## Objetivo
Definir una base de datos SQL robusta, extensible y consistente para e-commerce, administración, inventario y trazabilidad.

## Recomendación
- PostgreSQL como motor principal
- migraciones versionadas
- constraints estrictas
- timestamps en UTC
- soft delete solo donde tenga sentido
- auditoría obligatoria en cambios críticos

## Convenciones
- tablas en plural
- campos en snake_case
- claves primarias `id` UUID o BIGINT según decisión
- `created_at`, `updated_at`, `deleted_at` cuando aplique
- `status` con enums o tablas de catálogos
- FKs explícitas

## Tablas principales

### 1. users
Usuarios internos.
- id
- full_name
- email
- password_hash
- phone
- role_id
- is_active
- last_login_at
- created_at
- updated_at

### 2. roles
- id
- name
- slug
- description
- created_at
- updated_at

### 3. permissions
- id
- name
- slug
- module
- description

### 4. role_permissions
- id
- role_id
- permission_id

### 5. categories
- id
- parent_id
- name
- slug
- description
- sort_order
- seo_title
- seo_description
- is_active
- created_at
- updated_at

### 6. brands
- id
- name
- slug
- logo_url
- website_url
- is_active

### 7. products
- id
- category_id
- brand_id
- sku
- name
- slug
- short_description
- long_description
- price
- compare_at_price
- cost_price
- tax_rate
- is_active
- is_featured
- is_new
- created_at
- updated_at

### 8. product_images
- id
- product_id
- url
- alt_text
- sort_order
- is_primary

### 9. product_attributes
- id
- product_id
- attribute_name
- attribute_value
- sort_order

### 10. warehouses
- id
- name
- location
- is_active

### 11. inventory_items
- id
- product_id
- warehouse_id
- on_hand_qty
- reserved_qty
- available_qty
- min_qty
- max_qty
- updated_at

### 12. stock_movements
- id
- product_id
- warehouse_id
- movement_type
- quantity
- reason
- reference_type
- reference_id
- created_by_user_id
- created_at

### 13. carts
- id
- session_key
- customer_name
- customer_email
- customer_phone
- created_at
- updated_at

### 14. cart_items
- id
- cart_id
- product_id
- quantity
- unit_price
- created_at
- updated_at

### 15. orders
- id
- order_number
- customer_name
- customer_email
- customer_phone
- shipping_address
- shipping_city
- shipping_notes
- subtotal
- discount_total
- tax_total
- shipping_total
- grand_total
- order_status
- payment_status
- fulfillment_status
- created_at
- updated_at

### 16. order_items
- id
- order_id
- product_id
- product_name_snapshot
- sku_snapshot
- unit_price_snapshot
- quantity
- total_price

### 17. payments
- id
- order_id
- gateway
- gateway_reference
- transaction_id
- amount
- currency
- payment_status
- confirmed_at
- raw_payload
- created_at
- updated_at

### 18. shipments
- id
- order_id
- carrier_name
- tracking_number
- shipment_status
- shipped_at
- delivered_at
- notes

### 19. promotions
- id
- name
- slug
- type
- value
- start_date
- end_date
- is_active

### 20. product_promotions
- id
- product_id
- promotion_id

### 21. customer_leads
- id
- full_name
- email
- phone
- source
- status
- notes
- created_at
- updated_at

### 22. notifications
- id
- type
- channel
- recipient
- subject
- body
- status
- related_type
- related_id
- sent_at
- created_at

### 23. audit_logs
- id
- actor_user_id
- action
- entity_type
- entity_id
- before_data
- after_data
- ip_address
- user_agent
- created_at

### 24. settings
- id
- key
- value
- description
- updated_at

## Reglas de integridad
- `products.category_id` debe existir.
- `products.brand_id` debe existir si la marca es obligatoria.
- `inventory_items.available_qty = on_hand_qty - reserved_qty`.
- `orders.grand_total` debe ser calculado y persistido.
- `order_items` deben guardar snapshot para historial.
- `payments.order_id` debe ser único por transacción principal o controlado por índice compuesto según gateway.
- `audit_logs` nunca se borran salvo política legal.

## Índices recomendados
- products.slug
- products.name
- categories.slug
- orders.order_number
- orders.order_status
- orders.payment_status
- inventory_items.product_id
- stock_movements.product_id
- payments.gateway_reference
- customer_leads.email
- customer_leads.phone

## Estados sugeridos
### order_status
- draft
- pending_payment
- paid
- packed
- shipped
- delivered
- cancelled
- refunded

### payment_status
- pending
- approved
- rejected
- refunded
- cancelled

### fulfillment_status
- pending
- preparing
- ready_to_ship
- shipped
- delivered

### stock movement types
- sale
- purchase
- adjustment
- reservation
- release
- return
- damage
- transfer

## Migraciones
- toda modificación de esquema debe ir en migración
- nunca editar tablas manualmente sin migración
- agregar datos semilla controlada
- documentar rollback

## Auditoría de cambios
Los cambios a productos, precios, stock, pedidos y pagos deben dejar rastro.

## Criterio de aceptación
La base de datos es válida cuando:
- compila migraciones sin error
- integridad referencial está garantizada
- los estados cubren todos los flujos
- el stock se puede calcular correctamente
- el histórico se conserva


<!-- FILE: 04_API_SPEC.md -->

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


<!-- FILE: 05_DASHBOARD_SPEC.md -->

# 05_DASHBOARD_SPEC.md — Especificación del dashboard administrativo

## Objetivo
Construir un panel administrativo centralizado para operar la tienda, controlar stock, atender pedidos, medir ventas y ejecutar decisiones.

## Principios de diseño
- rapidez
- claridad
- densidad de información controlada
- jerarquía visual fuerte
- cero ruido innecesario
- orientado a decisiones
- roles y permisos estrictos

## Módulos principales
### 1. Vista general
- ventas del día
- ventas del mes
- pedidos pendientes
- pagos aprobados
- stock bajo
- top productos
- alertas operativas

### 2. Productos
- listado
- crear
- editar
- activar/desactivar
- atributos
- imágenes
- precios
- variantes
- promociones

### 3. Inventario
- stock por producto
- stock por almacén si existe
- movimientos
- ajustes
- reservas
- alertas

### 4. Pedidos
- cola de pedidos
- estados
- detalle de cliente
- detalle de items
- pago
- envío
- historial
- acciones rápidas

### 5. Domicilios / despacho
- guía
- transportador
- estado
- fecha
- trazabilidad

### 6. Ventas
- totales
- ticket promedio
- top categorías
- top productos
- comparación por periodo

### 7. Clientes / leads
- contactos
- historial de pedidos
- estado comercial
- fuente de adquisición
- seguimiento

### 8. Promociones
- campañas
- descuentos
- productos asociados
- fechas
- activación/desactivación

### 9. Contenido
- banners
- secciones home
- anuncios
- publicaciones destacadas

### 10. Usuarios internos
- admins
- roles
- permisos
- auditoría

## Roles sugeridos
- SuperAdmin
- Gerente Operativo
- Inventario
- Ventas
- Soporte
- Marketing
- Despacho
- Finanzas

## KPIs críticos
- tasa de conversión
- pedidos por canal
- ventas por categoría
- stock disponible
- stock crítico
- tiempo de despacho
- pedidos cancelados
- pagos aprobados
- abandono de carrito
- tickets de soporte

## Componentes de UI
- tarjetas KPI
- tablas densas con filtros
- drawer lateral de detalle
- modales de confirmación
- chips de estado
- gráficos de serie temporal
- alertas visibles
- barra de búsqueda global

## Reglas de operación
- toda acción crítica requiere confirmación
- toda modificación importante deja registro
- el usuario ve solo lo que su rol permite
- el dashboard debe ser rápido incluso con grandes volúmenes

## Experiencia de uso
El panel debe permitir:
- buscar un pedido en menos de 3 segundos
- actualizar stock con pocos clics
- cambiar estado de despacho con trazabilidad
- detectar productos críticos visualmente
- revisar ventas sin exportar archivos externos

## Criterios de aceptación
- navegación clara
- permisos correctos
- acciones críticas auditadas
- rendimiento alto
- métricas confiables
- cero dependencia del login de clientes


<!-- FILE: 06_ECOMMERCE_SPEC.md -->

# 06_ECOMMERCE_SPEC.md — Especificación del e-commerce público

## Objetivo
Diseñar una tienda online de estilo industrial, robusta y muy similar en lógica funcional a un e-commerce de catálogo profundo, pero con identidad visual propia y sin login para clientes.

## Principios de UX
- compra rápida
- navegación clara
- buscador visible
- catálogo jerárquico
- tarjetas de producto limpias
- filtros potentes
- CTA visibles
- flujo guest-first
- mobile-first
- accesibilidad

## Estructura del sitio
### Header
- logo
- menú
- buscador
- categorías
- carrito
- WhatsApp
- CTA destacado

### Home
- hero comercial
- categorías destacadas
- marcas
- productos destacados
- promociones
- beneficios
- confianza
- contacto rápido

### Categoría
- título SEO
- descripción breve
- subcategorías
- filtros
- ordenamiento
- lista de productos
- contenido de apoyo

### Subcategoría
- navegación contextual
- breadcrumbs
- filtros específicos
- productos relevantes

### Ficha de producto
Debe incluir:
- nombre
- SKU
- galería
- precio
- precio anterior si aplica
- disponibilidad
- descripción corta
- descripción técnica
- especificaciones
- beneficios
- uso recomendado
- productos relacionados
- preguntas frecuentes
- botón comprar
- botón WhatsApp
- comparación

### Carrito
- resumen
- cantidades
- impuestos
- envío
- total
- CTA checkout

### Checkout
- datos del cliente
- dirección
- método de pago
- revisión final
- confirmación

### Confirmación
- número de pedido
- estado
- próximos pasos
- soporte
- WhatsApp

## Búsqueda
- autocompletado
- corrección parcial
- resultados por nombre, SKU, marca y categoría
- resultados rápidos

## Filtros
- categoría
- marca
- precio
- disponibilidad
- características
- promociones

## Comparador
- comparar 2 a 4 productos
- atributos técnicos
- precio
- garantía
- recomendación

## Reglas de compra
- no login obligatorio
- formularios cortos
- validaciones claras
- estados visibles
- mensajes de error útiles

## SEO
- URLs limpias
- meta titles y descriptions
- breadcrumbs
- schema estructurado si aplica
- contenido indexable

## Contenido comercial
- promociones
- novedades
- best sellers
- bundles
- recomendaciones por uso

## Criterios de aceptación
- compra clara y rápida
- navegación fluida
- catálogo escalable
- sin fricción de registro
- fuerte capacidad de conversión


<!-- FILE: 07_UX_UI_SYSTEM.md -->

# 07_UX_UI_SYSTEM.md — Sistema de UX/UI

## Objetivo
Definir un sistema visual enterprise moderno para que todo el producto tenga consistencia, jerarquía, accesibilidad y percepción robusta.

## Dirección visual
La marca debe verse:
- industrial
- moderna
- segura
- eficiente
- técnica
- profesional
- confiable

## Paleta base
- Negro industrial: `#111111`
- Amarillo seguridad: `#F5B700`
- Gris acero: `#6E6E6E`
- Blanco técnico: `#F5F5F5`
- Azul acento opcional: `#1F6FEB`

## Tokens sugeridos
```css
:root {
  --color-bg: #F5F5F5;
  --color-surface: #FFFFFF;
  --color-surface-dark: #111111;
  --color-primary: #F5B700;
  --color-secondary: #6E6E6E;
  --color-text: #111111;
  --color-text-inverse: #F5F5F5;
  --color-accent: #1F6FEB;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow-soft: 0 10px 30px rgba(0,0,0,.08);
}
```

## Tipografía
- títulos: sans geométrica fuerte
- cuerpo: sans limpia de alta legibilidad
- números: con peso suficiente para dashboards

## Sistema de componentes
### Base
- botones primarios
- botones secundarios
- inputs
- selects
- chips
- badges
- cards
- tabs
- accordions
- modals
- drawers
- tables
- empty states
- loaders
- skeletons

### Comerciales
- product card
- category card
- brand logo strip
- pricing block
- stock status chip
- compare button
- add to cart CTA
- whatsapp CTA

### Dashboard
- KPI card
- data table
- filter bar
- status timeline
- side drawer
- graph card
- alert banner

## Layout
### Principios
- mobile first
- grid consistente
- spacing sistemático
- lectura rápida
- contraste alto
- no saturar visualmente

## Accesibilidad
Obligatorio:
- contraste suficiente
- foco visible
- navegación por teclado
- `alt` en imágenes
- etiquetas en formularios
- texto legible
- jerarquía semántica
- estados de error comprensibles

## Performance UX
- imágenes optimizadas
- carga progresiva
- skeletons
- evitar saltos de layout
- lazy loading donde conviene
- priorizar contenido principal

## Consistencia visual
Todo debe compartir:
- misma escala de espaciado
- mismo radio
- misma familia tipográfica
- mismos estados de interacción
- mismos colores semánticos

## Uso del logo
Debe existir:
- versión horizontal
- versión vertical
- isotipo
- favicon
- marca monocroma
- marca invertida

## Criterios de aceptación
- la interfaz se ve enterprise
- la interfaz es usable
- la interfaz es accesible
- la interfaz es coherente entre módulos
- el dashboard y el e-commerce parecen parte del mismo sistema


<!-- FILE: 08_QA_AND_GATES.md -->

# 08_QA_AND_GATES.md — QA, validación y Go/No-Go

## Objetivo
Impedir que se entreguen cambios débiles, incompletos o inseguros. Ninguna implementación debe pasar sin control de calidad.

## Estrategia de QA
- pruebas unitarias
- pruebas de integración
- pruebas e2e
- pruebas de API
- pruebas de seguridad
- pruebas de rendimiento
- pruebas de accesibilidad
- pruebas visuales
- pruebas de regresión

## Niveles de validación
### Nivel 1 — Código
- compila
- no rompe lint
- no rompe tipado
- no deja errores obvios

### Nivel 2 — Negocio
- respeta reglas de stock
- respeta reglas de pedidos
- respeta reglas de pago
- respeta roles

### Nivel 3 — UX
- navegación clara
- mensajes correctos
- formularios útiles
- responsive real

### Nivel 4 — Operación
- stock actualiza
- pedidos fluyen
- pagos confirman
- dashboard refleja realidad

### Nivel 5 — Producción
- observabilidad
- rollback
- logs
- seguridad
- performance

## Gate de backend
No se aprueba si:
- hay endpoints sin validación
- hay lógica de negocio en controladores
- no existen tests críticos
- el webhook no es idempotente
- el stock puede quedar negativo
- no existe auditoría

## Gate de frontend
No se aprueba si:
- rompe responsive
- falla accesibilidad básica
- no hay estados de carga
- no hay manejo de error
- no hay consistencia visual
- no funciona en móvil

## Gate de dashboard
No se aprueba si:
- permisos fallan
- métricas no cuadran
- tablas no filtran
- acciones críticas no auditan
- el usuario ve datos fuera de su rol

## Gate de pagos
No se aprueba si:
- la confirmación depende solo del frontend
- el webhook no se valida
- se duplican transacciones
- el pedido y el pago quedan desincronizados

## Gate de inventario
No se aprueba si:
- el stock no se descuenta correctamente
- no existe reserva
- no existe movimiento
- no existe historial
- no hay alertas de stock bajo

## Checklist de lanzamiento
- [ ] pruebas unitarias críticas
- [ ] pruebas e2e de compra completa
- [ ] webhook validado
- [ ] auditoría activa
- [ ] dashboard con roles
- [ ] accesibilidad básica aprobada
- [ ] performance aceptable
- [ ] backups activos
- [ ] rollback probado
- [ ] documentación actualizada

## Definición de fail
Cualquier fallo en:
- seguridad
- pagos
- stock
- roles
- datos críticos
implica bloqueo total.

## Definición de pass
Solo pasa si:
- funciona
- está documentado
- está probado
- está trazado
- está alineado al negocio


<!-- FILE: 09_DEPLOYMENT.md -->

# 09_DEPLOYMENT.md — Despliegue y operación

## Objetivo
Definir cómo se publica el sistema con seguridad, control y posibilidad de rollback.

## Entornos
- development
- staging
- production

## Variables de entorno
Toda configuración sensible debe vivir fuera del código:
- DATABASE_URL
- REDIS_URL
- JWT_SECRET
- PAYMENT_GATEWAY_SECRET
- WHATSAPP_API_TOKEN
- STORAGE_BUCKET
- CDN_URL
- APP_BASE_URL

## Infraestructura sugerida
- Docker para contenedores
- CI/CD para build y pruebas
- base de datos administrada o altamente respaldada
- storage de imágenes
- CDN
- logs centralizados
- alertas de error

## Flujo de despliegue
1. merge a rama principal controlada
2. correr pruebas
3. construir artefactos
4. ejecutar migraciones
5. desplegar staging
6. validar smoke tests
7. promover a producción
8. monitorear métricas
9. activar rollback si falla

## Reglas de migración
- primero staging
- luego producción
- jamás migrar sin backup
- documentar cambios de esquema
- probar rollback

## Observabilidad
Debe incluir:
- logs estructurados
- métricas
- trazas
- alertas
- health checks

## Backups
- backup automático de base de datos
- backup de assets críticos
- retención definida
- restauración probada

## Seguridad de despliegue
- secretos en vault o gestor seguro
- acceso mínimo necesario
- deploy sin credenciales expuestas
- protección de rama principal
- review obligatorio

## Rollback
Debe existir:
- rollback de aplicación
- rollback de migración si aplica
- rollback de configuración
- rollback de assets si afecta UI crítica

## Criterio de aceptación
El sistema está listo para producción cuando:
- build estable
- migraciones sanas
- pruebas verdes
- monitoreo activo
- rollback probado
- soporte operativo disponible


<!-- FILE: 10_CODEx_PROMPTS.md -->

# 10_CODEx_PROMPTS.md — Biblioteca de prompts para IA Codes

## Objetivo
Dar a IA Codes instrucciones suficientemente estrictas para construir cada módulo sin improvisación.

## Instrucciones globales
- Leer memoria técnica antes de hacer cualquier cambio.
- No asumir reglas de negocio no documentadas.
- No implementar sin validación.
- No tocar archivos no relacionados.
- No romper compatibilidad sin documentar.
- Mantener arquitectura modular.
- Entregar resultados verificables.
- Si falta información crítica, reportar el bloqueo antes de avanzar.

## Prompt 1 — Arquitectura general
```text
Analiza el repositorio y construye la arquitectura base de DistriTools JL.
Debes identificar stack, módulos, flujo de datos, dominios críticos, dependencias, riesgos y orden de implementación.
No generes código todavía. Primero entrega:
1. mapa de arquitectura
2. mapa de módulos
3. mapa de riesgos
4. prioridades
5. decisiones técnicas recomendadas
6. criterios Go/No-Go
```

## Prompt 2 — Base de datos
```text
Diseña el esquema SQL completo para la plataforma.
Incluye tablas, relaciones, claves foráneas, índices, restricciones, estados y auditoría.
La base debe soportar e-commerce, inventario, pedidos, pagos, despacho, dashboard y logs.
Entrega DDL, explicación de relaciones y observaciones de integridad.
```

## Prompt 3 — Backend
```text
Implementa el backend modular de DistriTools JL.
Debes separar servicios por dominio, mantener validación estricta, transacciones, auditoría, idempotencia y pruebas.
No mezcles lógica de negocio en controladores.
Entrega código limpio, pruebas y documentación de endpoints.
```

## Prompt 4 — Inventario
```text
Implementa un inventario perpetuo con reservas, movimientos, stock mínimo y alertas.
La venta debe descontar stock únicamente mediante flujo transaccional y registrar movimiento histórico.
Incluye pruebas de stock, cancelación, devolución y ajuste manual.
```

## Prompt 5 — Pagos
```text
Implementa integración de pagos segura con confirmación por webhook.
La confirmación del pedido no puede depender del frontend.
Debes manejar reintentos, idempotencia, duplicados, rechazo y conciliación.
Incluye pruebas de sandbox y casos de error.
```

## Prompt 6 — Frontend público
```text
Construye el e-commerce público con UX moderna, responsive, accesible y de alta conversión.
Debe incluir home, categorías, subcategorías, producto, carrito, checkout, confirmación y soporte.
No debe tener login para clientes.
Debes optimizar SEO y performance.
```

## Prompt 7 — Dashboard
```text
Construye el dashboard administrativo con roles y permisos.
Debe mostrar ventas, pedidos, stock, domicilios, promociones, reportes y auditoría.
La interfaz debe ser densa, clara y rápida.
Cada acción crítica debe dejar rastro.
```

## Prompt 8 — UX/UI system
```text
Aplica el sistema visual corporativo completo a todo el producto.
Usa los tokens definidos, garantiza accesibilidad, consistencia y jerarquía visual.
Debes producir componentes reutilizables y documentar su uso.
```

## Prompt 9 — QA
```text
Genera y ejecuta pruebas unitarias, de integración, e2e, accesibilidad y rendimiento.
Define criterios de aprobación y bloqueo.
No pases a producción si alguna validación crítica falla.
```

## Prompt 10 — Deploy
```text
Prepara el sistema para despliegue controlado.
Incluye variables de entorno, migraciones, back up, monitoreo, health checks y rollback.
La entrega final debe ser reproducible y segura.
```

## Prompt de bloqueo
```text
Antes de modificar cualquier archivo, revisa memoria técnica y estado actual del sistema.
Si el cambio puede afectar stock, pago, pedido, permisos o navegación crítica, debes proponer primero el plan de impacto.
No hagas cambios sin justificar dependencias, riesgos y pruebas asociadas.
```

## Orden recomendado de ejecución
1. 00_MASTER_PROMPT
2. 01_ARCHITECTURE
3. 03_DATABASE_SCHEMA
4. 02_BACKEND_GUIDE
5. 04_API_SPEC
6. 05_DASHBOARD_SPEC
7. 06_ECOMMERCE_SPEC
8. 07_UX_UI_SYSTEM
9. 08_QA_AND_GATES
10. 09_DEPLOYMENT

## Criterio final
La IA Codes debe operar como un equipo enterprise disciplinado, no como un generador de fragmentos sueltos.
