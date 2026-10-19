# Política de cookies y almacenamiento del navegador — DistriTools JL

> DRAFT · 1.0.0-draft · NO_PUBLICAR · revisión profesional, aprobación y firma pendientes.

```json
{
  "docId": "LEGAL-07",
  "publicSlug": "politica-de-cookies",
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
  "checksum": "212c83d3bea39f7f04ae064d621eba1d1a7b88cf7a2942ff481c3a76ca01fd9b",
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

### C07-01 — Objeto y tecnologías
Cookies, almacenamiento local y otros identificadores pueden recordar funciones o permitir seguimiento. Cuando identifican o hacen identificable a una persona, su tratamiento queda sujeto a las reglas colombianas aplicables de datos personales. No se adopta un régimen europeo como obligación colombiana automática. Esta propuesta aplica minimización, información y elección demostrable; no certifica un escaneo del sitio desplegado. [L03, R01]

### C07-02 — Categorías y elección
| Categoría | Finalidad delimitada | Regla propuesta antes de activación |
|---|---|---|
| Funcional estrictamente necesaria | Mantener carrito solicitado, sesión autenticada y seguridad indispensable | Informar finalidad y duración, evaluar base de datos personales; no extender a publicidad |
| Preferencia opcional | Recordar opciones no indispensables | Explicar, permitir elección y retiro; apagada si no hay elección válida |
| Analítica identificable | Medir comportamiento asociado a identificador | Deshabilitada hasta inventario, finalidad, proveedor y autorización aplicables |
| Publicidad / seguimiento entre sitios | Personalizar ofertas y medir campañas | Deshabilitada por defecto; consentimiento separado y prueba; no condicionar compra |
La necesidad técnica no es una exención general para tratar datos personales: se documentará la base de cada finalidad. [L03 arts. 4, 9–12; R01; diseño B07]

### C07-03 — Inventario estático y límites
Se observó almacenamiento local de carrito en `frontend/src/features/cart/storage.ts` y cookies de acceso administrativo en el código BFF. El emisor de eventos comerciales inspeccionado despacha `CustomEvent` local y filtra algunas claves; esto no prueba envío a un tercero ni anonimato integral. No se observó en la revisión delimitada un gestor de consentimiento de cookies. Nombres completos, atributos, dominios, duración real, SDK, scripts dinámicos, cachés y receptores de eventos deben inventariarse mediante prueba posterior autorizada. Por tanto no se publican duraciones inventadas ni una lista de proveedores «activos». [T05; evidencia código E01–E12; runtime NOT_TESTED]

### C07-04 — Preferencias y rechazo
La futura interfaz deberá permitir aceptar o rechazar opcionales con facilidad comparable y configurar por categoría sin premarcarlas. Reabrir «Preferencias de privacidad» permitirá retirar elecciones futuras, detener etiquetas y eliminar identificadores opcionales que controle el comercio, conservando solo la prueba mínima y las obligaciones aplicables. Borrar cookies en el navegador puede cerrar sesiones o vaciar el carrito; no revoca por sí solo el marketing que se haya suscrito por otros canales. [L03, R01; especificación B07]

### C07-05 — Terceros y actualización
No se cargará analítica o publicidad opcional antes de resolver receptor, país, contrato, duración y fundamento. Cada nueva tecnología deberá actualizar el inventario y evaluar si requiere nueva autorización. La política efectiva mostrará versión y fecha real, el canal de derechos y la identidad validada. El inventario técnico definitivo y la preferencia de cookies están BLOCKED_DECISION / NOT_TESTED, según corresponda, no implementados por este documento. [L03 art. 26; R01; B07–B08]
