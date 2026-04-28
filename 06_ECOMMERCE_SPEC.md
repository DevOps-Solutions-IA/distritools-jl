# 06_ECOMMERCE_SPEC.md — Especificación del e-commerce público

## Objetivo
Diseñar una tienda online de estilo industrial, robusta y muy similar en lógica funcional a un e-commerce de catálogo profundo, pero con identidad visual propia y sin login para clientes.

## Principios de UX
- compra rápida
- navegación clara
- buscador visible
- catálogo jerárquico
- tarjetas de producto limpias
- filtros potentes
- CTA visibles
- flujo guest-first
- mobile-first
- accesibilidad

## Estructura del sitio
### Header
- logo
- menú
- buscador
- categorías
- carrito
- WhatsApp
- CTA destacado

### Home
- hero comercial
- categorías destacadas
- marcas
- productos destacados
- promociones
- beneficios
- confianza
- contacto rápido

Reglas:
- las marcas visibles deben salir de la taxonomía activa
- no inventar productos en la home
- si una marca no tiene logo autorizado, usar fallback tipográfico
- no afirmar distribución oficial sin autorización del negocio

### Categoría
- título SEO
- descripción breve
- subcategorías
- filtros
- ordenamiento
- lista de productos
- contenido de apoyo

Reglas:
- una categoría no debe mezclar marcas fuera de su scope taxonómico
- la navegación debe reforzar familias técnicas reales

### Subcategoría
- navegación contextual
- breadcrumbs
- filtros específicos
- productos relevantes

### Ficha de producto
Debe incluir:
- nombre
- SKU
- galería
- precio
- precio anterior si aplica
- disponibilidad
- descripción corta
- descripción técnica
- especificaciones
- beneficios
- uso recomendado
- productos relacionados
- preguntas frecuentes
- botón comprar
- botón WhatsApp
- comparación

### Carrito
- resumen
- cantidades
- impuestos
- envío
- total
- CTA checkout

### Checkout
- datos del cliente
- dirección
- método de pago
- revisión final
- confirmación

### Confirmación
- número de pedido
- estado
- próximos pasos
- soporte
- WhatsApp

## Búsqueda
- autocompletado
- corrección parcial
- resultados por nombre, SKU, marca y categoría
- resultados rápidos
- filtros por `brandSlug` y `categorySlug`

## Filtros
- categoría
- marca
- precio
- disponibilidad
- características
- promociones

Reglas:
- disponibilidad solo si el backend la expone de forma pública y segura
- características solo cuando existan atributos reales
- no inventar filtros comerciales sin contrato backend

## Comparador
- comparar 2 a 4 productos
- atributos técnicos
- precio
- garantía
- recomendación

## Reglas de compra
- no login obligatorio
- formularios cortos
- validaciones claras
- estados visibles
- mensajes de error útiles

## SEO
- URLs limpias
- meta titles y descriptions
- breadcrumbs
- schema estructurado si aplica
- contenido indexable

## Contenido comercial
- promociones
- novedades
- best sellers
- bundles
- recomendaciones por uso

## Taxonomía real de marcas
- Ingersoll Rand: compresores, neumática, bombas, izaje, accesorios de aire, repuestos y servicio
- BeA: fijación industrial, grapadoras, clavadoras, grapas, clavos y herramientas para pallets, muebles y empaques
- Pretul: herramienta manual, herramienta eléctrica básica, compresores, bombas, carretillas, jardín y accesorios
- Truper: herramienta manual, eléctrica, automotriz, soldadura, plomería, abrasivos, compresores, jardín, escaleras y herrajes
- TOTAL: herramientas eléctricas, accesorios, generadores, soldadoras, construcción ligera, neumática, bombas, medición, seguridad y jardín
- SENCO: clavadoras, grapadoras, sistemas de tornillos, compresores y consumibles de fijación
- Lincoln Electric: soldadura, corte, consumibles, automatización, extracción de humos y seguridad para soldadura

## Criterios de aceptación
- compra clara y rápida
- navegación fluida
- catálogo escalable
- sin fricción de registro
- fuerte capacidad de conversión
