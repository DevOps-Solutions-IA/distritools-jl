# 09_DEPLOYMENT.md — Despliegue y operación

## Objetivo
Definir cómo se publica el sistema con seguridad, control y posibilidad de rollback.

## Entornos
- development
- staging
- production

## Variables de entorno
Toda configuración sensible debe vivir fuera del código:
- DATABASE_URL
- REDIS_URL
- JWT_SECRET
- PAYMENT_GATEWAY_SECRET
- WHATSAPP_API_TOKEN
- STORAGE_BUCKET
- CDN_URL
- APP_BASE_URL

## Infraestructura sugerida
- Docker para contenedores
- CI/CD para build y pruebas
- base de datos administrada o altamente respaldada
- storage de imágenes
- CDN
- logs centralizados
- alertas de error

## Flujo de despliegue
1. merge a rama principal controlada
2. correr pruebas
3. construir artefactos
4. ejecutar migraciones
5. desplegar staging
6. validar smoke tests
7. promover a producción
8. monitorear métricas
9. activar rollback si falla

## Reglas de migración
- primero staging
- luego producción
- jamás migrar sin backup
- documentar cambios de esquema
- probar rollback

## Observabilidad
Debe incluir:
- logs estructurados
- métricas
- trazas
- alertas
- health checks

## Backups
- backup automático de base de datos
- backup de assets críticos
- retención definida
- restauración probada

## Seguridad de despliegue
- secretos en vault o gestor seguro
- acceso mínimo necesario
- deploy sin credenciales expuestas
- protección de rama principal
- review obligatorio

## Rollback
Debe existir:
- rollback de aplicación
- rollback de migración si aplica
- rollback de configuración
- rollback de assets si afecta UI crítica

## Criterio de aceptación
El sistema está listo para producción cuando:
- build estable
- migraciones sanas
- pruebas verdes
- monitoreo activo
- rollback probado
- soporte operativo disponible
