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
