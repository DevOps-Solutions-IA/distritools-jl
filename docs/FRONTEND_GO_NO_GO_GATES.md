# FRONTEND_GO_NO_GO_GATES.md

## Objetivo
Definir las reglas de decisión `GO / NO-GO` del frontend de DistriTools JL.

## GO permitido si:
- build `PASS`
- lint `PASS`
- typecheck `PASS`
- rutas principales funcionan
- no hay login de cliente
- checkout es invitado
- pagos no se confirman en frontend
- responsive validado
- loading/error/empty states implementados
- accesibilidad mínima validada
- API client centralizado
- branding respetado
- diseño consistente
- no hay componentes genéricos sin sistema

## NO-GO si:
- frontend confirma pago
- frontend decide stock
- UI rompe branding
- checkout exige login cliente
- dashboard muestra acciones sin RBAC
- errores del backend no se muestran
- build falla
- typecheck falla
- lint crítico falla
- responsive roto
- no hay estados de carga/error
- performance inaceptable
- se usan mocks ocultos como si fueran integración real

## Gates por fase
### Gate técnico base
- app arranca
- rutas resuelven
- design tokens cargan
- cliente API funciona

### Gate storefront
- SEO base implementado
- búsqueda y catálogo integrados
- PDP usable
- mobile-first real

### Gate checkout
- guest-only
- validación fuerte
- orden creada por backend
- retorno de pago solo informativo

### Gate dashboard
- auth admin funcional
- RBAC visual y backend consistentes
- tablas operativas correctas
- acciones críticas confirmadas

### Gate hardening
- tests críticos verdes
- error boundaries presentes
- performance aceptable
- accesibilidad mínima validada

## Regla de decisión
No declarar `GO` de una fase si existe incertidumbre material sobre:
- contratos
- permisos
- estados críticos
- errores
- comportamiento responsive
- consistencia visual
