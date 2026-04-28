# FRONTEND_VISUAL_SYSTEM.md

## Objetivo
Definir el sistema visual obligatorio para que storefront y dashboard se construyan con coherencia, carácter de marca y escalabilidad.

## Regla principal
Nada debe construirse como componente aislado sin integrarse al sistema visual.

## Fundaciones

### Tokens de color
- base oscura:
  - `graphite-black`
  - `deep-charcoal`
- base neutra:
  - `steel-gray`
  - `light-steel`
  - `off-white`
- acciones y énfasis:
  - `industrial-yellow`
  - `industrial-orange` como alias compatible
  - `amber-highlight`
- semánticos:
  - `success-green`
  - `error-red`
  - `info-blue`

### Branding real integrado
- Logo horizontal principal:
  - `/brand/distritools-logo-horizontal-clean.svg`
- Logo horizontal para fondos oscuros:
  - `/brand/distritools-logo-horizontal-dark.svg`
- Isotipo:
  - `/brand/distritools-logo-mark.svg`
- Isotipo simple:
  - `/brand/distritools-logo-mark-simple.svg`
- Brand board:
  - `/brand/distritools-logo-brand-board.svg`
- Tagline oficial:
  - `HERRAMIENTAS QUE CONSTRUYEN RESULTADOS`

### Regla de marca
- El placeholder SVG inicial ya no puede usarse como identidad principal.
- Todo header, shell o superficie de marca debe consumir `DistriToolsLogo` o assets públicos equivalentes.

### Tokens de espaciado
- escala consistente, por ejemplo:
  - `4`
  - `8`
  - `12`
  - `16`
  - `24`
  - `32`
  - `48`
  - `64`

### Tokens de radios
- `sm`: controles compactos
- `md`: inputs/cards comunes
- `lg`: superficies principales
- `xl`: hero/paneles destacados solo si está justificado

### Tokens de sombras
- `soft`: cards livianas
- `medium`: overlays y superficies prioritarias
- `elevated`: modales, drawers o hero destacados

### Tokens tipográficos
- display
- heading
- body
- caption
- mono o numérica para SKU/KPI si aporta claridad

## Grid
- storefront:
  - contenedor central
  - layout flexible mobile-first
  - grillas de catálogo escalables
- dashboard:
  - grilla densa para desktop
  - sidebar persistente
  - contenido principal con zonas de tabla, filtros y detalle

## Layouts
- shell storefront
- shell checkout
- shell admin
- shell auth admin

## Componentes base
- botones
- inputs
- selects
- checkboxes
- tabs
- modals
- drawers
- toasts
- badges
- cards
- breadcrumbs
- pagination

## Componentes de producto y comercio
- product cards
- search bars
- filters
- pricing blocks
- stock badges
- comparador
- CTA de compra
- CTA de WhatsApp
- related product modules

## Componentes administrativos
- KPI cards
- data tables
- admin forms
- confirmation dialogs
- timeline/estado
- alert banners
- side detail drawers

## Estados
- empty states
- error states
- skeleton states
- loading states
- success states
- disabled states

## Checkout
- checkout steps
- resumen persistente
- validación inline
- mensajes de error recuperables

## Reglas de consistencia
- componentes comerciales y admin deben compartir fundaciones visuales
- cada componente debe tener:
  - propósito
  - variantes
  - estados
  - responsive behavior
  - accesibilidad básica

## Anti-patrones
- componentes “bonitos” sin utilidad clara
- estilos inline arbitrarios
- variaciones de color sin token
- radios y sombras inconsistentes
- cards diferentes sin motivo funcional

## Criterio de aceptación
El sistema visual está bien usado si:
- la UI se percibe como un solo producto
- cada componente pertenece a una familia clara
- la marca se siente robusta, industrial y premium
