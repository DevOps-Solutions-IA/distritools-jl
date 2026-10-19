# Flujo de revisión, aprobación y firma — DistriTools JL

> DRAFT · 1.0.0-draft · NO_PUBLICAR · revisión profesional, aprobación y firma pendientes.

```json
{
  "docId": "LEGAL-APPROVAL",
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
    "L05",
    "R01",
    "R02",
    "R03"
  ],
  "sourcesConsultedAt": "2026-10-19 UTC / 2026-10-18 America/Bogota",
  "factsPending": [
    "B01",
    "B02",
    "B03",
    "B06",
    "B11",
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
  "checksum": "9b0ee39b6ff4bebd89e107fb9b603461713edd2876dfa9cca3be76ef4b1ea6b9",
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

### W01 — Estados y autoridades
DRAFT_IN_PROGRESS → TECHNICAL_LEGAL_REVIEW → READY_FOR_BUSINESS_REVIEW → READY_FOR_COUNSEL_APPROVAL → APPROVED_BY_AUTHORIZED_PERSON → SIGNED → EFFECTIVE → SUPERSEDED. La etapa documental actual es DRAFT, lista para revisión independiente técnica tras el cierre del autor. Ningún agente ni un estado `approved` del CMS acreditan matrícula profesional, competencia, poder de representación o firma jurídica. El límite del paquete es READY_FOR_COUNSEL_AND_BUSINESS_APPROVAL una vez ROOT concilie revisión independiente; no EFFECTIVE. [Gobierno del maestro]

### W02 — Expediente para asesor y negocio
Se entrega el texto íntegro por docId, cláusulas y fuentes, límites de vigencia, decisiones B01–B13, brechas T01–T08 y evidencias de código. El asesor real verificará régimen y reformas, contratos y condiciones del producto, excepciones y plazos, y dejará comentario por cláusula con conclusión aceptada/cambio solicitado y razón. Contabilidad revisará facturación/retención. Operaciones aprobará únicamente hechos que puede cumplir. La independencia técnica de otro agente no reemplaza esa revisión. [L01, L02, L03, L04, R01, R02; procedimiento propuesto]

### W03 — Solicitud de cambio
Registro por solicitud: changeId; docId/version y clauseId; autor humano; tipo factual/legal/técnico; texto anterior y propuesto; fuente o decisión; impacto en otros documentos, consentimientos y operaciones; aprobador competente; fecha real; resultado y evidencia. Se conserva preimagen y se calcula postimagen; cambio material produce nueva versión y reabre revisiones afectadas. Los desacuerdos no se borran ni se transforman en aprobación por silencio. No se altera un archivo congelado sin comunicar revisión y reemplazo. [L05; gobierno propuesto]

### W04 — Identidad, aprobación y firma
Antes de aprobar: completar registro de identidad con soporte válido, comprobar facultad del vendedor/responsable y del representante que firma, matrícula del asesor cuando corresponda y contacto de atención real. El acta humana identificará archivos y hashes exactos, alcance, reservas, firmante y poder; reviewedAt, approvedAt y signedAt solo se completan con hechos reales. El método de firma deberá permitir identificar al firmante y su intención, ser confiable/apropiado y conservar integridad, acceso y evidencia según el acto; no se equipara checksum a firma ni se exige universalmente certificado digital para toda aceptación. La firma electrónica se evaluará conforme Ley527 y D1074cap47 (compilaD2364/2012), sin alegar una ceremonia ya realizada. [L05 arts.6–12,28; R03]

### W05 — Fecha efectiva y publicación
El documento firmado fijará fecha real de entrada en vigencia no retroactiva, versión anterior que reemplaza y cómo se avisa. Deben completarse enlaces, archivos descargables, identidad, base temporal de datos y pruebas de aceptación. Una modificación de finalidad requerirá nueva autorización cuando proceda; la aceptación histórica quedará vinculada a la versión original. Dirección deberá autorizar por separado la carga/publicación y verificar resultado. Esta fase no modifica CMS ni DB. [L03; R01; L02 art.50; B13]

### W06 — Formulario de acta sin firmas
Campos estructurados reservados: reviewerIdentity=null; reviewerCredential=null; reviewEvidence=null; authorizedApprover=null; legalSignatory=null; authorityEvidence=null; reviewedAt=null; approvedAt=null; signedAt=null; effectiveAt=null; signedHashes=null; publicationApproval=null. Están nulos porque el hecho no ocurrió. El registro central es el origen único de sustitución; ninguna línea es espacio para fabricar una firma. [Gobierno propuesto]

### W07 — Comprobaciones que faltan
Asesor: fuentesB12 y consistenciaB2C/B2B. Dirección: identidadB01/B02, atenciónB03, condicionesB04/B06/B11. Finanzas: devoluciónB05/facturaciónB10. Privacidad/Seguridad: consentimientoB07, tercerosB08, retenciónB09. Firmante: autoridad y fechaB13. ROOT: revisión independiente y sello externo de hashes. Cada evidencia debe tener dueño, fecha real y resultado; no hay aprobación final en este paquete.
