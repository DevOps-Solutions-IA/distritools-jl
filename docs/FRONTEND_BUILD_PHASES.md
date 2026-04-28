# FRONTEND_BUILD_PHASES.md

## Objetivo
Definir el orden obligatorio de construcción del frontend para evitar improvisación, deuda técnica o saltos de fase sin validación.

## Fase 1 — Base frontend
- Crear app Next.js si no existe.
- Configurar TypeScript.
- Configurar Tailwind.
- Configurar design tokens.
- Configurar layout base.
- Configurar API client.
- Configurar rutas base.
- Configurar lint/build/test.
- Crear shell storefront.
- Crear shell admin.

### GO si:
- build pasa
- lint pasa
- app arranca
- tokens existen
- layout base existe
- API client base existe

## Fase 2 — Storefront catálogo
- Home.
- Categorías.
- Listado productos.
- Búsqueda.
- Filtros.
- PDP.
- Cards.
- CTA WhatsApp.

### GO si:
- consume endpoints reales o contratos validados
- responsive pasa
- loading/error/empty states existen
- SEO base existe

## Fase 3 — Carrito y checkout invitado
- Cart.
- Checkout.
- Validaciones.
- Crear orden.
- Iniciar pago.
- Confirmación.
- Retorno informativo.

### GO si:
- no hay login cliente
- backend crea orden
- frontend no confirma pagos
- errores se manejan bien

## Fase 4 — Dashboard admin
- Login.
- Layout admin.
- KPIs.
- Productos.
- Categorías.
- Marcas.
- Variantes.
- Inventario.
- Órdenes.
- Pagos.
- Envíos.
- Promociones.
- Contenido.
- Analytics.
- Auditoría.

### GO si:
- RBAC visual y backend respetado
- tablas enterprise
- formularios robustos
- acciones críticas confirmadas

## Fase 5 — CRO + Analytics
- Eventos.
- KPIs frontend.
- Tracking.
- UTM.
- Funnels.
- Reportes básicos.

### GO si:
- eventos críticos se disparan correctamente
- no afecta performance
- privacidad respetada

## Fase 6 — Hardening
- Lighthouse.
- Accessibility.
- E2E.
- Visual QA.
- Error boundaries.
- Performance.
- Security review.

### GO si:
- build `PASS`
- lint `PASS`
- tests `PASS`
- E2E críticos `PASS`
- performance aceptable
- no hay errores críticos

## Regla transversal
- No saltar fases.
- No construir una fase visual si la fase técnica anterior está `NO-GO`.
- No mezclar “avance visual” con ausencia de contratos o integración.

## Criterio de aceptación
La construcción frontend está bien secuenciada si cada fase entrega:
- código real
- integración real o contrato validado
- evidencia de validación
