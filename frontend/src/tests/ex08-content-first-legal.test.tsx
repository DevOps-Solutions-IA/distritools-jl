import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LegalWorkspace } from "@/features/admin/content/LegalWorkspace";
import { contentRequest } from "@/features/admin/content/api";
import type { LegalRevision } from "@/features/admin/content/contracts";

vi.mock("@/features/admin/content/api", async (original) => ({
  ...(await original<typeof import("@/features/admin/content/api")>()),
  contentRequest: vi.fn(),
}));
const initialContent = {
  notice:
    "Documento base pendiente de revisión legal. No publicado como versión legal final.",
  placeholders: ["[RAZÓN SOCIAL PENDIENTE]", "[NIT PENDIENTE]"],
  retained: { nested: "immutable opaque metadata" },
};
const row: LegalRevision = {
  id: "first",
  pageKey: "politica-de-privacidad",
  slug: "politica-de-privacidad",
  title: "Privacidad inicial",
  version: 1,
  status: "draft",
  publishedAt: null,
  content: initialContent,
  checklist: { responsable: false },
};
function detail(revision = row) {
  return {
    pageKey: revision.pageKey,
    history: [revision],
    draft: revision,
    requirements: ["responsable"],
    published: null,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(contentRequest).mockImplementation(
    async (path, _schema, method, body) => {
      if (path === "legal") return { data: [row] } as never;
      if (method === "PATCH")
        return {
          ...row,
          ...(body && typeof body === "object" ? body : {}),
        } as never;
      return detail() as never;
    },
  );
});
async function open(
  permissions = ["legal.read", "legal.write", "legal.review"],
) {
  render(<LegalWorkspace initial={[row]} permissions={permissions} />);
  fireEvent.click(screen.getByRole("button", { name: row.title }));
  await screen.findByLabelText("Título");
}
it("authors a first canonical default without clearing placeholders or unknown metadata implicitly", async () => {
  await open();
  expect(screen.getByLabelText("Aviso del documento")).toHaveValue(
    initialContent.notice,
  );
  expect(screen.getByLabelText("Dato del documento 1")).toHaveValue(
    initialContent.placeholders[0],
  );
  fireEvent.click(screen.getByRole("button", { name: "Añadir sección" }));
  fireEvent.change(screen.getByLabelText("Título de sección 1"), {
    target: { value: "Responsable" },
  });
  fireEvent.change(screen.getByLabelText("Texto de sección 1"), {
    target: { value: "Texto redactado por el editor autorizado." },
  });
  const saved = {
    ...row,
    content: {
      ...initialContent,
      sections: [
        {
          title: "Responsable",
          body: "Texto redactado por el editor autorizado.",
        },
      ],
    },
  };
  vi.mocked(contentRequest)
    .mockResolvedValueOnce(saved)
    .mockResolvedValueOnce(detail(saved))
    .mockResolvedValueOnce({ data: [saved] });
  fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await waitFor(() =>
    expect(contentRequest).toHaveBeenCalledWith(
      "legal/first",
      expect.anything(),
      "PATCH",
      {
        title: row.title,
        slug: row.slug,
        content: saved.content,
        checklist: { responsable: false },
      },
    ),
  );
  expect(initialContent).toEqual({
    notice: initialContent.notice,
    placeholders: ["[RAZÓN SOCIAL PENDIENTE]", "[NIT PENDIENTE]"],
    retained: { nested: "immutable opaque metadata" },
  });
  expect(
    screen.queryByRole("button", { name: "Publicar versión" }),
  ).not.toBeInTheDocument();
});
it("only replaces notice and individual pending data when explicitly edited; never changes checklist or status", async () => {
  await open();
  fireEvent.change(screen.getByLabelText("Aviso del documento"), {
    target: { value: "Aviso aprobado por el editor." },
  });
  fireEvent.change(screen.getByLabelText("Dato del documento 1"), {
    target: { value: "Empresa de prueba" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await waitFor(() =>
    expect(contentRequest).toHaveBeenCalledWith(
      "legal/first",
      expect.anything(),
      "PATCH",
      {
        title: row.title,
        slug: row.slug,
        content: {
          ...initialContent,
          notice: "Aviso aprobado por el editor.",
          placeholders: ["Empresa de prueba", "[NIT PENDIENTE]"],
        },
        checklist: { responsable: false },
      },
    ),
  );
  expect(screen.queryByText(/legal_override/i)).not.toBeInTheDocument();
});
it("read-only and approved versions cannot author or resolve pending data", async () => {
  await open(["legal.read"]);
  expect(screen.getByLabelText("Aviso del documento")).toBeDisabled();
  expect(screen.getByLabelText("Dato del documento 1")).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Añadir sección" }),
  ).not.toBeInTheDocument();
});
it("links the selected canonical page and describes actual published storefront reads", async () => {
  const shipping = {
    ...row,
    pageKey: "politica-de-envios",
    slug: "arbitrary-edited-slug",
  };
  vi.mocked(contentRequest).mockResolvedValue(detail(shipping));
  await open();
  expect(
    screen.getByRole("link", { name: "Ver página pública del documento" }),
  ).toHaveAttribute("href", "/politica-de-envios");
  expect(
    screen.queryByText(/conserva actualmente su documento estático/),
  ).not.toBeInTheDocument();
});
it("does not invent a public destination for an unmapped document", async () => {
  vi.mocked(contentRequest).mockResolvedValue(
    detail({ ...row, pageKey: "custom-unmapped" }),
  );
  await open();
  expect(
    screen.queryByRole("link", { name: "Ver página pública del documento" }),
  ).not.toBeInTheDocument();
});

it("keeps an approved first version immutable including notice and pending data", async () => {
  const approved = { ...row, status: "approved" as const };
  vi.mocked(contentRequest).mockResolvedValue(detail(approved));
  await open(["legal.read", "legal.write", "legal.publish"]);
  expect(screen.getByLabelText("Aviso del documento")).toBeDisabled();
  expect(screen.getByLabelText("Dato del documento 1")).toBeDisabled();
  expect(
    screen.queryByRole("button", { name: "Añadir sección" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Guardar borrador" }),
  ).not.toBeInTheDocument();
});
it.each([
  "politica-de-privacidad",
  "tratamiento-de-datos",
  "terminos-y-condiciones",
  "politica-de-envios",
  "cambios-devoluciones-y-garantias",
])(
  "offers actual authoring and canonical public route for %s",
  async (pageKey) => {
    vi.mocked(contentRequest).mockResolvedValue(detail({ ...row, pageKey }));
    await open();
    expect(
      screen.getByRole("button", { name: "Añadir sección" }),
    ).toBeEnabled();
    expect(screen.getByLabelText("Aviso del documento")).toBeEnabled();
    expect(
      screen.getByRole("link", { name: "Ver página pública del documento" }),
    ).toHaveAttribute("href", `/${pageKey}`);
  },
);
it("keeps populated and restored textarea labels stable independently of their stored body", async () => {
  const populated = {
    ...row,
    content: {
      ...initialContent,
      sections: [
        {
          title: "Saved section",
          body: "Stored body must not become the control label",
        },
      ],
    },
  };
  vi.mocked(contentRequest).mockResolvedValue(detail(populated));
  await open();
  expect(
    screen.getByLabelText("Aviso del documento", { exact: true }),
  ).toHaveValue(initialContent.notice);
  expect(
    screen.getByLabelText("Texto de sección 1", { exact: true }),
  ).toHaveValue(populated.content.sections[0].body);
});
