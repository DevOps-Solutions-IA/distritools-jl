# AUDITORÍA COMPLETA — DistriTools JL

**Fecha**: 2026-05-15
**Alcance**: Repositorio completo — 300+ archivos auditados línea por línea
**Agentes de auditoría**: 5 agentes en paralelo
**Hallazgos totales**: **145+**

---

## CALIFICACIÓN FINAL: 47/100

| Dimensión | Peso | Puntuación | Nota |
|-----------|------|------------|------|
| Arquitectura y diseño | 20% | 14/20 | La arquitectura hexagonal está bien definida conceptualmente pero violada en 11+ use cases y 3 God Controllers |
| Seguridad | 25% | 7/25 | Sin rate limiting, 2FA en texto plano, JWT sin validación contra BD, auth del frontend ilusoria, Redis sin contraseña, CORS abierto |
| Integridad de negocio | 20% | 10/20 | Transacciones bien usadas en flujos críticos pero bugs en validación post-commit, race conditions, y máquina de estados sin tests |
| Calidad de código | 15% | 8/15 | Uso generalizado de `as never`, God Controllers, código muerto, `process.env` directo, PrismaService en capa application |
| Testing | 10% | 3/10 | `npm test` no ejecuta pruebas, tests con estado compartido, assertions frágiles, falsa cobertura de seguridad |
| Frontend | 10% | 5/10 | Funcionalidades rotas (contacto no envía datos, auth ilusoria), bugs de lógica en checkout/precios, UX degradada |

---

## HALLAZGOS CRÍTICOS (14)

### C1 — Payload JWT aceptado sin verificación contra base de datos
- **Archivo**: `src/modules/auth/infrastructure/security/jwt.strategy.ts:24-26`
- **Problema**: `validate()` retorna el payload del JWT sin verificar si la sesión existe, si el usuario está activo, o si sus permisos han cambiado. Un token robado de un usuario desactivado sigue funcionando hasta que expire (15 min access, 7 días refresh).
- **Impacto**: Sin revocación real de tokens. Permisos en el JWT (Hallazgo C2) nunca se verifican contra el estado actual del usuario.

### C2 — Permisos incrustados en JWT sin verificación posterior
- **Archivo**: `src/modules/auth/infrastructure/security/jwt-token.service.ts:42-56`
- **Problema**: Los permisos se codifican en el JWT al momento de emisión. `JwtStrategy.validate()` no verifica contra BD. `PermissionsGuard` usa los permisos del token. Cambios de rol/permisos no surten efecto hasta que el token expire.
- **Impacto**: Un usuario degradado mantiene sus permisos anteriores por hasta 15 minutos. Sin trazabilidad.

### C3 — Bypass de autenticación activable accidentalmente
- **Archivo**: `src/common/security/dev-admin-bypass.ts:114-116`
- **Problema**: `APP_ENV !== 'production'` usa negación — si `APP_ENV` no está definida, la condición es `true`. Con `ADMIN_AUTH_DISABLED=true`, acceso super-admin total sin autenticación.
- **Impacto**: Exposición completa del sistema si `APP_ENV` no se configura explícitamente.

### C4 — Secretos 2FA almacenados en texto plano en base de datos
- **Archivo**: `prisma/schema.prisma:18` — campo `twoFactorSecret String?`
- **Problema**: El secreto TOTP se almacena sin cifrar. Una brecha de base de datos expone todos los secretos 2FA.
- **Impacto**: Un atacante con acceso a la BD puede generar códigos TOTP válidos para cualquier usuario. El 2FA es ilusorio.

### C5 — Middleware del frontend solo verifica existencia del cookie, no valida el JWT
- **Archivo**: `frontend/src/middleware.ts:20`
- **Código**: `const hasAccessCookie = Boolean(request.cookies.get(ADMIN_ACCESS_COOKIE)?.value);`
- **Problema**: Cualquier string no-vacío en el cookie `dt_admin_access` da acceso al panel admin. No se verifica firma, expiración ni validez del token.
- **Impacto**: Un cookie seteado por XSS, malware o manipulación directa otorga acceso administrativo completo.

### C6 — Formulario de contacto NO envía datos a ningún backend
- **Archivo**: `frontend/src/components/contact/ContactRequestForm.tsx:28-42`
- **Problema**: `onSubmit` solo ejecuta validación local y setea `submitted=true`. No hay llamada fetch/POST a ningún endpoint.
- **Impacto**: Pérdida total de leads. El usuario cree que envió su solicitud pero nunca se persiste.

### C7 — Errores de pago PSE convertidos silenciosamente en éxito
- **Archivo**: `frontend/src/lib/api/checkout.ts:47-55`
- **Problema**: Si `initiatePayment()` lanza error, el catch retorna `{ kind: 'success', order: orderResponse, message: error.message }`.
- **Impacto**: El usuario ve confirmación de éxito cuando el pago falló. La orden queda en estado ambiguo sin que el usuario lo sepa.

### C8 — `npm test` ejecuta build en vez de pruebas
- **Archivo**: `package.json:22` — `"test": "npm run build"`
- **Problema**: El comando estándar `npm test` compila TypeScript en lugar de ejecutar tests. Cualquier CI/CD que use `npm test` tendrá falsa seguridad.
- **Impacto**: Tests nunca se ejecutan en pipelines que usen el comando estándar.

### C9 — `promptHidden()` silencia todo stdout durante prompts interactivos
- **Archivo**: `scripts/admin/credential-utils.ts:241-249`
- **Problema**: La función sobrescribe `output.write` silenciando TODO stdout excepto el texto que contiene el label del prompt. Errores y logs quedan ocultos.
- **Impacto**: Errores graves durante la ejecución de scripts admin pasan desapercibidos.

### C10 — God Controller: InventoryController (968 líneas)
- **Archivo**: `src/modules/inventory/infrastructure/http/controllers/inventory.controller.ts`
- **Problema**: Mezcla presentación HTTP, lógica de negocio, acceso directo a Prisma, y transformación de datos en un solo archivo de casi 1000 líneas.
- **Impacto**: Imposible de testear unitariamente. Alto riesgo de bugs en cada modificación.

### C11 — God Controller: ShippingController (797 líneas)
- **Archivo**: `src/modules/shipping/infrastructure/http/controllers/shipping.controller.ts`
- **Problema**: Igual que InventoryController — consultas directas a BD, lógica de negocio, webhook handling, y auditoría todo en el controller.
- **Impacto**: Mismo que C10.

### C12 — Validación de totales después del commit de base de datos
- **Archivo**: `src/modules/orders/application/use-cases/create-order.use-case.ts`
- **Problema**: La validación de `grandTotal` ocurre DESPUÉS del `prisma.$transaction`. Si falla, la transacción ya fue commiteada.
- **Impacto**: Órdenes con totales inconsistentes pueden persistirse. La validación post-commit no sirve como protección.

### C13 — Timing attack en login permite enumeración de cuentas
- **Archivo**: `src/modules/auth/application/use-cases/login.use-case.ts`
- **Problema**: La comparación de contraseña (bcrypt) solo ocurre si el usuario existe. Diferencia de tiempo de respuesta entre "usuario no existe" (~50ms) y "contraseña incorrecta" (~300ms por bcrypt).
- **Impacto**: Un atacante puede enumerar cuentas de administrador válidas midiendo tiempos de respuesta.

### C14 — AutoShippingService: 518 líneas con responsabilidades mezcladas
- **Archivo**: `src/modules/shipping/application/services/auto-shipping.service.ts`
- **Problema**: Mezcla consultas directas a Prisma, auditoría, eventos de dominio, notificaciones, selección de transportadoras, y creación de guías en un solo archivo.
- **Impacto**: Imposible de testear unitariamente. Alta complejidad ciclomática.

---

## HALLAZGOS ALTOS (22)

### Arquitectura
1. **11+ casos de uso inyectan PrismaService directamente** — Violación de arquitectura hexagonal en: analytics (3 use cases), products (5), inventory (1), search (2), variants (2). Capa de aplicación dependiendo de infraestructura.
2. **CORS abierto a todos los orígenes** (`bootstrap.ts:9`) — `cors: true` permite cualquier origen. Debe restringirse en producción.
3. **Sin `enableShutdownHooks()`** (`bootstrap.ts`) — Conexiones a DB/Redis se cierran abruptamente en SIGTERM/SIGINT.
4. **Event publisher in-memory sin persistencia** — Si un handler falla, el evento se pierde para siempre. Sin DLQ, sin reintentos.
5. **LoggerEventPublisher es código muerto** — Implementa `DomainEventPublisher` pero nunca se registra en ningún módulo.
6. **UsersController y RolesController inyectan PrismaService** — Métodos `list()` ejecutan queries directas sin pasar por repositorios ni casos de uso.

### Base de datos
7. **Order sin customerId** — Datos de cliente desnormalizados sin FK. Imposible hacer analítica de clientes a nivel de BD.
8. **InventoryReturnLine sin FK a variant/warehouse** — Sin integridad referencial. Posibles registros huérfanos.
9. **OrderItem.warehouseId sin FK a Warehouse** — Sin join type-safe desde Prisma.
10. **Unique constraint en StockMovement bloquea operaciones legítimas** — Ajustes múltiples para la misma variante/bodega fallan.
11. **Payment.rawPayload sin cifrar** — Datos potencialmente PCI/PII almacenados en texto plano.

### Seguridad
12. **Sin rate limiting global** — Login, 2FA, checkout y webhooks sin protección contra fuerza bruta o DoS.
13. **Redis sin autenticación** (`docker-compose.yml`) — Sin `--requirepass`. Cualquier contenedor en la red Docker puede ejecutar comandos.
14. **Sin exception filter global** — Stack traces e información interna pueden fugarse en respuestas 500.
15. **UUID de bypass de auditoría hardcodeado en 2 controllers** — `00000000-0000-7000-8000-000000000099` en admin-reports y shipping. Operaciones de este usuario no dejan rastro de auditoría.

### Frontend
16. **Live-search fetchea TODO el catálogo en cada keypress** — Sin cache, sin debounce. Abusable como DoS.
17. **`Number(record.price)` produce NaN silencioso** — Si el backend retorna formato no numérico, el NaN se propaga por toda la app.
18. **CartProvider retorna null durante hidratación** — Flash de pantalla blanca en cada carga de página.
19. **22 fetch requests simultáneos sin aislamiento** — `Promise.all` dispara 22 llamadas sin cuotas ni timeouts individuales.
20. **Cookie admin con `sameSite: 'lax'`** — Debería ser `'strict'` para un cookie de administración.

### Testing
21. **Tests con `before()` en vez de `beforeEach()`** — 3 archivos de tests comparten estado entre pruebas. Orden de ejecución determina resultados.
22. **Sin tests unitarios para auth/2FA** — Guards de autenticación, permisos, y verificación 2FA sin cobertura de tests.

---

## HALLAZGOS MEDIOS (28)

### Arquitectura y código
1. `JwtModule.register({})` sin secret configurado — Si alguien inyecta `JwtService` directamente, usará secret vacío
2. Permisos sin soporte wildcard — No hay `inventory:*` ni herencia de permisos
3. Denegaciones de permisos sin logging de auditoría
4. Lógica de permisos duplicada entre `PermissionsGuard` y `assertHasPermissions()`
5. SearchEventSubscriber dependiente de implementación concreta `InMemoryDomainEventPublisher`
6. Race condition en `PrismaSearchRepository.upsertVariantDocuments` — `findFirst` + `upsert` no atómico
7. Mapeo duplicado en `PrismaRoleUserAssignmentRepository` y `PrismaAdminUserRepository`
8. `process.env` directo en Redis/BullMQ modules en vez de `ConfigService`
9. `MetricsService` con Map que crece sin límite — fuga de memoria con rutas parametrizadas
10. `promptHidden()` diseño frágil — sobrescribe stdout global

### Base de datos
11. Sin índice en `AuditLog.actorUserId` — Consultas de auditoría por usuario hacen full table scan
12. Sin índice en `InventoryReturnLine.variantId/warehouseId`
13. `SearchDocument` sin unique constraint en `(documentType, variantId)` — Posibles duplicados
14. Índice de 5 columnas en `ContentBlock` demasiado ancho
15. `Customer.documentNumber` sin unique constraint ni índice
16. Varios modelos sin `@updatedAt`: Permission, RolePermission, AuthSession, AuditLog, InventoryCountLine, WebhookReceipt
17. Campos de estado usan `String` en vez de enum de Prisma (InventoryCountSession.status, etc.)

### Testing
18. Heurística frágil en test de permisos RBAC (threshold de 160 caracteres arbitrario)
19. Assertion débil en race condition de concurrency-stress (solo verifica `!== 'rejected'`)
20. Mock destructivo de `global.fetch` en tests 99envios
21. Sin tests de idempotencia de checkout
22. Sin tests de máquina de estados de órdenes
23. Linter no cubre `scripts/` — scripts administrativos sin verificación de calidad

### Frontend
24. `sortProducts` para `price-desc` coloca productos sin precio al inicio (orden invertido)
25. `getProductBySlug()` fetchea TODO el catálogo y filtra en memoria — O(n) para cada página de producto
26. Código muerto: mapper lanza 422 por quote items pero nunca se alcanza
27. `cancelPublicOrder()` ignora respuesta del POST — error reportado como éxito
28. `createGuestCheckoutPayload` nunca setea `daneCode` — guías de envío fallarán

---

## HALLAZGOS BAJOS (23) — Resumen

- SessionId/sub del bypass predecibles
- `@CurrentUser()` retorna `undefined` sin tipado adecuado
- `void bootstrap()` descarta error de inicio
- RequestContextMiddleware sin sanitización de headers (log injection potencial)
- IP del cliente no confiable detrás de proxy sin `trust proxy`
- `rawBody: true` sin configuración adicional de body-parser
- Exportación dual (clase + token) en DomainEventsModule
- Puerto PostgreSQL expuesto innecesariamente en docker-compose
- `prisma` CLI en dependencies en vez de devDependencies
- Directorios `contracts/`, `tests/e2e/`, `tests/integration/` vacíos
- `start-full-local.sh` no verifica existencia del script delegado
- `seed-taxonomy.ts` sin verificación de precondiciones de BD
- `seed-test-data.ts`: disconnectDatabase no en finally
- Coordinadora/Servientrega adapters son stubs (solo lanzan error)
- `moduleResolution: "node"` deprecated en tsconfig
- Módulos `carts/`, `crm/`, `shipments/` vacíos (planificados pero no implementados)
- Varios tipos `Record<string, unknown>` en tipado del frontend admin
- `tsconfig` ignora deprecations en vez de migrar a `node16`
- `Variant.productId` opcional — variantes pueden existir sin producto
- `Product.brandId` y `categoryId` opcionales
- `LegalVersion.slug` no es `@unique`
- `Promotion.productId` opcional sin validación cruzada con `targetType`
- JWT secrets placeholder débiles (`change-me-access`) en `.env.example`

---

## PATRONES GLOBALES IDENTIFICADOS

1. **`as never` generalizado** — 8+ repositorios usan type assertion `as never` para datos JSON de Prisma. Elude el type system.

2. **PrismaService en capa de aplicación** — 11+ use cases inyectan `PrismaService` directamente, violando la arquitectura hexagonal que el proyecto dice seguir.

3. **God Controllers** — InventoryController (968 líneas) y ShippingController (797 líneas) concentran presentación, lógica de negocio y acceso a datos.

4. **Sin verificación de sesión activa** — La cadena completa JWT → Strategy → Guard → Permisos nunca verifica el estado actual del usuario contra base de datos.

5. **Sin rate limiting en ninguna capa** — No hay protección en backend (NestJS) ni en frontend (Next.js API routes).

---

## LO QUE SÍ ESTÁ BIEN HECHO

- La documentación técnica (`0x_*.md`) es exhaustiva y clara
- El módulo de Webhooks es el mejor diseñado: puertos limpios, HMAC con `timingSafeEqual`, idempotencia con `createIfAbsent`
- La mayoría de módulos pequeños siguen correctamente la arquitectura hexagonal (stock-movements, brands, categories, promotions, audit, notifications)
- El sistema RBAC es comprensivo (111+ permisos granulares)
- Las migraciones de Prisma manejan edge cases (UPSERT-like, ranked windows)
- La separación backend/frontend es clara con el backend como fuente de verdad
- El setup Docker para desarrollo local es funcional y bien documentado
- Los eventos de dominio están correctamente definidos aunque su implementación sea mejorable

---

## TOP 10 ACCIONES INMEDIATAS RECOMENDADAS

1. **Cifrar `User.twoFactorSecret`** — Crítico de seguridad. Usar AES-256-GCM con clave derivada.
2. **Validar JWT contra BD en cada request** — Verificar que el usuario existe, está activo, y su sesión no fue revocada.
3. **Arreglar `npm test`** — Cambiar a `"test": "npm run test:critical"` o similar.
4. **Implementar rate limiting** — ThrottlerModule de NestJS en login, 2FA, checkout.
5. **Arreglar middleware del frontend** — Validar el JWT (firma, expiración), no solo verificar que el cookie existe.
6. **Arreglar formulario de contacto** — Conectarlo a un endpoint real que persista los datos.
7. **Restringir CORS** — Usar orígenes explícitos en producción.
8. **Agregar `enableShutdownHooks()`** — Para graceful shutdown de conexiones.
9. **Agregar autenticación a Redis** — `requirepass` en docker-compose.
10. **Refactorizar God Controllers** — Extraer lógica de negocio a casos de uso dedicados.
