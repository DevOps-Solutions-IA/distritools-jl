# Brechas técnicas, controles y riesgos documentados — DistriTools JL

> DRAFT · 1.0.0-draft · NO_PUBLICAR · revisión profesional, aprobación y firma pendientes.

```json
{
  "docId": "LEGAL-GAPS",
  "publicSlug": null,
  "semanticVersion": "1.0.0-draft",
  "status": "DRAFT",
  "authorAgent": "LEGAL-DOCS-01",
  "preparedAt": "2026-10-19T04:30:45.939240+00:00",
  "reviewedAt": null,
  "verifiedSources": [],
  "sourcesConsultedAt": "2026-10-19 UTC / 2026-10-18 America/Bogota",
  "factsPending": [
    "B01",
    "B02",
    "B03",
    "B04",
    "B07",
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
  "checksum": "2f8e4099fe74e746f44f1ac419d27da11c5e96f49602d14f916877893f1b368c",
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

### G01 — Dictamen delimitado
DEBT_DETECTED en evidencia estática: faltan garantías probatorias y de operación necesarias para activar los textos. No se califican como regresiones introducidas por CONTENT: checkout, DTO, modelo y formulario de contacto son preexistentes en main. El candidato conserva su alcance y ownership; este informe no autoriza editarlo. No se ejecutaron pruebas runtime ni se consultó base publicada. [E01–E12]

### G02 — Registro por brecha y dueño
| Brecha | Evidencia / SHA por registro | Dueño propuesto | Bloqueo y criterio de salida |
|---|---|---|---|
| T01 aceptación checkout no transmitida | E04/E05/E06, líneas de13 | Producto + backend + privacidad | BLOCKED_DECISION B07; contrato y evidencia servidor versionada antes de capturas |
| T02 modelo/flags no prueban autorización | E07/E08 | Privacidad + CRM + backend | DEBT_DETECTED; conservar origen, propósito, texto/version/hash y revocación; no fabricar backfill |
| T03 contacto sin radicación acreditada | E04 ContactRequestForm28–43,89–109 | Atención + producto | BLOCKED_DECISION B03; recepción real con número/fecha/hora/seguimiento y contingencia |
| T04 cotización y CRM con evidencia incompleta | E05 checkout.ts15–21; E08 controller729–752 | Comercial + privacidad | BLOCKED_DECISION B04/B07; no declarar recibida si no hay recepción; prueba original del titular |
| T05 cookies y eventos sin inventario runtime | E12 storage/eventos/BFF | Seguridad + frontend + privacidad | NOT_TESTED; inventario y elección por finalidad, no presumir terceros activos |
| T06 contenido preliminar / publicación no equivale vigencia | E01/E02/E03/E09 | Legal humano + CONTENT futuro | BLOCKED_DECISION B12/B13; identidad, firma y fecha reales, manejo seguro de estados |
| T07 override técnico y aprobación profesional distintos | E10 controller2408–2450; E11 controls | Dirección + revisor legal + Seguridad | BLOCKED_DECISION; el override no permite publicar estos DRAFT; aprobación y evidencia por fuera del RBAC |
| T08 totales, enlaces, comunicación y posventa | E06 usecase165–198; E12footer | Operaciones + pagos + logística + frontend | BLOCKED_PROVIDER / BLOCKED_DECISION; medios reales, total informado y aceptación, enlaces y canales verificados |

### G03 — Diferencias main/candidato ancladas
Las cinco rutas públicas cambian de contenido estático a consulta de publicación en el candidato; `legal-pages.ts` y `LegalPage.tsx` se compararon byte a byte y se registrará el resultado en evidencia. `PublishedLegalPage.tsx` y `lib/api/legal.ts` son nuevos; query de repositorio filtra pageKey, published, publishedAt no nulo, orden version/id descendente y selecciona solo seis campos públicos. Este dato verifica estructura del código, no la versión efectiva de una política. El público recibe versión numérica CMS y fecha de publicación, sin vinculación acreditada a los metadatos jurídicos del paquete. [E01,E02,E03,E09]

### G04 — Riesgo y propuesta de contención
Mantener NO_PUBLICAR y NO-GO. No usar estas políticas para afirmar que la tienda ya cumple, ni marcar consentimiento a partir de UI. Abrir ejecución futura delimitada con contrato de consentimiento, PQR y fechas, sin mezclar cambios con los 45paths CONTENT. Producto evaluará fase segura de carga legal y bloqueo de transacciones dependientes, controles de publicación vacía/ausente y extracción de anexos internos. No se ha alterado ninguna ruta o guard. [B01–B13]

### G05 — Evidencia exigible y rollback
Cada salida requiere fuente exacta, pruebas positiva/negativa/persistencia/reload, hash y permiso; no basta checkbox o screenshot. Guardar fallos y justificar cualquier excepción ante Dirección. El rollback de esta entrega es conservar el folder aislado y marcarlo no utilizable/sustituido, sin tocar producto, datos ni historial. Revisión independiente queda reservada a otro agente, y revisión profesional a persona competente real. [Maestro]
