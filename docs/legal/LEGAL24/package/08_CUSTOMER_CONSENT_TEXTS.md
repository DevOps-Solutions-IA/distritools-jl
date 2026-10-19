# Textos de autorización y contrato de evidencia de consentimiento — DistriTools JL

> DRAFT · 1.0.0-draft · NO_PUBLICAR · revisión profesional, aprobación y firma pendientes.

```json
{
  "docId": "LEGAL-08",
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
    "L08",
    "R01"
  ],
  "sourcesConsultedAt": "2026-10-19 UTC / 2026-10-18 America/Bogota",
  "factsPending": [
    "B01",
    "B02",
    "B03",
    "B04",
    "B07",
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
  "checksum": "75e1b0d3a4a007cf750228d98171f0b7a02e4282014ddf04a079c3deb9b7f0e6",
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

### A08-01 — Condición previa de uso
Los textos siguientes son versiones propuestas, no autorizaciones obtenidas. Antes de cada casilla se mostrarán el responsable real y canales desde el registro central, la finalidad concreta y enlaces a políticas efectivas. Ninguna casilla viene marcada. No se presentará como consentimiento una política publicada, el silencio, el dato importado al CRM o la decisión de un operador sin prueba del titular. El cuerpo final renderizado y sus enlaces deberán conservarse junto con su versión. [L03 arts. 9–12; R01]

### A08-02 — Checkout, autorización operativa CT-CHECKOUT-1.0.0-draft
«Autorizo al responsable identificado en este formulario a tratar mis datos de contacto, pedido, facturación cuando corresponda y entrega para gestionar esta compra y su posventa, según la Política de tratamiento de datos. Conozco mis derechos y el canal para ejercerlos. Esta autorización no incluye ofertas publicitarias». Se vincula a LEGAL-02 y LEGAL-06 efectivos. La persona puede leer antes de decidir; si un dato es indispensable se explicará su función. No se añadirá publicidad a esta casilla. [L03; R01; B07]

### A08-03 — Aceptación de compra CT-TERMS-1.0.0-draft
«He revisado el resumen de productos, cantidades, precio total, impuestos, envío, plazo de entrega y condiciones de esta compra; acepto expresamente esta transacción y los Términos y condiciones indicados». Control separado del consentimiento de datos, con acceso al resumen descargable, corrección y cancelación antes de concluir. No usar «al navegar aceptas comprar». El texto se ajustará al momento contractual aprobado en B04. [L02 art. 50(d); L05]

### A08-04 — Contacto y cotización CT-CONTACT-1.0.0-draft / CT-QUOTE-1.0.0-draft
Contacto: «Autorizo el tratamiento de mis datos para responder y dar seguimiento a esta solicitud, conforme a la Política de tratamiento». Cotización: «Autorizo el tratamiento de mis datos para preparar y atender esta cotización y comunicar su respuesta. Enviar esta solicitud no confirma una compra ni me suscribe a publicidad». Ambos requieren aviso previo y registro real del envío; el operador que ingresa una solicitud recibida por otro canal debe asociar la prueba original, no sustituirla con su propia casilla. [L03; R01; L02; B07]

### A08-05 — Marketing separado por canal CT-EMAIL-1.0.0-draft / CT-WHATSAPP-1.0.0-draft
Correo: «Quiero recibir por correo electrónico ofertas y novedades comerciales de DistriTools JL. Puedo retirar esta elección gratuitamente sin afectar mis compras». WhatsApp: «Quiero recibir por WhatsApp ofertas y novedades comerciales de DistriTools JL en el número que indico. Puedo retirar esta elección gratuitamente sin afectar mis compras». Elegir una no marca la otra. El canal transaccional solicitado, la aceptación del aviso o compartir un teléfono no habilitan publicidad. Previo a campañas se verifican restricciones de contacto y exclusión aplicables; la autorización de datos tampoco acredita cumplimiento de condiciones de Meta ni aprobación de plantillas. [L03, L08; B07–B08]

### A08-06 — Esquema propuesto de prueba y revocación
Registro append-only: eventId, subjectRef o sessionRef que pueda asociarse legítimamente; actorRef si asiste un operador; propósito, canal y elección; acción otorgar/denegar/revocar/corregir; texto y docId/version/hash efectivos mostrados; origen y evidenceRef verificable; timestamp del servidor y requestId; momento de recepción; método de verificación y referencia segura, sin secretos. Hash de IP/agente solo si justificado, sin tratarlos como datos anónimos. Evento posterior de revocación vincula el previo; el estado actual se deriva del histórico. No basta `accepted=true` sin contexto. La ley exige autorización consultable y prueba; estos campos son diseño de evidencia propuesto, no una enumeración literal obligatoria de la ley. [L03, R01, L05; B07]

### A08-07 — Reglas de operación y ensayo futuro
El servidor validará documento efectivo al momento del acto y separará finalidades. Si el texto cambia entre lectura y envío, pedirá revisar la nueva versión o conservará la versión aún aplicable; nunca asociará silenciosamente una distinta. Se verificará persistencia y lectura, negativa de marketing sin bloqueo, retiro por canal, fallo de escritura sin éxito aparente, concurrencia e idempotencia, acceso restringido y borrado conforme a retención. Esas pruebas están NOT_TESTED en esta fase documental y requieren autorización de código/QA posterior. No se inferirá consentimiento histórico por migración. [L03, L05, R01; T01–T05]
