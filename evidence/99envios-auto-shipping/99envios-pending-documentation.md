# Brechas documentales 99 Envíos

Estado: pending_documentation / unsupported_by_current_docs hasta recibir endpoint oficial o credenciales sandbox/producción.

- Tracking directo por guía: no aparece endpoint documentado en OpenAPI actual.
- Webhooks: no aparece endpoint/contrato de suscripción, firma ni eventos oficiales.
- Cancelación de guía: no aparece endpoint documentado.
- Recolecciones: no aparece endpoint documentado.
- Wallet: no aparece endpoint documentado.
- Liquidaciones: no aparece endpoint documentado.
- Recaudo detallado/conciliación COD: solo se documenta AplicaContrapago y valor_contrapago en cotización, sin endpoint financiero.
- Devoluciones: no aparece endpoint documentado.
- WhatsApp API: no aparece endpoint documentado.
- Envíos masivos: no aparece endpoint documentado.
- Ciudades DANE: no aparece endpoint documentado para consulta/catálogo.
- Sucursales: no aparece endpoint documentado para listar/consultar sucursales.
- Transportadoras disponibles: no aparece endpoint documentado; se usan transportadoras del response de cotizar.
- Consulta guía/preenvío por número: no aparece endpoint documentado.
- Expiración JWT: no aparece TTL exacto; se usa cache server-side conservador con reauth en 401.
- Sandbox separado: no aparece ambiente sandbox separado en OpenAPI; se mantiene configurable por env.
