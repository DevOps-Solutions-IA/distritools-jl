# FRONTEND_INTEGRATION_RULES.md

## Objetivo
Definir las reglas de integración frontend-backend para DistriTools JL.

## API
- Usar endpoints reales.
- No duplicar reglas de negocio críticas.
- Validar en frontend para UX, pero backend es la verdad.
- Manejar errores del backend de forma clara.
- Manejar loading, retry y empty states.
- Usar tipos compartidos o generados desde OpenAPI si existe.
- Centralizar API client.

## Pagos
- Frontend puede iniciar flujo de pago si backend lo permite.
- Frontend nunca marca una orden como pagada.
- Pantalla de retorno de pago es informativa.
- Estado real viene del backend/webhook.

## Inventario
- Frontend muestra disponibilidad.
- Frontend no decide stock.
- Backend valida disponibilidad en checkout.
- Si stock cambia, mostrar error recuperable.

## Admin
- Dashboard usa auth admin.
- Tokens/sesión manejados de forma segura.
- RBAC también debe reflejarse visualmente, pero backend siempre manda.
- No mostrar acciones no permitidas.
- Si backend devuelve `403`, mostrar mensaje operativo claro.

## Búsqueda
- Consumir resultados del backend o read model aprobado.
- No reimplementar ranking crítico en cliente salvo para presentación secundaria.
- El cero resultado debe registrarse como evento analítico.

## Promociones
- Mostrar precio promocional y precio base según respuesta del backend o snapshot validado.
- No recalcular descuentos críticos en cliente como fuente de verdad.
- El frontend puede previsualizar totales, pero la confirmación final la hace backend.

## Contenido
- Consumir contenido público publicado desde backend.
- No mezclar contenido no publicado con vistas públicas.

## Analytics
- Medir eventos frontend sin convertirlos en verdad transaccional.
- Toda cifra operativa crítica sigue viniendo del backend/read models.

## Criterio de aceptación
La integración frontend se considera correcta si:
- usa contratos reales
- no contradice backend
- maneja estados y errores con claridad
- no genera expectativas falsas al usuario
