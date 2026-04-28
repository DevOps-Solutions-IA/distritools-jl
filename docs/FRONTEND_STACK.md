# FRONTEND_STACK.md

## Objetivo
Definir el stack frontend recomendado y aprobado para DistriTools JL con foco en rendimiento, escalabilidad, mantenibilidad, accesibilidad y conversión.

## Core
- Next.js con App Router
- React
- TypeScript estricto
- Tailwind CSS
- CSS variables para design tokens
- Server Components donde aporten rendimiento
- Client Components solo donde haya interacción real

## Reglas del core
- Usar Server Components por defecto en storefront para:
  - páginas de contenido
  - listados SEO
  - categorías
  - páginas de producto con datos serializables
- Usar Client Components solo para:
  - filtros interactivos
  - búsqueda con autocompletado
  - formularios
  - dashboard interactivo
  - tablas con estados complejos
  - flujos de checkout
- Mantener separación explícita entre:
  - `storefront`
  - `admin`
  - `shared/ui`
  - `shared/lib`

## UI System
- Radix UI para primitives accesibles
- shadcn/ui como base editable, no como plantilla final
- Framer Motion para microinteracciones premium controladas
- Lucide React para iconografía técnica y consistente
- TanStack Table para tablas enterprise del dashboard
- TanStack Query para cache, sincronización y estados de servidor cuando aplique
- React Hook Form para formularios
- Zod para validación de formularios y contratos frontend

## Reglas del sistema UI
- `shadcn/ui` no puede usarse como apariencia final por defecto.
- Todo componente base debe ser tematizado con tokens de DistriTools JL.
- Las variantes comerciales y administrativas deben vivir sobre un mismo sistema, no como bibliotecas separadas sin relación.

## Visual premium
- SVG propio para recursos gráficos
- Lottie solo si está justificado y optimizado
- Canvas/WebGL solo para elementos visuales premium muy específicos, no para decoración innecesaria
- Spline o Three.js solo si aporta valor comercial real, rendimiento aceptable y fallback móvil
- Imágenes WebP/AVIF
- `next/image` para optimización
- blur placeholders y skeletons

## Analytics y CRO
- Google Analytics 4 o alternativa aprobada
- Pixel/Meta Ads si negocio lo aprueba
- eventos internos de conversión
- tracking de:
  - `product_view`
  - `category_view`
  - `search`
  - `add_to_cart`
  - `begin_checkout`
  - `checkout_error`
  - `payment_started`
  - `payment_return_view`
  - `whatsapp_click`
  - `lead_created`
  - `order_created`
- UTM capture
- scroll depth
- CTA click tracking
- search zero-results tracking

## Calidad
- ESLint
- Prettier
- TypeScript `noEmit`
- Playwright para E2E
- Testing Library para componentes críticos
- Lighthouse CI si el entorno lo permite
- axe/accessibility checks si el entorno lo permite

## Integración
- API client tipado
- contratos desde OpenAPI si existe
- manejo centralizado de errores
- manejo centralizado de auth admin
- interceptores de request
- `correlationId` / `requestId` cuando aplique
- separación storefront/admin

## Estructura recomendada
```text
frontend/
  src/
    app/
      (storefront)/
      admin/
      api/
    components/
      ui/
      commerce/
      dashboard/
      shared/
    features/
      catalog/
      search/
      cart/
      checkout/
      admin-auth/
      admin-products/
      admin-orders/
      admin-inventory/
      admin-promotions/
      admin-content/
      admin-analytics/
    lib/
      api/
      env/
      analytics/
      auth/
      utils/
      formatting/
    styles/
      tokens.css
      globals.css
    types/
```

## Decisiones obligatorias
- No mezclar código comercial y código administrativo en páginas compartidas si su comportamiento difiere.
- No consumir backend desde componentes UI directamente; hacerlo a través de un cliente o capa `lib/api`.
- No introducir librerías visuales adicionales sin justificación de performance y mantenibilidad.

## Criterio de aceptación
El stack se considera correctamente adoptado si:
- soporta SEO, conversión y operación admin
- permite integración real con backend
- evita duplicación de lógica
- mantiene tipado fuerte
- soporta tests, observabilidad y crecimiento
