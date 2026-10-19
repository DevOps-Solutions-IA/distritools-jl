# Matriz de fuentes, artículos y cumplimiento — DistriTools JL

> DRAFT · 1.0.0-draft · NO_PUBLICAR · revisión profesional, aprobación y firma pendientes.

```json
{
  "docId": "LEGAL-SOURCES",
  "publicSlug": null,
  "semanticVersion": "1.0.0-draft",
  "status": "DRAFT",
  "authorAgent": "LEGAL-DOCS-01",
  "preparedAt": "2026-10-19T04:30:45.939240+00:00",
  "reviewedAt": null,
  "verifiedSources": [
    "J01",
    "L01",
    "L02",
    "L03",
    "L04",
    "L05",
    "L06",
    "L07",
    "L08",
    "R01",
    "R02",
    "R03",
    "X01"
  ],
  "sourcesConsultedAt": "2026-10-19 UTC / 2026-10-18 America/Bogota",
  "factsPending": [
    "B01",
    "B02",
    "B03",
    "B05",
    "B10",
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
  "checksum": "3071ffe2a988c3779fbb3d66fcf4c3e124cfa46abd45a89716209c061d283244",
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

### M01 — Método, consulta y alcance de vigencia
Consulta real: 2026-10-19 UTC / 2026-10-18 America/Bogota. Textos originales en español redactados para este proyecto; no se copia una política comercial. Las citas remiten a fuentes oficiales y artículos concretos; «texto verificado» acredita obtención/lectura, no certifica que no exista ninguna reforma o decisión posterior. Para Senado se obtuvo HTTP oficial después de fallos HTTPS, sin desactivar validación TLS. Esta limitación de transporte se conserva y exige cotejo de integridad antes de publicación. URLs primarias y SHA de bytes descargados en la tabla; `../SOURCE_RECEIPTS*.json` conserva éxitos y fallos. `../PDF_EXTRACTION_RECEIPTS.json` registra extracción con pypdf; primer intento pdftotext ausente se conserva como FAIL de herramienta, no fallo de ley. No hubo cambios globales ni instalaciones.

### M02 — Fuentes verificadas y límites
| ID | Norma | URL primaria / recibo | Artículos | Ámbito | Vigencia / límite de verificación | SHA256 fuente |
|---|---|---|---|---|---|---|
| L01 | Ley 1480 de 2011 | [S13](http://www.secretariasenado.gov.co/senado/basedoc/ley_1480_2011.html) | 2–5,7–16,23–30,42–43 | consumidor/destinatario final, garantía, información y cláusulas abusivas | Texto consultado; entrada general seis meses tras promulgación art84; notas de compilación al15oct2026 | `02a4616e56865865cf18a8f883ca180700ceaec190d68201f70277134d1fc92e` |
| L02 | Ley 1480 de 2011, segunda página | [S14](http://www.secretariasenado.gov.co/senado/basedoc/ley_1480_2011_pr001.html) | 47,50,51,58(5) | retracto, ecommerce, reversión y reclamación directa; usar texto modificado por Ley2439 | Texto consolidado consultado al19oct2026; anotaciones visibles y ley modificatoria separadas | `d2d01d670a58438b28b4b507c532894e16fd0cc1c3963afb3dba1222946809f3` |
| L03 | Ley Estatutaria 1581 de 2012 | [S15](http://www.secretariasenado.gov.co/senado/basedoc/ley_1581_2012.html) | 2–18,25–26 | tratamiento de datos de personas naturales, derechos, deberes y transferencias | Texto consultado al19oct2026; no certificación exhaustiva de jurisprudencia por este autor | `c0ca6a1f75f39dd0cff79f8315f6830289a200ac4f6ec6a82b20a67f4b273948` |
| L04 | Ley 2439 de 2024 | [S11](http://www.secretariasenado.gov.co/senado/basedoc/ley_2439_2024.html) | 2–5,9 | 15calendario retracto; reformaart50b/g/h; preferencia medio devolución; otras reformas no habilitan crédito | DO52975 19dic2024/art9; b/g/h transición4meses desde publicación; J01 condiciona alcance art3 | `144d356e960a68b4366d32ae083b6ecb1ad63130f8acfa451b0eaf445d1a1c18` |
| L05 | Ley 527 de 1999 | [S16](http://www.secretariasenado.gov.co/senado/basedoc/ley_0527_1999.html) | 5–15,28,46 | mensajes de datos, integridad, prueba, conservación y firma conforme acto | Texto consultado al19oct2026; no equivalencia universal de checksum a firma | `bf304cec85c5a0500fedc8ecc25e3568a2fc098d0b02e25f527653d613f0f02d` |
| L06 | Decreto 587 de 2016 / D1074 capítulo51 | [S25](https://sedeelectronica.sic.gov.co/sites/default/files/normatividad/Decreto_587_2016.pdf) | 2.2.2.51.1–14;art2 | reversión electrónica, proveedor/emisor enColombia,5hábiles queja/aviso y15hábiles ejecución | Texto decreto obtenido; vigencia6meses tras publicación11abr2016; búsqueda2025/2026 no certifica ausencia de reforma; B12 bloquea publicación | `20da10c1391bdac114d5147165007f9cd40354903c4f3e3dee5ece70e1ad7779` |
| L07 | Ley 962 de 2005 | [S19](http://www.secretariasenado.gov.co/senado/basedoc/ley_0962_2005.html) | 28 | 10años libros/papeles desde último asiento/documento/comprobante con reproducción exacta; no retención universalPII | Texto consultado al19oct2026; retenciones especiales tributarias por B10 | `63eede773562ceca491b979717e528a9b551232791c1a970ae396eb728650a99` |
| L08 | Ley 2300 de 2023 | [S20](http://www.secretariasenado.gov.co/senado/basedoc/ley_2300_2023.html) | 2–5,8,10 | contactos comerciales/cobranza según supuesto, canales y privacidad; no habilita campañas | Texto consultado, art10 tresmeses desde promulgación; RNE/implementación actual por validar antes de campañas | `2331f603f8f6f389af07f666752e8dce8ad241a07a73e558b469bfee8cdceb2a` |
| R01 | Decreto1074/2015 capítulo25, texto oficial MinCIT | [S27](https://www.mincit.gov.co/ministerio/normograma-sig/procesos-misionales/desarrollo-empresarial/decreto/decreto-1074-de-2015-2.aspx) | 2.2.2.25.1.3; .2.1–.2.9; .3.1–.3.5; .4.1–.4.4; .5.1–.5.2; .6.1–.6.2 | definiciones, autorización, conservación, políticas/aviso, derechos, transmisión y responsabilidad demostrada | PDF original2015 verificado; NO es consolidación2026. Secc7 añadidaD255/2022 identificada en fuenteoficial indexada; texto consolidado posterior no obtenido. B12 revisiónactual pendiente | `6008aec6ead5dcd4252425545e0e43b521d44a3a56cd04e2e249aa3ec2881c12` |
| R02 | Decreto1074/2015 capítulo32 (compilaD735/2013) | [S27](https://www.mincit.gov.co/ministerio/normograma-sig/procesos-misionales/desarrollo-empresarial/decreto/decreto-1074-de-2015-2.aspx) | 2.2.2.32.2.1–.2.9; .3.2,.3.5; .5.1,.6.1–.6.2 | solicitud/decisión/soluciones/transporte y plazos muebles ordinarios; verificar reglasSIC especiales por categoría | PDF2015 verificado. D735art8→.32.2.7,art9→.32.2.8,art10→.32.2.9; no norma de inmuebles usada como regla de herramientas; actualizaciónB12 pendiente | `6008aec6ead5dcd4252425545e0e43b521d44a3a56cd04e2e249aa3ec2881c12` |
| R03 | Decreto1074/2015 capítulo47 (compilaD2364/2012) | [S27](https://www.mincit.gov.co/ministerio/normograma-sig/procesos-misionales/desarrollo-empresarial/decreto/decreto-1074-de-2015-2.aspx) | 2.2.2.47.1–.47.8 | firma electrónica, identificación/intención, confiabilidad y acuerdos; no firma ya ejecutada | PDF2015 verificado; aplicabilidad y régimen actual al acto requieren B12/B13 | `6008aec6ead5dcd4252425545e0e43b521d44a3a56cd04e2e249aa3ec2881c12` |
| J01 | Sentencia C-192/26, Comunicado22/24jun2026 | [S28](http://www.secretariasenado.gov.co/senado/basedoc/c-192_2026.html) | apartado2Decisión; art3Ley2439 /47Ley1480 | 15calendario reembolso retracto uniforme a todas modalidades art47; no crea retracto universal | VERIFIED comunicado alojadooficial; sentenciaíntegra NOT_VERIFIED. No se amplían excepciones ni efectos temporales inferidos | `81f84e493bb3833120ec3a82bb347a08eef7e5576eec801d69f2398ab0052193` |
| X01 | Proyecto MinCIT23sep2025 reversión | [S07](https://www.mincit.gov.co/normatividad/proyectos-de-normatividad/proyectos-de-decreto-2025/23-09-2025-pd-reversion-de-pagos.aspx) | proyecto sin número ni firma de expedición | solo alerta de seguimiento, NO fundamento obligatorio ni adopción de nuevosplazos | VERIFIED proyecto; promulgaciónposterior NOT_VERIFIED / B12 | `45b61ca1daea3c38160e25eac4d28f2c0f33f706ef1f78432dbe044bfe8f2df1` |

### M03 — Reformas y divergencias que cambian la redacción
Ley2439/2024 modifica devolución por retracto y literales50(b,g,h): información técnica suficiente, PQR con radicado/fecha/hora/seguimiento y entrega dentro del plazo aceptado; si no se pacta, 30calendario desde día siguiente al pedido; incumplimiento/indisponibilidad permite terminar con devolución íntegra máxima15calendario. Art5 requiere respetar preferencia del medio de devolución; se armoniza con regla específica de retracto y se deja validación operacional B05/B12. No se adopta el plazo anterior de30días para reembolso por retracto ni para terminaciónart50(h).

J01 informa C-192/26/Comunicado22: los15calendario del retracto aplican a todas las modalidadesart47, no solo ecommerce; no significa que toda compra tenga retracto o que desaparezcan excepciones. Texto íntegro sentencia y alcance temporal no acreditados por el autor: B12 pendiente. La misma compilación reporta C-494/25 inhibición sobre «firma electrónica» art7Ley2439; no se infiere aprobación material de servicios de firma ni se ofrece financiación del comercio.

X01 es proyecto reversiónMinCIT23sep2025, sin constancia de promulgación. No cambia por sí mismo L06 ni se usa como regla obligatoria. D1074PDF2015 es texto oficial original; no se presenta como consolidación a2026. Fuente indexada FunciónPúblicaD1074 informa actualización18sep2025 y D255/2022 normas corporativas vinculantes; no se obtuvo consolidado por problemasTLS/502 y no se certifica texto2026. B12 exige contraste de cambios del capítulo25, capítulo32, capítulo47, capítulo51, instruccionesSIC y categoría real antes de activar.

### M04 — Plazos y hitos aplicables
| Obligación | Plazo y disparador | Fuente / artículo | Cláusulas consumidor |
|---|---|---|---|
| Ejercer retracto | 5días hábiles desde entrega del bien / celebración servicio, si procede | L02art47 | P05-06,Q10-02,S14-02 |
| Devolver dinero retracto | Máximo15calendario desde ejercicio y obligaciones legales cumplidas; no aprobación interna extra | L04art3; J01decisión2 | P05-08,Q10-02,S14-02 |
| Entrega no pactada | Máximo30calendario desde día siguiente al pedido | L04art4 /L02art50(h) | P03-07,P04-04 |
| Reembolso por terminación50(h) | Máximo15calendario; conservar fecha de terminación/solicitud y ejecución | L04art4 /L02art50(h) | P03-07,P04-04,P05-11 |
| Reclamación directa | Respuesta15hábiles desde recibo según supuesto y requisitos | L02art58(5)(c); R02.32.2.1–2 | P05-05,Q10-02 |
| Reversión: queja y aviso emisor | Ambos dentro5hábiles desde causal legal | L02art51;L06.51.4,.51.6 | P05-09,Q10-02 |
| Reversión: hacer efectiva | 15hábiles desde solicitud al emisor | L06.51.8; reforma posteriorB12 pendiente | P05-10,Q10-02 |
| Garantía reparación muebles |30hábiles desde día siguiente entrega para reparación;60con préstamo y salvo normaSIC especial | R02.32.2.7 | P05-05,Q10-02 |
| Garantía reposición muebles |10hábiles desde puesta a disposición; salvo régimen especial | R02.32.2.8 | P05-05,Q10-02 |
| Garantía devolución muebles |15hábiles desde puesta a disposición libregravámenes; supuesto legal y reglas de información bancaria | R02.32.2.9 | P05-05,Q10-02 |
| Consultas datos |10hábiles desde recepción;extensión motivada≤5hábiles tras vencimiento |L03art14 | P02-07,D09-02,S14-04 |
| Reclamos datos |15hábiles desde día siguiente recibo;extensión motivada≤8hábiles tras vencimiento |L03art15(3) | P02-07,D09-04,S14-04 |
| Subsanación reclamo |Requerir dentro5días siguientes;desistimiento2meses tras requerimiento sin subsanar |L03art15(1) | D09-03 |
| Traslado / anotación reclamo |Traslado≤2hábiles / leyenda≤2hábiles desde reclamo completo |L03art15(1–2) | D09-03 |
| Acuse de pedido |A más tardar día calendario siguiente al pedido |L02art50(d) | P03-05 |
| Documentos comercio |10años desde último asiento/documento/comprobante; no todaPII |L07art28;L02art50(e) | R12-02 |

### M05 — Correspondencia por cláusula
La tabla siguiente remite a fuentes cuya URL/artículo/consulta/alcance están en M02 y, para plazos, M04. Las cláusulas de diseño/operación se identifican como propuestas cuando no son mandato literal. B01–B13 son decisiones; E01–E12 evidencia estática; no son fuentes de ley. Un campo `NOT_VERIFIED` nunca se convierte en VERIFIED por la presencia de una cita.

| clauseId | Documento | Fuente(s) | Dueño | Estado |
|---|---|---|---|---|
| P01-01 | 01_PRIVACY_POLICY.md | L01, L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P01-02 | 01_PRIVACY_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P01-03 | 01_PRIVACY_POLICY.md | L01, L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P01-04 | 01_PRIVACY_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P01-05 | 01_PRIVACY_POLICY.md | L03, L08, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P01-06 | 01_PRIVACY_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P01-07 | 01_PRIVACY_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P01-08 | 01_PRIVACY_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P01-09 | 01_PRIVACY_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P01-10 | 01_PRIVACY_POLICY.md | L03, L07, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P01-11 | 01_PRIVACY_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P02-01 | 02_PERSONAL_DATA_PROCESSING_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P02-02 | 02_PERSONAL_DATA_PROCESSING_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P02-03 | 02_PERSONAL_DATA_PROCESSING_POLICY.md | L01, L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P02-04 | 02_PERSONAL_DATA_PROCESSING_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P02-05 | 02_PERSONAL_DATA_PROCESSING_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P02-06 | 02_PERSONAL_DATA_PROCESSING_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P02-07 | 02_PERSONAL_DATA_PROCESSING_POLICY.md | L03 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P02-08 | 02_PERSONAL_DATA_PROCESSING_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P02-09 | 02_PERSONAL_DATA_PROCESSING_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P03-01 | 03_ECOMMERCE_TERMS_AND_CONDITIONS.md | L01, L02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P03-02 | 03_ECOMMERCE_TERMS_AND_CONDITIONS.md | L01, L04 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P03-03 | 03_ECOMMERCE_TERMS_AND_CONDITIONS.md | L01, L02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P03-04 | 03_ECOMMERCE_TERMS_AND_CONDITIONS.md | L01, L02, L05 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P03-05 | 03_ECOMMERCE_TERMS_AND_CONDITIONS.md | L02, L05 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P03-06 | 03_ECOMMERCE_TERMS_AND_CONDITIONS.md | L01, L02, L06 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P03-07 | 03_ECOMMERCE_TERMS_AND_CONDITIONS.md | L02, L04 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P03-08 | 03_ECOMMERCE_TERMS_AND_CONDITIONS.md | L01, L02, R02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P03-09 | 03_ECOMMERCE_TERMS_AND_CONDITIONS.md | L01, L02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P03-10 | 03_ECOMMERCE_TERMS_AND_CONDITIONS.md | L02, L04, L05 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P04-01 | 04_SHIPPING_AND_DELIVERY_POLICY.md | L01, L02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P04-02 | 04_SHIPPING_AND_DELIVERY_POLICY.md | L01, L02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P04-03 | 04_SHIPPING_AND_DELIVERY_POLICY.md | L01, L02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P04-04 | 04_SHIPPING_AND_DELIVERY_POLICY.md | L02, L04 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P04-05 | 04_SHIPPING_AND_DELIVERY_POLICY.md | L01, L02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P04-06 | 04_SHIPPING_AND_DELIVERY_POLICY.md | L01, L02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P04-07 | 04_SHIPPING_AND_DELIVERY_POLICY.md | L01, L02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P04-08 | 04_SHIPPING_AND_DELIVERY_POLICY.md | L01, L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P04-09 | 04_SHIPPING_AND_DELIVERY_POLICY.md | L01, L02, R02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P05-01 | 05_RETURNS_WITHDRAWAL_WARRANTIES.md | L01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P05-02 | 05_RETURNS_WITHDRAWAL_WARRANTIES.md | L01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P05-03 | 05_RETURNS_WITHDRAWAL_WARRANTIES.md | L01, R02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P05-04 | 05_RETURNS_WITHDRAWAL_WARRANTIES.md | L01, R02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P05-05 | 05_RETURNS_WITHDRAWAL_WARRANTIES.md | L01, L02, R02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P05-06 | 05_RETURNS_WITHDRAWAL_WARRANTIES.md | L02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P05-07 | 05_RETURNS_WITHDRAWAL_WARRANTIES.md | L02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P05-08 | 05_RETURNS_WITHDRAWAL_WARRANTIES.md | J01, L04 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P05-09 | 05_RETURNS_WITHDRAWAL_WARRANTIES.md | L02, L06 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P05-10 | 05_RETURNS_WITHDRAWAL_WARRANTIES.md | L02, L06 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| P05-11 | 05_RETURNS_WITHDRAWAL_WARRANTIES.md | L02, L04 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| N06-01 | 06_PRIVACY_NOTICE.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| N06-02 | 06_PRIVACY_NOTICE.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| N06-03 | 06_PRIVACY_NOTICE.md | R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| C07-01 | 07_COOKIES_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| C07-02 | 07_COOKIES_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| C07-03 | 07_COOKIES_POLICY.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| C07-04 | 07_COOKIES_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| C07-05 | 07_COOKIES_POLICY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| A08-01 | 08_CUSTOMER_CONSENT_TEXTS.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| A08-02 | 08_CUSTOMER_CONSENT_TEXTS.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| A08-03 | 08_CUSTOMER_CONSENT_TEXTS.md | L02, L05 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| A08-04 | 08_CUSTOMER_CONSENT_TEXTS.md | L02, L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| A08-05 | 08_CUSTOMER_CONSENT_TEXTS.md | L03, L08 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| A08-06 | 08_CUSTOMER_CONSENT_TEXTS.md | L03, L05, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| A08-07 | 08_CUSTOMER_CONSENT_TEXTS.md | L03, L05, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| D09-01 | 09_DATA_SUBJECT_REQUEST_PROCEDURE.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| D09-02 | 09_DATA_SUBJECT_REQUEST_PROCEDURE.md | L03 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| D09-03 | 09_DATA_SUBJECT_REQUEST_PROCEDURE.md | L03 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| D09-04 | 09_DATA_SUBJECT_REQUEST_PROCEDURE.md | L03 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| D09-05 | 09_DATA_SUBJECT_REQUEST_PROCEDURE.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| D09-06 | 09_DATA_SUBJECT_REQUEST_PROCEDURE.md | L03 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| Q10-01 | 10_CONSUMER_CLAIMS_AND_REFUNDS.md | L02, L04, R02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| Q10-02 | 10_CONSUMER_CLAIMS_AND_REFUNDS.md | J01, L01, L02, L04, L06, R02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| Q10-03 | 10_CONSUMER_CLAIMS_AND_REFUNDS.md | L01, L02, L03 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| Q10-04 | 10_CONSUMER_CLAIMS_AND_REFUNDS.md | L02, L04, L06 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| Q10-05 | 10_CONSUMER_CLAIMS_AND_REFUNDS.md | L01, R02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| Q10-06 | 10_CONSUMER_CLAIMS_AND_REFUNDS.md | L02, L03 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| F11-01 | 11_PROCESSORS_AND_DATA_FLOWS.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| F11-02 | 11_PROCESSORS_AND_DATA_FLOWS.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| F11-03 | 11_PROCESSORS_AND_DATA_FLOWS.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| F11-04 | 11_PROCESSORS_AND_DATA_FLOWS.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| R12-01 | 12_DATA_RETENTION_SCHEDULE.md | L03, L07, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| R12-02 | 12_DATA_RETENTION_SCHEDULE.md | L02, L03, L07, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| R12-03 | 12_DATA_RETENTION_SCHEDULE.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| R12-04 | 12_DATA_RETENTION_SCHEDULE.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| S14-01 | 14_CUSTOMER_RIGHTS_SUMMARY.md | L01, L02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| S14-02 | 14_CUSTOMER_RIGHTS_SUMMARY.md | J01, L01, L02, L04 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| S14-03 | 14_CUSTOMER_RIGHTS_SUMMARY.md | L02, L04, L06 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| S14-04 | 14_CUSTOMER_RIGHTS_SUMMARY.md | L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| S14-05 | 14_CUSTOMER_RIGHTS_SUMMARY.md | L02, L03 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| BIZ-01 | LEGAL_BUSINESS_DECISIONS.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| BIZ-02 | LEGAL_BUSINESS_DECISIONS.md | L01, L02, L03 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| BIZ-03 | LEGAL_BUSINESS_DECISIONS.md | L01, L02, L03 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| W01 | LEGAL_APPROVAL_AND_SIGNATURE_WORKFLOW.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| W02 | LEGAL_APPROVAL_AND_SIGNATURE_WORKFLOW.md | L01, L02, L03, L04, R01, R02 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| W03 | LEGAL_APPROVAL_AND_SIGNATURE_WORKFLOW.md | L05 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| W04 | LEGAL_APPROVAL_AND_SIGNATURE_WORKFLOW.md | L05, R03 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| W05 | LEGAL_APPROVAL_AND_SIGNATURE_WORKFLOW.md | L02, L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| W06 | LEGAL_APPROVAL_AND_SIGNATURE_WORKFLOW.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| W07 | LEGAL_APPROVAL_AND_SIGNATURE_WORKFLOW.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| H01 | LEGAL_PUBLICATION_HANDOFF.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| H02 | LEGAL_PUBLICATION_HANDOFF.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| H03 | LEGAL_PUBLICATION_HANDOFF.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| H04 | LEGAL_PUBLICATION_HANDOFF.md | L02, L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| H05 | LEGAL_PUBLICATION_HANDOFF.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| H06 | LEGAL_PUBLICATION_HANDOFF.md | L03, L05 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| A13-01 | 13_CHECKOUT_AND_COOKIES_CONSENT_AUDIT.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| A13-02 | 13_CHECKOUT_AND_COOKIES_CONSENT_AUDIT.md | L01, L02, L03, L04, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| A13-03 | 13_CHECKOUT_AND_COOKIES_CONSENT_AUDIT.md | L01, L02, L03, R01 | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| A13-04 | 13_CHECKOUT_AND_COOKIES_CONSENT_AUDIT.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| G01 | LEGAL_TECHNICAL_GAPS.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| G02 | LEGAL_TECHNICAL_GAPS.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| G03 | LEGAL_TECHNICAL_GAPS.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| G04 | LEGAL_TECHNICAL_GAPS.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| G05 | LEGAL_TECHNICAL_GAPS.md | Gobierno / diseño propuesto, no regla legal autónoma | Dirección / área de privacidad y servicio al consumidor | DRAFT / aprobación pendiente |
| M01 | LEGAL_SOURCE_AND_COMPLIANCE_MATRIX.md | Gobierno / evidencia documental | Privacidad / asesor jurídico | DRAFT / aprobación pendiente |
| M02 | LEGAL_SOURCE_AND_COMPLIANCE_MATRIX.md | L01, L02, L03, L04, L05, L06, L07, L08, R01, R02, R03, J01, X01 | Privacidad / asesor jurídico | DRAFT / aprobación pendiente |
| M03 | LEGAL_SOURCE_AND_COMPLIANCE_MATRIX.md | L01, L02, L03, L04, L05, L06, L07, L08, R01, R02, R03, J01, X01 | Privacidad / asesor jurídico | DRAFT / aprobación pendiente |
| M04 | LEGAL_SOURCE_AND_COMPLIANCE_MATRIX.md | L01, L02, L03, L04, L05, L06, L07, L08, R01, R02, R03, J01, X01 | Privacidad / asesor jurídico | DRAFT / aprobación pendiente |
| M05 | LEGAL_SOURCE_AND_COMPLIANCE_MATRIX.md | Gobierno / evidencia documental | Privacidad / asesor jurídico | DRAFT / aprobación pendiente |
| M06 | LEGAL_SOURCE_AND_COMPLIANCE_MATRIX.md | L01, L02, L03, L04, L05, L06, L07, L08, R01, R02, R03, J01, X01 | Privacidad / asesor jurídico | DRAFT / aprobación pendiente |
| Z01 | FINAL_HANDOFF.md | Gobierno / evidencia documental | LEGAL-DOCS-01 / ROOT | DRAFT / revisión independiente pendiente |
| Z02 | FINAL_HANDOFF.md | Gobierno / evidencia documental | LEGAL-DOCS-01 / ROOT | DRAFT / revisión independiente pendiente |
| Z03 | FINAL_HANDOFF.md | L01, L02, L03, L04, L06, J01, R01, R02 | LEGAL-DOCS-01 / ROOT | DRAFT / revisión independiente pendiente |
| Z04 | FINAL_HANDOFF.md | L01, L02, L03, L04, L06, J01, R01, R02 | LEGAL-DOCS-01 / ROOT | DRAFT / revisión independiente pendiente |
| Z05 | FINAL_HANDOFF.md | L01, L02, L03, L04, L06, J01, R01, R02 | LEGAL-DOCS-01 / ROOT | DRAFT / revisión independiente pendiente |
| Z06 | FINAL_HANDOFF.md | Gobierno / evidencia documental | LEGAL-DOCS-01 / ROOT | DRAFT / revisión independiente pendiente |
| Z07 | FINAL_HANDOFF.md | Gobierno / evidencia documental | LEGAL-DOCS-01 / ROOT | DRAFT / revisión independiente pendiente |

### M06 — Verificación pendiente que no se oculta
No se acredita ausencia exhaustiva de reformas 2025/2026, sentencia íntegraC-192/26, adecuación de países/SIC actual, aplicabilidad de RNBD al operador aún no identificado, requisitos específicos de factura/retención tributaria ni normativa técnica por SKU. Son decisiones y diligencias B10/B12 con dueño, no frases vacías que sustituyan políticas. Todos los plazos propuestos no legales de R12 conservan etiqueta de propuesta. Los textos completos están preparados para que un asesor pueda revisar cláusulas concretas ahora. [L01–L08,R01–R03,J01,X01]
