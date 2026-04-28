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
