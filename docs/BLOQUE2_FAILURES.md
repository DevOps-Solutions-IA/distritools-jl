# Bloque 2 — Fallos conocidos/preexistentes

Estos 6 tests fallan en `npm run test:critical` y NO están relacionados con los cambios del Bloque 1 (seguridad crítica). Son fallos preexistentes de lógica de negocio y concurrencia que deben abordarse en el Bloque 2.

## Lista de fallos

### 1. duplicate webhook replay does not duplicate effects
- **Archivo**: `tests/critical/concurrency-stress.e2e.test.ts`
- **Test**: Scenario B
- **Tipo**: Race condition / idempotencia de webhooks

### 2. read pressure remains stable on available read endpoints
- **Archivo**: `tests/critical/concurrency-stress.e2e.test.ts`
- **Test**: Scenario E
- **Tipo**: Timing / performance bajo carga

### 3. mixed workload keeps order and payment state consistent
- **Archivo**: `tests/critical/concurrency-stress.e2e.test.ts`
- **Test**: Scenario G
- **Tipo**: Consistencia de estado bajo carga mixta

### 4. guest checkout fails with 409 on insufficient stock and never goes negative
- **Archivo**: `tests/critical/inventory-orders-payments.e2e.test.ts`
- **Test**: #9
- **Tipo**: Validación de stock insuficiente / invariante de no-negatividad

### 5. aplica promociones de forma determinística y mantiene snapshot correcto en pedidos
- **Archivo**: `tests/critical/platform-closure.e2e.test.ts`
- **Test**: #5
- **Tipo**: Determinismo en promociones / snapshot de pedidos

### 6. indexa variantes y expone reportes operativos en analytics
- **Archivo**: `tests/critical/platform-closure.e2e.test.ts`
- **Test**: #6
- **Tipo**: Indexación de búsqueda / reportes operativos

## Estado actual de la suite

- Total tests críticos: 78
- Pasan: 72
- Fallan: 6 (todos preexistentes, listados arriba)
- Tasa de éxito: 92.3%

## Asignación

Estos fallos se trasladan al **Bloque 2 — Integridad de negocio y concurrencia** para su análisis y corrección.
