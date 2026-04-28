# 10_CODEx_PROMPTS.md — Biblioteca de prompts para IA Codes

## Objetivo
Dar a IA Codes instrucciones suficientemente estrictas para construir cada módulo sin improvisación.

## Instrucciones globales
- Leer memoria técnica antes de hacer cualquier cambio.
- No asumir reglas de negocio no documentadas.
- No implementar sin validación.
- No tocar archivos no relacionados.
- No romper compatibilidad sin documentar.
- Mantener arquitectura modular.
- Entregar resultados verificables.
- Si falta información crítica, reportar el bloqueo antes de avanzar.

## Prompt 1 — Arquitectura general
```text
Analiza el repositorio y construye la arquitectura base de DistriTools JL.
Debes identificar stack, módulos, flujo de datos, dominios críticos, dependencias, riesgos y orden de implementación.
No generes código todavía. Primero entrega:
1. mapa de arquitectura
2. mapa de módulos
3. mapa de riesgos
4. prioridades
5. decisiones técnicas recomendadas
6. criterios Go/No-Go
```

## Prompt 2 — Base de datos
```text
Diseña el esquema SQL completo para la plataforma.
Incluye tablas, relaciones, claves foráneas, índices, restricciones, estados y auditoría.
La base debe soportar e-commerce, inventario, pedidos, pagos, despacho, dashboard y logs.
Entrega DDL, explicación de relaciones y observaciones de integridad.
```

## Prompt 3 — Backend
```text
Implementa el backend modular de DistriTools JL.
Debes separar servicios por dominio, mantener validación estricta, transacciones, auditoría, idempotencia y pruebas.
No mezcles lógica de negocio en controladores.
Entrega código limpio, pruebas y documentación de endpoints.
```

## Prompt 4 — Inventario
```text
Implementa un inventario perpetuo con reservas, movimientos, stock mínimo y alertas.
La venta debe descontar stock únicamente mediante flujo transaccional y registrar movimiento histórico.
Incluye pruebas de stock, cancelación, devolución y ajuste manual.
```

## Prompt 5 — Pagos
```text
Implementa integración de pagos segura con confirmación por webhook.
La confirmación del pedido no puede depender del frontend.
Debes manejar reintentos, idempotencia, duplicados, rechazo y conciliación.
Incluye pruebas de sandbox y casos de error.
```

## Prompt 6 — Frontend público
```text
Construye el e-commerce público con UX moderna, responsive, accesible y de alta conversión.
Debe incluir home, categorías, subcategorías, producto, carrito, checkout, confirmación y soporte.
No debe tener login para clientes.
Debes optimizar SEO y performance.
```

## Prompt 7 — Dashboard
```text
Construye el dashboard administrativo con roles y permisos.
Debe mostrar ventas, pedidos, stock, domicilios, promociones, reportes y auditoría.
La interfaz debe ser densa, clara y rápida.
Cada acción crítica debe dejar rastro.
```

## Prompt 8 — UX/UI system
```text
Aplica el sistema visual corporativo completo a todo el producto.
Usa los tokens definidos, garantiza accesibilidad, consistencia y jerarquía visual.
Debes producir componentes reutilizables y documentar su uso.
```

## Prompt 9 — QA
```text
Genera y ejecuta pruebas unitarias, de integración, e2e, accesibilidad y rendimiento.
Define criterios de aprobación y bloqueo.
No pases a producción si alguna validación crítica falla.
```

## Prompt 10 — Deploy
```text
Prepara el sistema para despliegue controlado.
Incluye variables de entorno, migraciones, back up, monitoreo, health checks y rollback.
La entrega final debe ser reproducible y segura.
```

## Prompt de bloqueo
```text
Antes de modificar cualquier archivo, revisa memoria técnica y estado actual del sistema.
Si el cambio puede afectar stock, pago, pedido, permisos o navegación crítica, debes proponer primero el plan de impacto.
No hagas cambios sin justificar dependencias, riesgos y pruebas asociadas.
```

## Orden recomendado de ejecución
1. 00_MASTER_PROMPT
2. 01_ARCHITECTURE
3. 03_DATABASE_SCHEMA
4. 02_BACKEND_GUIDE
5. 04_API_SPEC
6. 05_DASHBOARD_SPEC
7. 06_ECOMMERCE_SPEC
8. 07_UX_UI_SYSTEM
9. 08_QA_AND_GATES
10. 09_DEPLOYMENT

## Criterio final
La IA Codes debe operar como un equipo enterprise disciplinado, no como un generador de fragmentos sueltos.
