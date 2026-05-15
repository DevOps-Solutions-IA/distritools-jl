# CLAUDE.md

Este archivo proporciona guía a Claude Code (claude.ai/code) al trabajar con el código en este repositorio.

## Visión general del proyecto

DistriTools JL es una plataforma de e-commerce industrial de nivel empresarial — catálogo profundo, checkout sin registro (sin login de cliente), panel administrativo centralizado, inventario perpetuo, integración de pagos.

- **Backend**: NestJS (v11) + TypeScript + PostgreSQL (Prisma ORM) + Redis + BullMQ
- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind CSS
- **Infra**: Docker Compose (PostgreSQL 16, Redis 7 Alpine)

## Comandos esenciales

```bash
# Infraestructura
docker-compose up -d                         # iniciar postgres + redis

# Backend (raíz)
npm run start:dev                            # servidor dev con hot-reload (puerto 3000)
npm run build                                # compilar TypeScript
npm run typecheck                            # tsc --noEmit
npm run lint                                 # script de lint personalizado
npm run prisma:generate                      # regenerar cliente Prisma
npm run prisma:migrate:deploy                # aplicar migraciones
npm run seed:taxonomy                        # sembrar marcas/categorías
npm run admin:bootstrap                      # crear usuario admin inicial
npm run test:critical                        # ejecutar tests e2e críticos (Node test runner)

# Frontend (cd frontend)
npm run dev                                  # servidor dev Next.js (puerto 3001)
npm run build                                # build de producción
npm run typecheck                            # tsc --noEmit
npm run test                                 # vitest run
```

## Arquitectura

**Monolito modular** usando Arquitectura Hexagonal (Puertos y Adaptadores) dentro de cada módulo en `src/modules/<nombre>/`:

```
domain/         → entidades, interfaces de repositorio, servicios de dominio
application/    → casos de uso, puertos
infrastructure/ → repositorios Prisma, controladores HTTP, DTOs, proveedores externos
```

`src/app/app.module.ts` es el módulo raíz — todos los módulos de funcionalidad se importan aquí. `src/main.ts` delega en `src/app/bootstrap.ts` que crea la app NestJS con prefijo global `api/v1`, Swagger en `/api/docs`, ValidationPipe (whitelist + transform), y CORS habilitado.

`src/common/` contiene preocupaciones transversales: guards (`JwtAuthGuard`, `PermissionsGuard`), decoradores (`@Public()`, `@Permissions(...)`, `@CurrentUser()`), filtros, interceptores, DTOs, utilidades de paginación.
`src/infra/` contiene adaptadores de infraestructura: Prisma, Redis, cola BullMQ, publicador de eventos de dominio, monitoreo/telemetría.

Todos los endpoints están protegidos por `JwtAuthGuard` (aplicado globalmente vía APP_GUARD en el módulo auth). Usar `@Public()` para rutas sin autenticación. Usar `@Permissions('recurso.accion')` para control de acceso por roles.

**Bypass de admin en desarrollo**: Configurar `ADMIN_AUTH_DISABLED=true` en `.env` para omitir autenticación JWT — se inyecta un usuario super-admin sintético. Nunca usar en producción.

## Reglas de negocio clave

- **Sin login de cliente** — el storefront solo permite checkout como invitado. La identidad del cliente vive en el pedido.
- **Idempotencia** — los webhooks (pagos, envíos) y la iniciación de pagos deben tolerar reintentos sin duplicar pedidos o cobros.
- **Atomicidad transaccional** — crear pedido + reservar stock + intención de pago debe ejecutarse atómicamente (todo o nada).
- **Invariante de stock** — `available_qty = on_hand_qty - reserved_qty`. El stock no puede ser negativo. Los ajustes manuales requieren un motivo.
- **Máquina de estados del pedido** — draft → pending_payment → paid → packed → shipped → delivered. No se permiten saltos inválidos.
- **Snapshot en items de pedido** — los items del pedido copian nombre del producto, SKU y precio al momento de la compra para exactitud histórica.

## Convenciones

- El alias de ruta `src/*` mapea a `src/*` (configurado en tsconfig.json)
- Se usa `NODE_PATH=.` en tiempo de ejecución para que los imports `src/...` resuelvan sin bundler
- Los tests usan el test runner nativo de Node (`tsx --test --test-concurrency=1`). Los tests e2e críticos están en `tests/critical/`. Los helpers de prueba están en `tests/helpers/` (fábrica de app, carga de test-env, utilidades de BD).
- `.env.test` proporciona variables de entorno para tests (BD separada en puerto 55440)
- Los archivos numerados `0x_*.md` en la raíz del repositorio son los documentos de especificación técnica. Consultarlos antes de hacer cambios arquitectónicos.
