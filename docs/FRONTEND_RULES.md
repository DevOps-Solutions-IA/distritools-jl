# FRONTEND_RULES.md

## Propósito
Este documento define las reglas permanentes de comportamiento para cualquier construcción frontend futura de DistriTools JL. Es vinculante para Codex, para otros agentes IA y para cualquier implementación manual posterior.

## Contexto operativo
- El backend está en estado `GO`.
- El frontend entra en fase `FRONTEND + INTEGRACIÓN COMERCIAL REAL`.
- No se debe reconstruir backend core ni repetir gates backend salvo para validar contratos o corregir incompatibilidades de integración debidamente documentadas.
- Toda construcción debe alinearse con:
  - `06_ECOMMERCE_SPEC.md`
  - `05_DASHBOARD_SPEC.md`
  - `07_UX_UI_SYSTEM.md`
  - `docs/BRANDING.md`
  - `docs/FRONTEND_INTEGRATION_RULES.md`

## Reglas permanentes obligatorias
1. No entregar UI básica.
2. No entregar pantallas genéricas.
3. No entregar componentes sin sistema visual.
4. No inventar flujos fuera del backend aprobado.
5. No crear login para clientes.
6. No confirmar pagos desde frontend.
7. No duplicar lógica crítica del backend.
8. No usar datos mock cuando ya exista endpoint real.
9. No construir dashboard antes de tener contratos claros.
10. No construir pantallas sin estados:
   - `loading`
   - `empty`
   - `error`
   - `success`
   - `disabled`
   - `skeleton`
   - `optimistic/pending` si aplica
11. No construir formularios sin validación.
12. No construir tablas admin sin filtros, búsqueda, paginación y estados de error.
13. No construir checkout sin validaciones fuertes.
14. No construir eCommerce sin SEO.
15. No construir componentes sin responsive real.
16. No construir UI sin accesibilidad mínima.
17. No usar colores arbitrarios.
18. No romper branding.
19. No modificar backend salvo que sea estrictamente necesario para integración y esté documentado.
20. No avanzar a una fase visual si la fase técnica anterior está `NO-GO`.

## Reglas de calidad de implementación
- Todo componente debe existir dentro de un sistema de tokens, variantes y estados.
- Todo layout debe justificarse por objetivo comercial u operativo.
- Todo componente comercial debe responder a una intención:
  - conversión
  - descubrimiento
  - confianza
  - comparación
  - soporte
- Todo componente administrativo debe responder a una intención:
  - operación
  - edición
  - control
  - trazabilidad
  - auditoría
- Ningún componente puede introducir lógica de negocio crítica que contradiga al backend.
- Todo fetch debe tener:
  - timeout razonable
  - manejo de error
  - estado de carga
  - fallback visual
- Toda mutación debe exponer feedback claro:
  - progreso
  - éxito
  - error recuperable
  - error no recuperable

## Reglas de comportamiento para Codex
- Antes de construir UI, revisar contratos reales disponibles.
- Antes de consumir endpoints, validar naming, payloads, errores y permisos.
- Antes de construir dashboard, verificar RBAC visual por módulo.
- Antes de construir checkout, verificar flujo guest-only, errores de stock y retorno de pagos.
- Antes de construir tablas enterprise, definir:
  - columnas
  - filtros
  - orden
  - acciones masivas si existen
  - empty states
  - errores
- Antes de construir componentes visuales, validar tokens y variantes en `docs/FRONTEND_VISUAL_SYSTEM.md`.

## Entregables obligatorios por respuesta de Codex
Toda respuesta de Codex debe producir:
- archivos reales
- código real cuando sea fase de construcción
- validación real
- evidencia real
- reporte claro de `PASS/FAIL`

## Criterio de rechazo inmediato
La implementación se considera inválida si ocurre cualquiera de estos casos:
- confirma pagos desde frontend
- exige login de cliente
- inventa estados de pedido o pago
- decide stock en cliente
- omite estados de error
- usa estética genérica SaaS sin carácter industrial
- viola branding aprobado
- usa mocks ocultos como si fueran integración real
- introduce componentes aislados fuera del sistema visual

## Criterio de aceptación
Una implementación frontend solo puede considerarse aceptable si:
- respeta estas reglas
- respeta branding
- consume backend real o contrato validado
- es responsive
- es accesible en lo mínimo exigible
- tiene intención comercial u operativa clara
- pasa su gate técnico actual
