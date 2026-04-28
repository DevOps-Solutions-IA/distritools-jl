# 08_QA_AND_GATES.md — QA, validación y Go/No-Go

## Objetivo
Impedir que se entreguen cambios débiles, incompletos o inseguros. Ninguna implementación debe pasar sin control de calidad.

## Estrategia de QA
- pruebas unitarias
- pruebas de integración
- pruebas e2e
- pruebas de API
- pruebas de seguridad
- pruebas de rendimiento
- pruebas de accesibilidad
- pruebas visuales
- pruebas de regresión

## Niveles de validación
### Nivel 1 — Código
- compila
- no rompe lint
- no rompe tipado
- no deja errores obvios

### Nivel 2 — Negocio
- respeta reglas de stock
- respeta reglas de pedidos
- respeta reglas de pago
- respeta roles

### Nivel 3 — UX
- navegación clara
- mensajes correctos
- formularios útiles
- responsive real

### Nivel 4 — Operación
- stock actualiza
- pedidos fluyen
- pagos confirman
- dashboard refleja realidad

### Nivel 5 — Producción
- observabilidad
- rollback
- logs
- seguridad
- performance

## Gate de backend
No se aprueba si:
- hay endpoints sin validación
- hay lógica de negocio en controladores
- no existen tests críticos
- el webhook no es idempotente
- el stock puede quedar negativo
- no existe auditoría

## Gate de frontend
No se aprueba si:
- rompe responsive
- falla accesibilidad básica
- no hay estados de carga
- no hay manejo de error
- no hay consistencia visual
- no funciona en móvil

## Gate de dashboard
No se aprueba si:
- permisos fallan
- métricas no cuadran
- tablas no filtran
- acciones críticas no auditan
- el usuario ve datos fuera de su rol

## Gate de pagos
No se aprueba si:
- la confirmación depende solo del frontend
- el webhook no se valida
- se duplican transacciones
- el pedido y el pago quedan desincronizados

## Gate de inventario
No se aprueba si:
- el stock no se descuenta correctamente
- no existe reserva
- no existe movimiento
- no existe historial
- no hay alertas de stock bajo

## Checklist de lanzamiento
- [ ] pruebas unitarias críticas
- [ ] pruebas e2e de compra completa
- [ ] webhook validado
- [ ] auditoría activa
- [ ] dashboard con roles
- [ ] accesibilidad básica aprobada
- [ ] performance aceptable
- [ ] backups activos
- [ ] rollback probado
- [ ] documentación actualizada

## Definición de fail
Cualquier fallo en:
- seguridad
- pagos
- stock
- roles
- datos críticos
implica bloqueo total.

## Definición de pass
Solo pasa si:
- funciona
- está documentado
- está probado
- está trazado
- está alineado al negocio
