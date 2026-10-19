# Matriz de terceros y flujos de datos — DistriTools JL

> DRAFT · 1.0.0-draft · NO_PUBLICAR · revisión profesional, aprobación y firma pendientes.

```json
{
  "docId": "LEGAL-11",
  "publicSlug": null,
  "semanticVersion": "1.0.0-draft",
  "status": "DRAFT",
  "authorAgent": "LEGAL-DOCS-01",
  "preparedAt": "2026-10-19T04:30:45.939240+00:00",
  "reviewedAt": null,
  "verifiedSources": [
    "L03",
    "R01"
  ],
  "sourcesConsultedAt": "2026-10-19 UTC / 2026-10-18 America/Bogota",
  "factsPending": [
    "B01",
    "B02",
    "B03",
    "B08",
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
  "checksum": "a50f862a3a4c6477b0dd55805dcc8728039db0d78a58754516798cc78b5ec31e",
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

### F11-01 — Regla de identificación
La clasificación se decide por quién determina finalidad y medios relevantes del tratamiento, no por llamar «proveedor» a alguien. Antes de transferir se completarán razón social real, contrato, ubicación y acceso de soporte, subencargados, categorías, fundamento, medidas y destino final del dato. Ningún contrato, proveedor real o país se acredita por esta matriz. [L03 arts. 3, 17–18, 26; R01]

### F11-02 — Inventario condicionado
| Flujo y destinatario | Datos mínimos | Rol que debe confirmarse | Situación / control previo |
|---|---|---|---|
| Checkout → operador del comercio | Nombre, contacto, entrega, líneas y referencia pago | Responsable real | PENDING_FORMALIZATION; identificar antes de recolectar |
| Aplicación → alojamiento / base / respaldo | Registros operativos mínimos, cifrados y por función | Encargado si obra por instrucciones | Proveedor y países desconocidos; contrato y subencargados pendientes |
| Comercio → Bold / emisor / sistema de pago | Referencia de orden, monto y contacto estrictamente requerido; no CVV al comercio | Separar encargo y responsabilidad financiera autónoma | BLOCKED_PROVIDER; sin llamadas reales ni prueba de PSE |
| Comercio → Envia.com / transportador | Destino, contacto de entrega, bulto y recaudo si procede | Separar plataforma intermediaria, encargado y transportador responsable autónomo | Integración futura; contrato, cobertura, países y reparto pendientes |
| Comercio → email | Destinatario y mensaje transaccional o promocional autorizado | Encargado de envío o rol mixto según contrato | Proveedor no designado; dominio y envío no verificados |
| Comercio → Meta / WhatsApp | Número y contenido limitado según evento/preferencia | Evaluar términos, encargado / responsable para usos propios | Futuro no activo; plantillas, acceso internacional y autorización pendientes |
| Sitio → analítica / publicidad | Eventos y pseudónimos solo si habilitados lícitamente | Según finalidades propias / instrucciones | No se acredita destinatario externo activo; no habilitar opcionales |
| CRM → operador / exportación | Perfil mínimo por permiso y necesidad | Personal autorizado del responsable o encargado contratado | Exportación A34 BLOCKED_DECISION; prohibida reutilización en listas |
| Atención → autoridad / asesor real | Expediente estrictamente pertinente | Según competencia o mandato | Requerimiento y legitimación deben verificarse, sin envío por esta fase |
[L03, R01; datos de proyecto y código E01–E12; autorización de proveedores ausente]

### F11-03 — Transferencia y transmisión internacional
Transferencia a responsable: comprobar nivel adecuado o excepción específica del artículo 26; si no aplica, tramitar conformidad ante SIC según corresponda. No se promete adecuación para todos los países. Transmisión a encargado: comprobar contrato de los artículos 2.2.2.25.5.1–2; bajo ese supuesto reglamentario no se exige informar y obtener consentimiento adicional por la transmisión como si fuese transferencia, pero subsisten base del tratamiento, política y obligaciones. El acceso remoto, respaldos y subencargos cuentan para el inventario. Si cambia el rol o finalidad, se vuelve a evaluar antes del envío. [L03 art. 26; R01 secc. 5]

### F11-04 — Control de contratación y salida
Privacidad y Seguridad propondrán un anexo con instrucciones, finalidades, confidencialidad, acceso, incidentes, cooperación en derechos, subencargos, países, auditoría y retorno/supresión al terminar, con evidencia. Un encargado no podrá usar la base para campañas propias por defecto. Operaciones verificará que el adaptador envíe solo campos aprobados y falle sin fingir éxito; pruebas y autorización proveedor son futuras. El registro de flujos deberá versionarse con cada cambio contractual. [L03 arts. 17–18; R01; control propuesto B08]
