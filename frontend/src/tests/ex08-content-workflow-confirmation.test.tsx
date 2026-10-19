import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { LegalWorkspace } from "@/features/admin/content/LegalWorkspace";
import { FooterWorkspace } from "@/features/admin/content/FooterWorkspace";
import { WorkflowControls } from "@/features/admin/content/WorkflowControls";
import {
  contentRequest,
  ContentRequestError,
} from "@/features/admin/content/api";
import type {
  ContentStatus,
  FooterRevision,
  FooterSnapshot,
  LegalRevision,
} from "@/features/admin/content/contracts";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/admin/content/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/admin/content/api")>()),
  contentRequest: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(contentRequest).mockReset();
});

const legal: LegalRevision = {
  id: "legal-draft",
  pageKey: "privacy",
  slug: "privacy",
  title: "Documento guardado",
  status: "draft",
  version: 3,
  publishedAt: null,
  content: {
    sections: [{ title: "Sección guardada", body: "Texto guardado" }],
  },
  checklist: {},
};
const footer: FooterRevision = {
  id: "footer-draft",
  status: "draft",
  version: 4,
  publishedAt: null,
  groupsJson: [
    {
      title: "Grupo guardado",
      links: [{ label: "Catálogo", href: "/productos", isVisible: true }],
    },
  ],
  links: [],
};
const cases = [
  { domain: "legal", status: "draft", label: "Enviar a revisión" },
  { domain: "legal", status: "pending_legal_review", label: "Aprobar versión" },
  { domain: "footer", status: "draft", label: "Enviar a revisión" },
  {
    domain: "footer",
    status: "pending_legal_review",
    label: "Aprobar versión",
  },
] as const;

it.each(cases)(
  "$domain $status confirmation cannot discard edits made after opening",
  async ({ domain, status, label }) => {
    let storedLegal = { ...legal, status: status as ContentStatus };
    let storedFooter = { ...footer, status: status as ContentStatus };
    const detail = () => ({
      pageKey: "privacy",
      history: [storedLegal],
      requirements: [],
      published: null,
      draft: storedLegal,
    });
    const snapshot = (): FooterSnapshot => ({
      data: storedFooter,
      history: [storedFooter],
      published: null,
      requiresReview: false,
      routeAlerts: [],
    });
    vi.mocked(contentRequest).mockImplementation(
      async (path, _schema, method) => {
        if (domain === "legal") {
          if (method === "POST") {
            storedLegal = {
              ...storedLegal,
              status: status === "draft" ? "pending_legal_review" : "approved",
            };
            return storedLegal;
          }
          return path === "legal" ? { data: [storedLegal] } : detail();
        }
        if (method === "POST") {
          storedFooter = {
            ...storedFooter,
            status: status === "draft" ? "pending_legal_review" : "approved",
          };
          return storedFooter;
        }
        return snapshot();
      },
    );
    if (domain === "legal") {
      render(
        <LegalWorkspace
          initial={[storedLegal]}
          permissions={[
            "legal.read",
            "legal.write",
            "legal.review",
            "legal.approve",
          ]}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Documento guardado" }),
      );
      await screen.findByLabelText("Título");
    } else {
      render(
        <FooterWorkspace
          initial={snapshot()}
          permissions={["footer.read", "footer.write", "footer.publish"]}
        />,
      );
    }
    fireEvent.click(screen.getByRole("button", { name: label }));
    const confirm = screen.getByRole("button", {
      name: `Confirmar ${label.toLowerCase()}`,
    });
    expect(confirm).toBeEnabled();
    const before = vi.mocked(contentRequest).mock.calls.length;
    const title = screen.getByLabelText(
      domain === "legal" ? "Título" : "Título del grupo",
    );
    const body = screen.getByLabelText(
      domain === "legal" ? "Texto de sección 1" : "Texto del enlace",
    );
    fireEvent.change(title, { target: { value: "Edición pendiente" } });
    fireEvent.change(body, {
      target: { value: "Texto pendiente sin guardar" },
    });
    expect.soft(confirm).toBeDisabled();
    await act(async () => {
      fireEvent.click(confirm);
    });
    expect.soft(contentRequest).toHaveBeenCalledTimes(before);
    expect.soft(title).toHaveValue("Edición pendiente");
    expect.soft(body).toHaveValue("Texto pendiente sin guardar");
    expect(screen.queryByText(/Estado guardado/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Confirmar cambio de estado" }),
    ).toBeInTheDocument();
  },
);

it("retains cancellation and permits confirmation after edits are discarded", async () => {
  const onStep = vi.fn().mockResolvedValue(undefined);
  const props = {
    domain: "legal" as const,
    status: "draft" as const,
    version: 3,
    permissions: ["legal.review"],
    busy: false,
    onStep,
  };
  const { rerender } = render(<WorkflowControls {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Enviar a revisión" }));
  rerender(<WorkflowControls {...props} dirty />);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(onStep).not.toHaveBeenCalled();
  expect(screen.queryByRole("group")).not.toBeInTheDocument();
  rerender(<WorkflowControls {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Enviar a revisión" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar enviar a revisión" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("group")).not.toBeInTheDocument(),
  );
  expect(onStep).toHaveBeenCalledExactlyOnceWith("submit-review");
});

it("blocks an already open confirmation when an operation becomes busy", () => {
  const onStep = vi.fn().mockResolvedValue(undefined);
  const props = {
    domain: "footer" as const,
    status: "draft" as const,
    version: 4,
    permissions: ["footer.write"],
    onStep,
  };
  const { rerender } = render(<WorkflowControls {...props} busy={false} />);
  fireEvent.click(screen.getByRole("button", { name: "Enviar a revisión" }));
  rerender(<WorkflowControls {...props} busy />);
  const confirm = screen.getByRole("button", {
    name: "Confirmar enviar a revisión",
  });
  expect(confirm).toBeDisabled();
  fireEvent.click(confirm);
  expect(onStep).not.toHaveBeenCalled();
});

it("does not offer transitions to a read-only operator", () => {
  render(
    <WorkflowControls
      domain="legal"
      status="draft"
      version={3}
      permissions={["legal.read"]}
      busy={false}
      onStep={vi.fn()}
    />,
  );
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});

it("keeps a canonical authorization failure visible without successful transition", async () => {
  vi.mocked(contentRequest).mockRejectedValue(
    new ContentRequestError("forbidden", 403, "Permiso denegado."),
  );
  const initial: FooterSnapshot = {
    data: footer,
    history: [footer],
    published: null,
    requiresReview: false,
    routeAlerts: [],
  };
  render(
    <FooterWorkspace
      initial={initial}
      permissions={["footer.read", "footer.write"]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Enviar a revisión" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Confirmar enviar a revisión" }),
  );
  expect(await screen.findByRole("alert")).toHaveAttribute(
    "data-state",
    "forbidden",
  );
  expect(contentRequest).toHaveBeenCalledExactlyOnceWith(
    "footer/footer-draft/submit-review",
    expect.anything(),
    "POST",
  );
  expect(screen.queryByText(/Estado guardado/)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Título del grupo")).toHaveValue(
    "Grupo guardado",
  );
});

it("legal clone confirmation cannot create a revision after editing the open form", async () => {
  let current = legal;
  const detail = () => ({
    pageKey: "privacy",
    history: [current],
    draft: current,
    published: null,
    requirements: [],
  });
  vi.mocked(contentRequest).mockImplementation(
    async (path, _schema, method, body) => {
      if (method === "POST") {
        current = {
          ...legal,
          ...(body as Partial<LegalRevision>),
          id: "legal-clone",
          version: 4,
        };
        return current;
      }
      return path === "legal" ? { data: [current] } : detail();
    },
  );
  render(
    <LegalWorkspace
      initial={[legal]}
      permissions={["legal.read", "legal.write"]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Documento guardado" }));
  const title = await screen.findByLabelText("Título");
  fireEvent.click(
    screen.getByRole("button", { name: "Crear borrador desde esta versión" }),
  );
  const confirm = screen.getByRole("button", {
    name: "Confirmar nuevo borrador",
  });
  const before = vi.mocked(contentRequest).mock.calls.length;
  fireEvent.change(title, { target: { value: "Edición antes de clonar" } });
  fireEvent.change(screen.getByLabelText("Texto de sección 1"), {
    target: { value: "Cuerpo antes de clonar" },
  });
  expect.soft(confirm).toBeDisabled();
  await act(async () => {
    fireEvent.click(confirm);
  });
  expect.soft(contentRequest).toHaveBeenCalledTimes(before);
  expect
    .soft(screen.queryByText(/Nueva versión creada/))
    .not.toBeInTheDocument();
  expect(screen.getByLabelText("Título")).toHaveValue(
    "Edición antes de clonar",
  );
  expect(screen.getByLabelText("Texto de sección 1")).toHaveValue(
    "Cuerpo antes de clonar",
  );
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(
    screen.queryByRole("group", { name: "Confirmar restauración" }),
  ).not.toBeInTheDocument();
  expect(contentRequest).toHaveBeenCalledTimes(before);
});

it("footer restore confirmation cannot replace edits made after opening", async () => {
  const archived = { ...footer, status: "archived" as const };
  let current: FooterRevision = archived;
  const snapshot = (): FooterSnapshot => ({
    data: current,
    history: [current],
    published: null,
    requiresReview: false,
    routeAlerts: [],
  });
  vi.mocked(contentRequest).mockImplementation(
    async (_path, _schema, method) => {
      if (method === "POST") {
        current = { ...footer, id: "footer-restored", version: 5 };
        return current;
      }
      return snapshot();
    },
  );
  render(
    <FooterWorkspace
      initial={snapshot()}
      permissions={["footer.read", "footer.write"]}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Restaurar versión como borrador" }),
  );
  const confirm = screen.getByRole("button", {
    name: "Confirmar restauración del footer",
  });
  fireEvent.change(screen.getByLabelText("Título del grupo"), {
    target: { value: "Grupo pendiente" },
  });
  fireEvent.change(screen.getByLabelText("Texto del enlace"), {
    target: { value: "Enlace pendiente" },
  });
  expect.soft(confirm).toBeDisabled();
  await act(async () => {
    fireEvent.click(confirm);
  });
  expect.soft(contentRequest).not.toHaveBeenCalled();
  expect
    .soft(screen.queryByText(/Versión restaurada como borrador/))
    .not.toBeInTheDocument();
  expect
    .soft(screen.getAllByLabelText("Título del grupo")[0])
    .toHaveValue("Grupo pendiente");
  expect
    .soft(screen.getAllByLabelText("Texto del enlace")[0])
    .toHaveValue("Enlace pendiente");
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(
    screen.queryByRole("group", { name: "Confirmar restauración del footer" }),
  ).not.toBeInTheDocument();
  expect(contentRequest).not.toHaveBeenCalled();
});

it("retains one correct footer editor when selecting another revision without duplicate keys", () => {
  const original = console.error;
  const errors = vi
    .spyOn(console, "error")
    .mockImplementation((...args) => original(...args));
  try {
    const archived = {
      ...footer,
      id: "another-footer",
      status: "archived" as const,
      version: 1,
      groupsJson: [
        {
          title: "Otro grupo",
          links: [{ label: "Otra etiqueta", href: "/productos" }],
        },
      ],
    };
    const snapshot: FooterSnapshot = {
      data: footer,
      history: [footer, archived],
      published: null,
      requiresReview: false,
      routeAlerts: [],
    };
    render(
      <FooterWorkspace
        initial={snapshot}
        permissions={["footer.read", "footer.write"]}
      />,
    );
    fireEvent.change(screen.getByLabelText("Versión del footer"), {
      target: { value: "another-footer" },
    });
    expect(
      screen.getAllByRole("form", { name: "Editar destinos del footer" }),
    ).toHaveLength(1);
    expect(screen.getByLabelText("Título del grupo")).toHaveValue("Otro grupo");
    expect(screen.getByLabelText("Texto del enlace")).toHaveValue(
      "Otra etiqueta",
    );
    expect(
      screen.queryByRole("button", { name: "Enviar a revisión" }),
    ).not.toBeInTheDocument();
    expect(
      errors.mock.calls.filter((args) => String(args[0]).includes("same key")),
    ).toHaveLength(0);
  } finally {
    errors.mockRestore();
  }
});

it.each(["legal", "footer"] as const)(
  "%s open workflow loses its mutation when current permission props become read-only",
  async (domain) => {
    const detail = {
      pageKey: "privacy",
      history: [legal],
      draft: legal,
      published: null,
      requirements: [],
    };
    const snapshot: FooterSnapshot = {
      data: footer,
      history: [footer],
      published: null,
      requiresReview: false,
      routeAlerts: [],
    };
    vi.mocked(contentRequest).mockImplementation(
      async (path, _schema, method) => {
        if (method === "POST")
          throw new ContentRequestError("forbidden", 403, "Permiso denegado.");
        return path === "legal" ? { data: [legal] } : detail;
      },
    );
    const view =
      domain === "legal"
        ? render(
            <LegalWorkspace
              initial={[legal]}
              permissions={["legal.read", "legal.write", "legal.review"]}
            />,
          )
        : render(
            <FooterWorkspace
              initial={snapshot}
              permissions={["footer.read", "footer.write"]}
            />,
          );
    if (domain === "legal") {
      fireEvent.click(
        screen.getByRole("button", { name: "Documento guardado" }),
      );
      await screen.findByLabelText("Título");
    }
    fireEvent.click(screen.getByRole("button", { name: "Enviar a revisión" }));
    if (domain === "legal")
      view.rerender(
        <LegalWorkspace initial={[legal]} permissions={["legal.read"]} />,
      );
    else
      view.rerender(
        <FooterWorkspace initial={snapshot} permissions={["footer.read"]} />,
      );
    const confirm = screen.queryByRole("button", {
      name: "Confirmar enviar a revisión",
    });
    expect.soft(confirm).not.toBeInTheDocument();
    if (confirm)
      await act(async () => {
        fireEvent.click(confirm);
      });
    expect(
      vi
        .mocked(contentRequest)
        .mock.calls.filter((call) => call[2] === "POST" || call[2] === "PATCH"),
    ).toHaveLength(0);
    expect(screen.queryByText(/Estado guardado/)).not.toBeInTheDocument();
  },
);

it.each(["legal", "footer"] as const)(
  "%s open clone or restore cannot write after current write permission is removed",
  async (domain) => {
    const archived = { ...footer, status: "archived" as const };
    const snapshot: FooterSnapshot = {
      data: archived,
      history: [archived],
      published: null,
      requiresReview: false,
      routeAlerts: [],
    };
    const detail = {
      pageKey: "privacy",
      history: [legal],
      draft: legal,
      published: null,
      requirements: [],
    };
    vi.mocked(contentRequest).mockImplementation(
      async (_path, _schema, method) => {
        if (method === "POST")
          throw new ContentRequestError("forbidden", 403, "Permiso denegado.");
        return detail;
      },
    );
    const view =
      domain === "legal"
        ? render(
            <LegalWorkspace
              initial={[legal]}
              permissions={["legal.read", "legal.write"]}
            />,
          )
        : render(
            <FooterWorkspace
              initial={snapshot}
              permissions={["footer.read", "footer.write"]}
            />,
          );
    if (domain === "legal") {
      fireEvent.click(
        screen.getByRole("button", { name: "Documento guardado" }),
      );
      await screen.findByLabelText("Título");
    }
    fireEvent.click(
      screen.getByRole("button", {
        name:
          domain === "legal"
            ? "Crear borrador desde esta versión"
            : "Restaurar versión como borrador",
      }),
    );
    if (domain === "legal")
      view.rerender(
        <LegalWorkspace initial={[legal]} permissions={["legal.read"]} />,
      );
    else
      view.rerender(
        <FooterWorkspace initial={snapshot} permissions={["footer.read"]} />,
      );
    const confirm = screen.queryByRole("button", {
      name:
        domain === "legal"
          ? "Confirmar nuevo borrador"
          : "Confirmar restauración del footer",
    });
    expect.soft(confirm).not.toBeInTheDocument();
    if (confirm)
      await act(async () => {
        fireEvent.click(confirm);
      });
    expect(
      vi
        .mocked(contentRequest)
        .mock.calls.filter((call) => call[2] === "POST" || call[2] === "PATCH"),
    ).toHaveLength(0);
    expect(
      screen.queryByText(/Nueva versión creada|Versión restaurada/),
    ).not.toBeInTheDocument();
  },
);

it.each([
  {
    domain: "legal",
    permission: "legal.approve",
    status: "pending_legal_review",
    label: "Aprobar versión",
  },
  {
    domain: "legal",
    permission: "legal.publish",
    status: "approved",
    label: "Publicar versión",
  },
  {
    domain: "footer",
    permission: "footer.publish",
    status: "pending_legal_review",
    label: "Aprobar versión",
  },
  {
    domain: "footer",
    permission: "footer.publish",
    status: "approved",
    label: "Publicar versión",
  },
] as const)(
  "$domain $status confirmation consults the current phase permission",
  async ({ domain, permission, status, label }) => {
    const onStep = vi.fn().mockResolvedValue(undefined);
    const props = { domain, status, version: 3, busy: false, onStep };
    const view = render(
      <WorkflowControls
        {...props}
        permissions={[`${domain}.read`, permission]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: label }));
    view.rerender(
      <WorkflowControls {...props} permissions={[`${domain}.read`]} />,
    );
    const confirm = screen.queryByRole("button", {
      name: `Confirmar ${label.toLowerCase()}`,
    });
    expect.soft(confirm).not.toBeInTheDocument();
    if (confirm)
      await act(async () => {
        fireEvent.click(confirm);
      });
    expect(onStep).not.toHaveBeenCalled();
  },
);

it.each([
  {
    domain: "legal",
    status: "draft",
    permission: "legal.review",
    label: "Enviar a revisión",
    step: "submit-review",
  },
  {
    domain: "footer",
    status: "pending_legal_review",
    permission: "footer.publish",
    label: "Aprobar versión",
    step: "approve",
  },
] as const)(
  "$domain retains a permitted phase and cancellation when only editing permission is removed",
  async ({ domain, status, permission, label, step }) => {
    const onStep = vi.fn().mockResolvedValue(undefined);
    const props = { domain, status, version: 3, busy: false, onStep };
    const view = render(
      <WorkflowControls
        {...props}
        permissions={[`${domain}.read`, `${domain}.write`, permission]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: label }));
    view.rerender(
      <WorkflowControls
        {...props}
        permissions={[`${domain}.read`, permission]}
      />,
    );
    expect(
      screen.getByRole("button", { name: `Confirmar ${label.toLowerCase()}` }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onStep).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: label }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", {
          name: `Confirmar ${label.toLowerCase()}`,
        }),
      );
    });
    expect(onStep).toHaveBeenCalledExactlyOnceWith(step);
  },
);
