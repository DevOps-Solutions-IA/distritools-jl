# Calendario de conservación, bloqueo y destrucción — DistriTools JL

> DRAFT · 1.0.0-draft · NO_PUBLICAR · revisión profesional, aprobación y firma pendientes.

```json
{
  "docId": "LEGAL-12",
  "publicSlug": null,
  "semanticVersion": "1.0.0-draft",
  "status": "DRAFT",
  "authorAgent": "LEGAL-DOCS-01",
  "preparedAt": "2026-10-19T04:30:45.939240+00:00",
  "reviewedAt": null,
  "verifiedSources": [
    "L02",
    "L03",
    "L07",
    "R01"
  ],
  "sourcesConsultedAt": "2026-10-19 UTC / 2026-10-18 America/Bogota",
  "factsPending": [
    "B01",
    "B02",
    "B03",
    "B07",
    "B08",
    "B09",
    "B10",
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
  "checksum": "b28e2fe0c5652859c12e2d8c18e969702608da8eccd6b173fc4ef72660084a0f",
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

### R12-01 — Método y límites
No se autoriza conservar toda la información por diez años ni borrarla íntegra por una revocación. El responsable deberá justificar por categoría finalidad, obligación, fecha inicial, acceso, plazo y evento de destrucción. Los plazos empresariales propuestos requieren aprobación; no se presentarán como ley. El archivo legal permanecerá restringido y excluido de campañas. Identificar al operador real también es indispensable para determinar sus obligaciones tributarias y documentales. [L03, R01 art. 2.2.2.25.2.8; L07]

### R12-02 — Calendario propuesto
| Categoría | Inicio / fin de finalidad | Retención y fundamento | Dueño / acción |
|---|---|---|---|
| Libros y papeles del comerciante, soporte contractual de venta | Último asiento, documento o comprobante correspondiente | 10 años según art. 28 Ley 962, con reproducción exacta; identificar qué soporte integra esta categoría | Contabilidad / archivo íntegro y restringido; no arrastrar todos los perfiles |
| Facturas y pruebas tributarias | Según emisión y período/obligación | Contador debe confirmar normas especiales, firmeza y reglas vigentes; no se fija «5 años para todo» | Contabilidad B10; no destruir antes de clasificación |
| Pedido, pago y entrega que prueban relación comercial | Transacción y último soporte | Soporte duradero por término de documentos de comercio art. 50(e), armonizado con Ley 962 | Operaciones + contabilidad; separar notas no necesarias |
| Cotización no aceptada y consulta comercial | Cierre de atención sin operación | Propuesta: revisión a los 6 meses del cierre para supresión si no hay finalidad o retención justificada; no plazo legal | Comercial B09; aprobación pendiente |
| Carrito local | Uso solicitado / retiro o caducidad definida | Duración real por inventariar; propuesta de vencimiento que evite persistencia indefinida | Frontend + privacidad B07/B09; NOT_TESTED |
| Autorizaciones y cambios de preferencias | Acto y último tratamiento autorizado | Mientras se trate bajo esa autorización y después lo necesario para prueba/defensa bajo plazo motivado; no término legal fijo único verificado | Privacidad; conservar texto exacto y eventos, luego limitar/suprimir |
| Lista mínima de exclusión de publicidad | Revocación | Mientras sea necesaria para evitar reactivación y haya fundamento; revisión de necesidad aprobada | Marketing + privacidad; no reutilizar para campaña |
| Garantía / PQR / disputa | Recepción hasta resolución y obligaciones / acciones aplicables | Hasta cierre y término jurídico de conservación/defensa documentado por caso | Atención + asesor real B11; legal hold si procede |
| Sesión, autenticación, logs de seguridad y auditoría | Evento / terminación de acceso | No hay término general uniforme verificado; propuesta revisión 90 días para logs de seguridad no probatorios; justificar extensión | Seguridad B09; excluir secretos y minimizar |
| Respaldo de datos | Captura y ciclo de backup aprobado | Rotación propuesta máximo 90 días, pendiente prueba y decisión; preservación mayor solo justificada | Infraestructura B09; registro de expiración y prueba de restauración futura |
[L02 art. 50(e); L03; L07; R01; plazos propuestos marcados B09]

### R12-03 — Retención jurídica y derechos
Un reclamo, investigación u orden de autoridad puede justificar suspensión de destrucción de la evidencia pertinente. Se registrarán motivo, fuente, categorías, alcance, responsable, fecha de revisión y condición de levantamiento. Un «por si acaso» no es una retención jurídica perpetua. Al revocar publicidad se detienen campañas aunque se conserven soporte de compra o reclamo; al responder supresión parcial se explica qué se mantiene y por qué. [L03 arts. 8, 17–18; R01; procedimiento propuesto]

### R12-04 — Destrucción verificable y respaldos
Se verificará vencimiento y ausencia de obligación vigente, autorizará la eliminación por función competente y dejará acta mínima con categoría, criterio, período, método y resultado sin copiar los datos eliminados. Se ordenará lo mismo a encargados según contrato. Un respaldo fuera de uso ordinario debe expirar en su ciclo; si se restaura, se aplicarán nuevamente las supresiones y exclusiones vigentes antes de usarlo. La anonimización solo reemplaza supresión cuando sea efectiva e irreversible conforme al riesgo; un hash no garantiza anonimato. Implementación y ensayo de estos controles están NOT_TESTED. [L03, R01; B08–B09]
