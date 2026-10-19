# Auditoría documental de consentimiento, checkout y privacidad — DistriTools JL

> DRAFT · 1.0.0-draft · NO_PUBLICAR · revisión profesional, aprobación y firma pendientes.

```json
{
  "docId": "LEGAL-13",
  "publicSlug": null,
  "semanticVersion": "1.0.0-draft",
  "status": "DRAFT",
  "authorAgent": "LEGAL-DOCS-01",
  "preparedAt": "2026-10-19T04:30:45.939240+00:00",
  "reviewedAt": null,
  "verifiedSources": [
    "L01",
    "L02",
    "L03",
    "L04",
    "R01"
  ],
  "sourcesConsultedAt": "2026-10-19 UTC / 2026-10-18 America/Bogota",
  "factsPending": [
    "B01",
    "B02",
    "B03",
    "B07",
    "B09",
    "B12",
    "B13"
  ],
  "owner": "Dirección / área de privacidad y servicio al consumidor",
  "lawfulController": null,
  "reviewerIdentity": null,
  "approverIdentity": null,
  "signatoryIdentity": null,
  "approvedAt": null,
  "signedAt": null,
  "effectiveAt": null,
  "replacedAt": null,
  "previousVersion": null,
  "supersedes": null,
  "checksum": "a4d327d145e3ae0a6d64e3bc4c4e1b8d9d6d3801246f3f88e627a88d3c6f61c0",
  "checksumScope": "UTF-8 body after the end of metadata JSON and one blank line; full file hash in LEGAL_VERSION_REGISTER and ROOT final manifest",
  "changeLog": [
    {
      "at": "2026-10-19T04:30:45.939240+00:00",
      "change": "Redacción original de borrador documental para revisión humana; no publicación",
      "label": "VERIFIED"
    }
  ]
}
```

### A13-01 — Alcance y método
Inspección estática de código, sin navegador, DB, secretos ni llamadas de proveedor. Main documental y candidato comparten HEAD base d87c7128846a8b472b793b91c41247647a889766; el candidato tiene cambios no comprometidos y por ello se vincula por SHA256 de archivo, no por HEAD solamente. Rutas absolutas y hashes están en `../CODE_EVIDENCE.json`. PASS solo califica obtención/comparación de fuente; persistencia, runtime, consentimiento real y cumplimiento normativo integral son NOT_TESTED. No es revisión independiente ni dictamen profesional. [E01–E12]

### A13-02 — Hallazgos concretos
| ID | Evidencia estática main / candidato | Consecuencia documental y prueba futura |
|---|---|---|
| T01 | CheckoutForm79: `acceptsTerms:false`;331–344 casilla de tratamiento, schema18 requiere true; mappers30–60 no transmite aceptación ni versión; DTOguest1–111 tampoco | DEBT_DETECTED: no se acredita prueba de autorización en checkout ni aceptación contractual separada. B07/08 especifican diseño; probar servidor/persistencia/negativa sin marketing |
| T02 | schema CustomerConsent693–705 tiene type/accepted/source/hashes opcionales/createdAt, sin docId/version/hash de texto ni finalidad individual; búsqueda delimitada `src` solo referencias administrativas | Existencia de tabla no demuestra escritura. No afirmar que no hay consentimiento en toda infraestructura: recorder y origen externo no comprobados. Revisar migración sin inventar historia |
| T03 | ContactRequestForm28–43 valida y llama `setSubmitted(true)`; no envío de red observado;89–104 casilla;109 confirma preparación manual | No acredita radicado, fecha/hora/seguimiento art50(g), ni recepción efectiva de PQR. Canal real y persistencia pendientes, no prometer gestión recibida |
| T04 | submitGuestCheckout15–21 devuelve `kind:quote` con mensaje «Recibimos» para productos cotizables, antes de `createGuestOrder`; admin CreateQuoteForm sí manda booleano de datos y controller729–752 guarda flags | Diferenciar flujo público sin radicación acreditada de operación CRM. Flag introducido por operador no equivale a prueba del titular; fuente original pendiente |
| T05 | cart/storage11,28 localStorage; commerce-events37–53 despacha CustomEvent local y filtra claves22–34; cookies administración en BFF | No afirmar analítica externa activa. Inventariar cookies, receptores, duraciones, terceros y controles de elección en runtime. No se acreditó gestor de consentimiento en alcance |
| T06 | Main5rutas importan LegalPage/getLegalPage; candidato PublishedLegalPage7 missing→fallback,8 unavailable→aviso,29/36 publicación/sintexto | Fallback estático preliminar no es aprobación; publicación sin contenido es caso separado. No hay fecha efectiva ni identidad humana acreditadas por endpoint |
| T07 | Controller legal2337–2450: edición limitada, permisos write/review/approve/publish, revisión previa, checklist, detección de placeholders, legalOverride y auditoría | Controles técnicos no certifican identidad, capacidad, firma ni revisión profesional. legalOverride no habilita publicación documental. Probar roles y evidencia humana en fase autorizada |
| T08 | Guest usecase165–198 envía customer/shipping/audit sin consentimiento;187 shippingTotal0; footer dinámico y proyección omiten enlaces inválidos con auditoría | Revisar flete y aceptación del total real antes de activar; cero técnico no prueba envío gratis. Verificar enlaces efectivos, acuse de pedido, privacidad, PQR, notificación y conciliación reales |
[E04–E12; L01,L02,L03,L04,R01; implementación propuesta, runtime NOT_TESTED]

### A13-03 — Recorrido privacy-by-design
Navegación: minimizar datos y separar opcionales; carrito: duración y recuperación; checkout: identidad, total, plazo y evidencia; cuenta/cliente: base de creación, accesos y retiro; cotización: prueba de origen, aceptar precio separado de compra; CRM: perfiles mínimos y exportación A34 pendiente; comunicaciones: separar transaccional y campañas, estados reales; tracking: referencia no adivinable y sin PII; administración: acceso por necesidad y auditoría mínima. La presencia de guards/masking en código no reemplaza ensayos negativos; no se ejecutaron aquí. [L01,L02,L03,R01; B07–B09]

### A13-04 — Matriz de aceptación para otra ejecución
Requerir pruebas de versión efectiva exacta y cambio entre lectura/envío; rechazo de publicidad sin bloqueo de compra; autorización persistida con evidencia y fallo atómico sin éxito aparente; retiro por canal y exclusión de campañas; consulta/rectificación y conservación legal; expiración/retención en backups; publicación ausente/error/vacía; RBAC de datos y auditoría sin secretos; acuse de pedido día siguiente; PQR con radicado/fecha/hora/seguimiento y devolución por causal; ningún proveedor falso. Resultado de todas estas pruebas: NOT_TESTED. No ejecutar producto desde este paquete. [B03–B13]
