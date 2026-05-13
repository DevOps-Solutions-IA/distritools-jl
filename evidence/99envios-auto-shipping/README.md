# Evidencia 99 Envios y auto-shipping

Esta carpeta conserva evidencia visual y documental generada durante las fases de integración 99 Envios, validación documentada y automatización post-checkout.

## Qué fue mock

- Las capturas `auto-shipping-*` validan el flujo contractual local/test con `SHIPPING_PROVIDER=mock_99envios`.
- Las guías con prefijo `MOCK99-` son simuladas local/test.
- Ninguna guía `MOCK99-` existe en el panel real de 99 Envios.

## Qué fue real

- El checkout, la orden, el `orderNumber`, el `trackingCode` interno, el email local/test, el guardado de shipments y el rastreo público fueron ejecutados contra la app local real.
- La integración 99 Envios está alineada a endpoints documentados y bloquea producción si faltan credenciales.

## Qué falta para GO pleno

- Credenciales reales o sandbox oficial de 99 Envios.
- Prueba real de login, cotización, preenvío y PDF contra 99 Envios.
- Email productivo.
- Dominio estable.
- Pasarela de pago real si aplica.

## Mapa de evidencia

- `99envios-documented-*`: validación de endpoints documentados, readiness y brechas.
- `99envios-admin-*`: módulo admin de envíos API-ready.
- `auto-shipping-*`: automatización post-checkout con mock contractual.
- `99envios-pending-documentation.md`: funciones no documentadas por la OpenAPI actual.
