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
