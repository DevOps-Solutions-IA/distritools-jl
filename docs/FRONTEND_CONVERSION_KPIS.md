# FRONTEND_CONVERSION_KPIS.md

## Objetivo
Definir los indicadores y reglas de optimización comercial que deben guiar el frontend de DistriTools JL.

## KPIs comerciales
- tasa de conversión
- add-to-cart rate
- begin-checkout rate
- checkout completion rate
- búsqueda con resultado
- búsqueda sin resultado
- clics a WhatsApp
- leads generados
- productos más vistos
- productos más agregados al carrito
- categorías más visitadas
- abandono de carrito
- errores en checkout
- performance por página

## KPIs operativos complementarios
- tiempo hasta primer resultado de búsqueda
- porcentaje de cero resultados por término
- CTR de cards de producto
- CTR de CTA principal en PDP
- CTR de productos relacionados
- ratio de errores recuperables por formulario
- ratio de rechazos por stock cambiante

## Reglas CRO
- CTA principal visible.
- Reducir fricción en checkout.
- Mostrar disponibilidad.
- Mostrar confianza:
  - medios de pago
  - contacto
  - soporte
  - despacho/domicilios
  - garantía si aplica
- Evitar distracciones en checkout.
- Mostrar productos relacionados.
- Usar búsqueda prominente.
- Usar filtros útiles.
- Capturar eventos relevantes sin invadir UX.

## Reglas de instrumentación
- Todo evento debe tener naming consistente.
- Toda medición comercial debe mapearse a un objetivo de negocio.
- No disparar eventos duplicados por rerender.
- No instrumentar tracking de forma que degrade performance o rompa privacidad.
- Registrar el origen de adquisición cuando exista UTM.

## Eventos críticos mínimos
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

## Reglas de priorización CRO
1. Facilitar descubrimiento.
2. Reducir fricción de selección.
3. Dar confianza para comprar.
4. Reducir fricción de checkout.
5. Capturar señal útil para optimizar.

## Criterio de aceptación
El frontend cumple orientación a conversión si:
- expone CTA principal con claridad
- instrumenta eventos críticos
- reduce fricción de descubrimiento y checkout
- no sacrifica claridad ni confianza por estética
