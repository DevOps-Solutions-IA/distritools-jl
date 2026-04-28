# FRONTEND_UX_UI_STANDARD.md

## Objetivo
Definir el estándar UX/UI obligatorio del frontend comercial y administrativo de DistriTools JL.

## Principios generales
- claridad primero
- conversión sin fricción
- jerarquía visual fuerte
- lectura técnica rápida
- confianza comercial visible
- consistencia entre storefront y dashboard
- accesibilidad mínima real
- responsive real

## Storefront
- Home orientada a conversión.
- Categorías claras.
- Búsqueda visible.
- Productos destacados.
- Filtros técnicos.
- Cards de producto con jerarquía clara.
- PDP robusta:
  - imágenes
  - precio
  - disponibilidad
  - marca
  - SKU
  - ficha técnica
  - atributos
  - CTA principal
  - WhatsApp CTA
  - productos relacionados
- Carrito simple.
- Checkout invitado.
- Confirmación clara.
- Tracking o consulta de orden si el backend lo soporta.
- Sin login de cliente.

## Reglas UX storefront
- El buscador debe existir en el header y ser visible en desktop y móvil.
- El CTA principal de compra debe ser inequívoco.
- El CTA de WhatsApp debe ser complemento comercial, no reemplazo del flujo principal.
- Las fichas de producto deben priorizar:
  - disponibilidad
  - precio
  - SKU
  - atributos críticos
  - CTA
- Los filtros deben ser útiles para industria:
  - marca
  - disponibilidad
  - rango de precio
  - atributos técnicos
  - promociones
- El checkout debe reducir fricción:
  - pocos pasos
  - validaciones claras
  - mensajes útiles
  - resumen visible

## Dashboard
- Login admin.
- Layout protegido.
- Sidebar enterprise.
- KPIs.
- Tablas densas.
- Filtros avanzados.
- Estados operativos.
- Acciones críticas confirmadas.
- Auditoría visible cuando aplique.
- Roles/permisos respetados.
- Formularios robustos.
- Edición de productos.
- Inventario.
- Órdenes.
- Pagos.
- Envíos.
- Promociones.
- Contenido.
- Analytics.
- Notificaciones.

## Reglas UX dashboard
- La navegación debe optimizar velocidad operativa, no “belleza” vacía.
- Las acciones críticas deben requerir confirmación o doble intención cuando el riesgo sea alto.
- Las tablas deben soportar:
  - búsqueda
  - filtros
  - paginación
  - orden
  - estados
  - acciones rápidas
- Los detalles complejos deben resolverse con:
  - drawer
  - panel lateral
  - vista detalle clara
- El dashboard debe priorizar desktop y tablet, con soporte móvil razonable para consulta.

## Responsive
- Mobile-first para storefront.
- Dashboard optimizado para desktop/tablet, con soporte móvil razonable.
- Breakpoints consistentes.
- No overflow horizontal accidental.
- Navegación móvil clara.

## Accesibilidad
- Contraste suficiente.
- Focus visible.
- Labels en formularios.
- `aria` cuando aplique.
- Navegación por teclado.
- No depender solo del color.
- Estados de error claros.

## Estados obligatorios por pantalla
Toda pantalla debe contemplar, cuando aplique:
- loading
- skeleton
- empty
- error
- success
- disabled
- optimistic/pending

## Criterio de aceptación
Una pantalla cumple el estándar si:
- resuelve su objetivo principal con claridad
- tiene estados completos
- es consistente con branding y sistema visual
- es usable en su breakpoint prioritario
- no depende de comportamiento implícito no visible para el usuario
