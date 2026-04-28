# 05_DASHBOARD_SPEC.md — Especificación del dashboard administrativo

## Objetivo
Construir un panel administrativo centralizado para operar la tienda, controlar stock, atender pedidos, medir ventas y ejecutar decisiones.

## Principios de diseño
- rapidez
- claridad
- densidad de información controlada
- jerarquía visual fuerte
- cero ruido innecesario
- orientado a decisiones
- roles y permisos estrictos

## Módulos principales
### 1. Vista general
- ventas del día
- ventas del mes
- pedidos pendientes
- pagos aprobados
- stock bajo
- top productos
- alertas operativas

### 2. Productos
- listado
- crear
- editar
- activar/desactivar
- atributos
- imágenes
- precios
- variantes
- promociones

### 3. Inventario
- stock por producto
- stock por almacén si existe
- movimientos
- ajustes
- reservas
- alertas

### 4. Pedidos
- cola de pedidos
- estados
- detalle de cliente
- detalle de items
- pago
- envío
- historial
- acciones rápidas

### 5. Domicilios / despacho
- guía
- transportador
- estado
- fecha
- trazabilidad

### 6. Ventas
- totales
- ticket promedio
- top categorías
- top productos
- comparación por periodo

### 7. Clientes / leads
- contactos
- historial de pedidos
- estado comercial
- fuente de adquisición
- seguimiento

### 8. Promociones
- campañas
- descuentos
- productos asociados
- fechas
- activación/desactivación

### 9. Contenido
- banners
- secciones home
- anuncios
- publicaciones destacadas

### 10. Usuarios internos
- admins
- roles
- permisos
- auditoría

## Roles sugeridos
- SuperAdmin
- Gerente Operativo
- Inventario
- Ventas
- Soporte
- Marketing
- Despacho
- Finanzas

## KPIs críticos
- tasa de conversión
- pedidos por canal
- ventas por categoría
- stock disponible
- stock crítico
- tiempo de despacho
- pedidos cancelados
- pagos aprobados
- abandono de carrito
- tickets de soporte

## Componentes de UI
- tarjetas KPI
- tablas densas con filtros
- drawer lateral de detalle
- modales de confirmación
- chips de estado
- gráficos de serie temporal
- alertas visibles
- barra de búsqueda global

## Reglas de operación
- toda acción crítica requiere confirmación
- toda modificación importante deja registro
- el usuario ve solo lo que su rol permite
- el dashboard debe ser rápido incluso con grandes volúmenes

## Experiencia de uso
El panel debe permitir:
- buscar un pedido en menos de 3 segundos
- actualizar stock con pocos clics
- cambiar estado de despacho con trazabilidad
- detectar productos críticos visualmente
- revisar ventas sin exportar archivos externos

## Criterios de aceptación
- navegación clara
- permisos correctos
- acciones críticas auditadas
- rendimiento alto
- métricas confiables
- cero dependencia del login de clientes
