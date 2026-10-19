"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getLegalPage } from "@/content/legal-pages";
import { STOREFRONT_PUBLIC_ROUTES } from "@/lib/generated/storefront-route-registry";
import { contentRequest, ContentRequestError } from "./api";
import {
  editable,
  legalDetailSchema,
  legalDocuments,
  legalListSchema,
  legalRevisionSchema,
  statusLabel,
  type LegalDetail,
  type LegalRevision,
  type LegalRow,
  type Step,
} from "./contracts";
import { WorkflowControls } from "./WorkflowControls";

const fieldClass =
  "focus-ring mt-1 block w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-black p-3";
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function sectionsOf(
  value: unknown,
): Array<{ title: string; body: string }> | null {
  const sections = record(value).sections;
  return Array.isArray(sections) &&
    sections.every(
      (section) =>
        section &&
        typeof section === "object" &&
        typeof section.title === "string" &&
        typeof section.body === "string",
    )
    ? sections
    : null;
}
export function LegalWorkspace({
  initial,
  permissions,
}: {
  initial: LegalRow[];
  permissions: string[];
}) {
  const [rows, setRows] = useState(initial);
  const [detail, setDetail] = useState<LegalDetail | null>(null);
  const [revision, setRevision] = useState<LegalRevision | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  const [restore, setRestore] = useState(false);
  const generation = useRef(0);
  const canWrite = permissions.includes("legal.write");
  const canEdit = canWrite && revision !== null && editable(revision.status);
  const dirty = revision !== null && JSON.stringify(revision) !== saved;
  function select(value: LegalRevision) {
    setRevision(value);
    setSaved(JSON.stringify(value));
    setPreview(false);
    setRestore(false);
  }
  async function load(pageKey: string, id?: string) {
    const next = await contentRequest(
      `legal/${encodeURIComponent(pageKey)}`,
      legalDetailSchema,
    );
    setDetail(next);
    select(next.history.find((row) => row.id === id) ?? next.draft);
  }
  async function open(pageKey: string) {
    const current = ++generation.current;
    setBusy(true);
    setError(null);
    setNotice("");
    setDetail(null);
    setRevision(null);
    try {
      const next = await contentRequest(
        `legal/${encodeURIComponent(pageKey)}`,
        legalDetailSchema,
      );
      if (generation.current === current) {
        setDetail(next);
        select(next.draft);
      }
    } catch (failure) {
      if (generation.current === current)
        setError(
          failure instanceof Error
            ? failure
            : new Error("No se pudo cargar el documento."),
        );
    } finally {
      if (generation.current === current) setBusy(false);
    }
  }
  async function mutate(
    operation: () => Promise<LegalRevision>,
    message: string,
  ) {
    setBusy(true);
    setError(null);
    setNotice("");
    try {
      const result = await operation();
      await load(result.pageKey, result.id);
      const list = await contentRequest("legal", legalListSchema);
      setRows(list.data);
      setNotice(message);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure
          : new Error("No se pudo guardar el documento."),
      );
    } finally {
      setBusy(false);
    }
  }
  async function step(step: Step) {
    if (!revision) return;
    await mutate(
      () =>
        contentRequest(
          `legal/${encodeURIComponent(revision.id)}/${step}`,
          legalRevisionSchema,
          "POST",
        ),
      "Estado guardado. La versión se volvió a consultar en el servicio.",
    );
  }
  function patch(change: Partial<LegalRevision>) {
    if (revision) {
      setRevision({ ...revision, ...change });
      setNotice("");
      setPreview(false);
    }
  }
  const content = record(revision?.content);
  const sections =
    sectionsOf(revision?.content) ??
    (revision?.content &&
    typeof revision.content === "object" &&
    !Array.isArray(revision.content) &&
    !("sections" in content) &&
    !("text" in content)
      ? []
      : null);
  const pendingData =
    Array.isArray(content.placeholders) &&
    content.placeholders.every((value) => typeof value === "string")
      ? (content.placeholders as string[])
      : null;
  const publicDocument = revision ? getLegalPage(revision.pageKey) : null;
  const publicHref =
    publicDocument &&
    (STOREFRONT_PUBLIC_ROUTES as readonly string[]).includes(
      `/${publicDocument.slug}`,
    )
      ? `/${publicDocument.slug}`
      : null;
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(220px,0.7fr)_minmax(0,2fr)]">
      <aside className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
        <h2 className="font-semibold">Documentos</h2>
        {rows.length === 0 ? (
          <p>No hay versiones legales registradas.</p>
        ) : (
          legalDocuments(rows).map(({ pageKey, title }) => (
            <Button
              key={pageKey}
              type="button"
              className="w-full h-auto min-h-11 text-left justify-start break-words"
              variant="outline"
              disabled={busy || dirty}
              onClick={() => void open(pageKey)}
            >
              {title}
            </Button>
          ))
        )}
        {dirty ? (
          <p className="text-sm text-amber-200">
            Guarde o descarte para cambiar de documento.
          </p>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          disabled={busy || dirty}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              setRows((await contentRequest("legal", legalListSchema)).data);
              if (revision) await load(revision.pageKey, revision.id);
            } catch (failure) {
              setError(
                failure instanceof Error
                  ? failure
                  : new Error("No se pudo actualizar."),
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Actualizar desde el servicio
        </Button>
      </aside>
      <section
        className="min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6 space-y-5"
        aria-busy={busy}
      >
        {error ? (
          <div
            role="alert"
            data-state={
              error instanceof ContentRequestError
                ? error.kind
                : "validation_error"
            }
            className="rounded-lg border border-red-400/30 p-3"
          >
            {error.message}
            {error instanceof ContentRequestError && error.status === 401 ? (
              <a className="block underline" href="/admin/login">
                Iniciar sesión
              </a>
            ) : null}
          </div>
        ) : null}
        {notice ? (
          <p role="status" className="text-green-200">
            {notice}
          </p>
        ) : null}
        {busy ? <p role="status">Consultando contenido…</p> : null}
        {!revision || !detail ? (
          <p>
            Seleccione un documento para consultar sus versiones y revisión.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold break-words">
                {revision.title}
              </h2>
              <span>
                {statusLabel[revision.status]} · v{revision.version}
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Publicada:{" "}
              {detail.published
                ? `v${detail.published.version} · ${detail.published.publishedAt ?? ""}`
                : "Ninguna"}
              . La tienda consulta la versión publicada. Sin publicación,
              muestra el documento base identificado como pendiente de revisión.
            </p>
            {publicHref ? (
              <a
                href={publicHref}
                className="focus-ring inline-block underline"
              >
                Ver página pública del documento
              </a>
            ) : null}
            <label className="block">
              Versión consultada
              <select
                className={fieldClass}
                value={revision.id}
                disabled={busy || dirty}
                onChange={(event) => {
                  const selected = detail.history.find(
                    (row) => row.id === event.target.value,
                  );
                  if (selected) select(selected);
                }}
              >
                {detail.history.map((row) => (
                  <option key={row.id} value={row.id}>
                    v{row.version} · {statusLabel[row.status]}
                  </option>
                ))}
              </select>
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (canEdit)
                  void mutate(
                    () =>
                      contentRequest(
                        `legal/${encodeURIComponent(revision.id)}`,
                        legalRevisionSchema,
                        "PATCH",
                        {
                          title: revision.title,
                          slug: revision.slug,
                          content: revision.content,
                          checklist: revision.checklist ?? {},
                        },
                      ),
                    "Borrador guardado y consultado nuevamente.",
                  );
              }}
              className="space-y-4"
            >
              <fieldset disabled={!canEdit || busy} className="space-y-4">
                <label className="block">
                  Título
                  <input
                    className={fieldClass}
                    required
                    value={revision.title}
                    onChange={(event) => patch({ title: event.target.value })}
                  />
                </label>
                <label className="block">
                  Slug
                  <input
                    className={fieldClass}
                    required
                    value={revision.slug}
                    onChange={(event) => patch({ slug: event.target.value })}
                  />
                </label>
                {typeof content.notice === "string" ? (
                  <label className="block">
                    Aviso del documento
                    <textarea
                      className={fieldClass}
                      rows={3}
                      value={content.notice}
                      onChange={(event) =>
                        patch({
                          content: {
                            ...content,
                            notice: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ) : null}
                {pendingData !== null ? (
                  <div className="space-y-3 rounded-lg border border-amber-300/30 p-3">
                    <h3 className="font-semibold">Datos del documento</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Sustituya cada dato pendiente por la información
                      verificada. Cada campo conserva su valor hasta que lo
                      edite y guarde. Incluya también los datos necesarios en el
                      texto del documento. Guardar no aprueba ni publica; los
                      datos pendientes siguen sujetos a la validación del
                      servicio.
                    </p>
                    {pendingData.map((value, index) => (
                      <label key={index} className="block">
                        Dato del documento {index + 1}
                        <input
                          className={fieldClass}
                          required
                          value={value}
                          onChange={(event) =>
                            patch({
                              content: {
                                ...content,
                                placeholders: pendingData.map(
                                  (item, position) =>
                                    position === index
                                      ? event.target.value
                                      : item,
                                ),
                              },
                            })
                          }
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
                {sections !== null ? (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Secciones del documento</h3>
                    {sections.map((section, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-white/10 p-3 space-y-3"
                      >
                        <label className="block">
                          Título de sección {index + 1}
                          <input
                            className={fieldClass}
                            value={section.title}
                            onChange={(event) =>
                              patch({
                                content: {
                                  ...record(revision.content),
                                  sections: sections.map((item, pos) =>
                                    pos === index
                                      ? { ...item, title: event.target.value }
                                      : item,
                                  ),
                                },
                              })
                            }
                          />
                        </label>
                        <label className="block">
                          Texto de sección {index + 1}
                          <textarea
                            className={fieldClass}
                            rows={5}
                            value={section.body}
                            onChange={(event) =>
                              patch({
                                content: {
                                  ...record(revision.content),
                                  sections: sections.map((item, pos) =>
                                    pos === index
                                      ? { ...item, body: event.target.value }
                                      : item,
                                  ),
                                },
                              })
                            }
                          />
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() =>
                            patch({
                              content: {
                                ...record(revision.content),
                                sections: sections.filter(
                                  (_, pos) => pos !== index,
                                ),
                              },
                            })
                          }
                        >
                          Quitar sección {index + 1}
                        </Button>
                      </div>
                    ))}
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          patch({
                            content: {
                              ...record(revision.content),
                              sections: [...sections, { title: "", body: "" }],
                            },
                          })
                        }
                      >
                        Añadir sección
                      </Button>
                    ) : null}
                  </div>
                ) : typeof record(revision.content).text === "string" ? (
                  <label className="block">
                    Texto del documento
                    <textarea
                      className={fieldClass}
                      rows={12}
                      value={String(record(revision.content).text)}
                      onChange={(event) =>
                        patch({
                          content: {
                            ...record(revision.content),
                            text: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ) : (
                  <p>
                    Este formato requiere un editor especializado. Se conserva
                    íntegro al guardar título y checklist.
                  </p>
                )}
                <div className="space-y-2">
                  <h3 className="font-semibold">Checklist de revisión</h3>
                  {detail.requirements.length === 0 ? (
                    <p>No hay requisitos registrados para esta página.</p>
                  ) : (
                    detail.requirements.map((requirement) => (
                      <label
                        key={requirement}
                        className="flex items-start gap-3"
                      >
                        <input
                          type="checkbox"
                          checked={revision.checklist?.[requirement] === true}
                          onChange={(event) =>
                            patch({
                              checklist: {
                                ...(revision.checklist ?? {}),
                                [requirement]: event.target.checked,
                              },
                            })
                          }
                        />
                        <span>{requirement}</span>
                      </label>
                    ))
                  )}
                </div>
              </fieldset>
              {canEdit ? (
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={busy || !dirty}>
                    Guardar borrador
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !dirty}
                    onClick={() => {
                      const persisted = detail.history.find(
                        (row) => row.id === revision.id,
                      );
                      if (persisted) select(persisted);
                    }}
                  >
                    Descartar cambios
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  {canWrite
                    ? "Esta versión es inmutable. Cree un borrador para hacer cambios."
                    : "Acceso de lectura. La edición requiere legal.write."}
                </p>
              )}
            </form>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy || dirty}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await load(revision.pageKey, revision.id);
                    setPreview(true);
                  } catch (failure) {
                    setError(
                      failure instanceof Error
                        ? failure
                        : new Error("No se pudo previsualizar."),
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Previsualizar versión guardada
              </Button>
              {canWrite ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || dirty}
                  onClick={() => setRestore(true)}
                >
                  Crear borrador desde esta versión
                </Button>
              ) : null}
            </div>
            {restore && canWrite ? (
              <div
                role="group"
                aria-label="Confirmar restauración"
                className="border border-amber-300/30 rounded-lg p-4 space-y-3"
              >
                <p>
                  Crear una versión nueva con el contenido de v
                  {revision.version}. Requiere revisión, aprobación y
                  publicación; la versión publicada se conserva.
                </p>
                <Button
                  type="button"
                  disabled={busy || dirty}
                  onClick={() => {
                    if (busy || dirty || !canWrite) return;
                    void mutate(
                      () =>
                        contentRequest("legal", legalRevisionSchema, "POST", {
                          pageKey: revision.pageKey,
                          title: revision.title,
                          slug: revision.slug,
                          content: revision.content,
                          checklist: revision.checklist ?? {},
                        }),
                      "Nueva versión creada como borrador. Todavía no está publicada.",
                    );
                  }}
                >
                  Confirmar nuevo borrador
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setRestore(false)}
                >
                  Cancelar
                </Button>
              </div>
            ) : null}
            <WorkflowControls
              key={`${revision.id}/${revision.status}`}
              domain="legal"
              status={revision.status}
              version={revision.version}
              permissions={permissions}
              busy={busy}
              dirty={dirty}
              onStep={step}
            />
            {preview ? (
              <article
                aria-label="Vista previa guardada"
                className="rounded-xl border border-white/10 p-4 space-y-4"
              >
                <h3 className="text-lg font-semibold">
                  Vista previa · v{revision.version}
                </h3>
                <p className="text-sm">
                  Contenido guardado en el servicio. No es una publicación en la
                  tienda.
                </p>
                {sectionsOf(revision.content)?.map((section, index) => (
                  <section key={index}>
                    <h4 className="font-semibold">{section.title}</h4>
                    <p className="whitespace-pre-wrap break-words">
                      {section.body}
                    </p>
                  </section>
                )) ?? (
                  <pre className="whitespace-pre-wrap break-words text-sm">
                    {typeof record(revision.content).text === "string"
                      ? String(record(revision.content).text)
                      : JSON.stringify(revision.content, null, 2)}
                  </pre>
                )}
              </article>
            ) : null}
            <details>
              <summary className="focus-ring cursor-pointer">
                Trazabilidad de versión
              </summary>
              <dl className="mt-3 grid gap-2 text-sm break-all">
                <dt>Referencia</dt>
                <dd>{revision.id}</dd>
                <dt>Envío a revisión</dt>
                <dd>
                  {revision.submittedAt ?? "Pendiente"} ·{" "}
                  {revision.submittedById ?? "Sin actor registrado"}
                </dd>
                <dt>Aprobación</dt>
                <dd>
                  {revision.approvedAt ?? "Pendiente"} ·{" "}
                  {revision.approvedById ?? "Sin actor registrado"}
                </dd>
                <dt>Publicación</dt>
                <dd>
                  {revision.publishedAt ?? "Pendiente"} ·{" "}
                  {revision.publishedById ?? "Sin actor registrado"}
                </dd>
              </dl>
            </details>
          </>
        )}
      </section>
    </div>
  );
}
