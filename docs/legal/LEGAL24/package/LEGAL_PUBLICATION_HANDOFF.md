# Entrega para una eventual publicación autorizada — DistriTools JL

> DRAFT · 1.0.0-draft · NO_PUBLICAR · revisión profesional, aprobación y firma pendientes.

```json
{
  "docId": "LEGAL-PUBLICATION",
  "publicSlug": null,
  "semanticVersion": "1.0.0-draft",
  "status": "DRAFT",
  "authorAgent": "LEGAL-DOCS-01",
  "preparedAt": "2026-10-19T04:30:45.939240+00:00",
  "reviewedAt": null,
  "verifiedSources": [
    "L02",
    "L03",
    "L05",
    "R01"
  ],
  "sourcesConsultedAt": "2026-10-19 UTC / 2026-10-18 America/Bogota",
  "factsPending": [
    "B01",
    "B02",
    "B03",
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
  "checksum": "1eca4a4bd3f50a719498488f064fea6ea5272aeb914b9cc691054d15b41419ba",
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

### H01 — Prohibición actual y efecto de usuario
NO_PUBLICAR. Todo el paquete es DRAFT sin firma ni vigencia, externo al producto. No hubo cambios API, CMS, storefront, STATE ni configuración; impacto directo actual NONE_EXPECTED. Un uso posterior tendría impacto STOREFRONT_CUSTOMER / CHECKOUT_PAYMENT / AUTH_SECURITY y requiere ejecución autorizada, registro de impacto y QA propios. Producción NO-GO. [Maestro, ownership]

### H02 — Mapa de documentos y rutas
| Documento | Ruta pública existente o propuesta | Estado de la ruta / enlaces |
|---|---|---|
| LEGAL-01 | /politica-de-privacidad | Existe main y candidato; antes de consentir requiere versión efectiva |
| LEGAL-02 | /tratamiento-de-datos | Existe; checkbox checkout/contacto enlaza esta ruta |
| LEGAL-03 | /terminos-y-condiciones | Existe; añadir aceptación contractual explícita como fase futura |
| LEGAL-04 | /politica-de-envios | Existe; enlazar resumen de entrega antes del cierre |
| LEGAL-05 | /cambios-devoluciones-y-garantias | Existe; enlace posventa y formulario reclamación |
| LEGAL-06 | /aviso-de-privacidad | Propuesta, no implementación acreditada; aviso junto a captura |
| LEGAL-07 | /politica-de-cookies | Propuesta, no implementación acreditada; preferencias persistentes |
| LEGAL-14 | /resumen-de-derechos | Propuesta, no implementación acreditada; no sustituye políticas |
Documentos08–13 y registros son internos salvo fragmentos expresamente aprobados. El footer dinámico no acredita que cada enlace esté visible en una instancia desplegada; deberá verificarse la revisión publicada y su resolución real. [E01–E12; NOT_TESTED runtime]

### H03 — Distinción main y candidato CONTENT
Main: las cinco rutas cargan `getLegalPage` estático y `LegalPage` muestra contenido preliminar con aviso de revisión. Candidato: las cinco rutas consultan `getPublishedLegal`; 404 (`missing`) invoca `LegalPage` estático, error (`unavailable`) muestra indisponibilidad; publicación válida usa `PublishedLegalPage`. Existe caso distinto de publicación válida sin texto, con aviso específico. No se confunde el fallback preliminar con publicación aprobada, ni «publicado vacío» con «sin publicación». La disponibilidad observada es estática; no se consultó DB. Evidencias y límites en13 y gaps. [E01,E02,E03,E09]

### H04 — Política segura propuesta para una fase de código
Mostrar como documento vigente solo una versión cuya identidad, aprobación humana, firma, fecha efectiva, integridad y publicación autorizada estén acreditadas. Si falta publicación, mostrar «Documento aún no publicado» con atención válida y bloquear aceptación dependiente; no presentar borrador extenso como términos vigentes. Ante error mostrar indisponibilidad explícita sin convertirlo en contenido efectivo. Una publicación vacía no habilitará aceptación. Conservar versiones previas aplicables a compras/consentimientos. Estos son requisitos propuestos para decisión e implementación posteriores; no cambian el contrato CONTENT aprobado ni autorizan refactor ahora. [L02 art.50; L03; R01; B07/B13]

### H05 — Preflight para publicar en otra ejecución
Verificar: registro central completo; revisión profesionalB12; decisiones operativas; aprobación/firmaB13; metadatos y texto sin anexos internos; correspondencia determinista de slug/pageKey y versión semántica del paquete a versión numérica CMS; enlaces descargables; prueba de aceptación y PQR; frontend/API/RBAC/auditoría/publicación negativa/rollback; nueva verificación independiente; autorización explícita Dirección. `legalOverride` no sustituye ninguno de estos hechos. La transformación de Markdown a `content.sections` o `content.text` requiere validación de integridad y no debe introducir HTML inseguro o eliminar derechos. [E09–E11; B13]

### H06 — Rollback sin producto
En esta fase basta conservar aislado el paquete y marcarlo como sustituido/no utilizable; no hay DB ni frontend que revertir. Si posteriormente se autoriza publicación, el plan deberá restaurar solo una versión anterior realmente efectiva y mantener historia/auditoría; si no existe versión válida se mostrará indisponibilidad y se suspenderán capturas/transacciones dependientes mediante cambio autorizado. Nunca borrar prueba de consentimientos ni reactivar borradores para ocultar una retirada. Retener fuente, aprobación, artefacto y razón del rollback. [L03,L05; gobierno propuesto]
