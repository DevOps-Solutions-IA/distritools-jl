import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  RolesWorkspace,
  UsersWorkspace,
  SettingsWorkspace,
} from "@/features/admin/system/Workspaces";
const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
const userId = "00000000-0000-4000-8000-000000000001";
const roleId = "00000000-0000-4000-8000-000000000002";
const otherId = "00000000-0000-4000-8000-000000000003";
const newId = "00000000-0000-4000-8000-000000000004";
const permission = { id: newId, slug: "users.read", module: "users" };
const role = {
  id: roleId,
  name: "Consulta",
  slug: "reader",
  description: null,
  usersCount: 1,
  permissions: [permission],
};
const user = {
  id: userId,
  fullName: "Operador",
  email: "op***@example.invalid",
  phone: null,
  role: { id: roleId, name: role.name, slug: role.slug },
  isActive: true,
  twoFactorEnabled: true,
  lastLoginAt: null,
};
const state = {
  id: userId,
  roleId,
  fullName: "Nuevo operador",
  isActive: true,
};
type Action =
  | "update"
  | "deactivate"
  | "createUser"
  | "permissions"
  | "assign"
  | "createRole";
function perform(action: Action) {
  if (["update", "deactivate", "createUser"].includes(action)) {
    const permissions = [
      action === "update"
        ? "users.update"
        : action === "deactivate"
          ? "users.deactivate"
          : "users.create",
    ];
    render(
      <UsersWorkspace
        users={[user]}
        roles={[role]}
        permissions={permissions}
        actorId={otherId}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name:
          action === "update"
            ? "Editar usuario"
            : action === "deactivate"
              ? "Desactivar usuario"
              : "Crear usuario",
      }),
    );
    if (action === "deactivate") {
      const button = screen.getByRole("button", {
        name: "Confirmar desactivación",
      });
      fireEvent.click(button);
      return button;
    }
    fireEvent.change(screen.getByLabelText("Nombre completo"), {
      target: { value: "Nuevo operador" },
    });
    if (action === "createUser") {
      for (const [label, value] of [
        ["Email", "new@example.invalid"],
        ["Contraseña inicial", "synthetic-password-123"],
        ["ID del rol inicial", roleId],
      ])
        fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    const button = screen.getByRole("button", { name: "Guardar usuario" });
    fireEvent.submit(button.closest("form")!);
    return button;
  }
  render(
    <RolesWorkspace
      roles={[role]}
      users={[user]}
      catalog={[permission]}
      permissions={[
        action === "permissions"
          ? "permissions.assign"
          : action === "assign"
            ? "roles.assign"
            : "roles.create",
      ]}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", {
      name:
        action === "permissions"
          ? "Asignar permisos"
          : action === "assign"
            ? "Asignar usuario"
            : "Crear rol",
    }),
  );
  if (action === "assign")
    fireEvent.change(screen.getByLabelText("ID del usuario destinatario"), {
      target: { value: userId },
    });
  if (action === "createRole") {
    fireEvent.change(screen.getByLabelText("Nombre del rol"), {
      target: { value: "Nuevo rol" },
    });
    fireEvent.change(screen.getByLabelText("Identificador del rol"), {
      target: { value: " NEW-ROLE " },
    });
  }
  const button = screen.getByRole("button", {
    name:
      action === "permissions"
        ? "Guardar permisos"
        : action === "assign"
          ? "Confirmar asignación"
          : "Guardar rol",
  });
  fireEvent.submit(button.closest("form")!);
  return button;
}
beforeEach(() => mocks.refresh.mockReset());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const faults: [string, Action, unknown][] = [
  ["usuario ajeno al PATCH", "update", { ...state, id: otherId }],
  [
    "usuario ajeno a desactivar",
    "deactivate",
    { ...state, id: otherId, isActive: false },
  ],
  ["desactivación que conserva activo", "deactivate", state],
  ["desactivación sin estado confirmado", "deactivate", { id: userId }],
  [
    "usuario creado con otro rol",
    "createUser",
    { ...state, id: newId, roleId: otherId },
  ],
  [
    "permisos de otro rol",
    "permissions",
    { roleId: otherId, permissions: ["users.read"] },
  ],
  [
    "conjunto de permisos contradictorio",
    "permissions",
    { roleId, permissions: ["roles.assign"] },
  ],
  ["asignación a otro usuario", "assign", { ...state, id: otherId }],
  ["asignación de otro rol", "assign", { ...state, roleId: otherId }],
  [
    "rol creado con otro identificador",
    "createRole",
    { id: newId, slug: "foreign-role" },
  ],
  ["permisos sin matriz canónica", "permissions", { roleId }],
  [
    "actualización sin nombre solicitado",
    "update",
    { ...state, fullName: "Ajeno" },
  ],
  [
    "usuario creado con otro nombre",
    "createUser",
    { ...state, id: newId, fullName: "Ajeno", email: "new@example.invalid" },
  ],
  [
    "rol creado con otro nombre",
    "createRole",
    { id: newId, slug: "new-role", name: "Ajeno" },
  ],
];
for (const [name, action, response] of faults)
  it(`no confirma ${name} ni permite repetir una mutación incierta`, async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(response), {
          status:
            action === "createUser" ||
            action === "createRole" ||
            action === "assign"
              ? 201
              : 200,
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    const button = perform(action);
    await waitFor(() =>
      expect(
        document.querySelector('[data-state]:not([data-state="pending"])'),
      ).not.toBeNull(),
    );
    expect(screen.getByRole("alert")).toHaveAttribute(
      "data-state",
      "uncertain",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("incierto");
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(fetcher).toHaveBeenCalledOnce();
  });
const valid: [Action, unknown][] = [
  ["update", state],
  ["deactivate", { ...state, isActive: false }],
  ["createUser", { ...state, id: newId, email: "new@example.invalid" }],
  ["permissions", { roleId, permissions: ["users.read"] }],
  [
    "permissions",
    {
      roleId,
      roleName: role.name,
      roleSlug: role.slug,
      permissions: ["users.read"],
    },
  ],
  ["assign", state],
  [
    "createRole",
    { id: newId, slug: "new-role", name: "Nuevo rol", description: null },
  ],
];
for (const [action, response] of valid)
  it(`conserva confirmación canónica ${action} ${JSON.stringify(response)}`, async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(response), {
          status:
            action === "createUser" ||
            action === "createRole" ||
            action === "assign"
              ? 201
              : 200,
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    perform(action);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveAttribute("data-state", "success");
    expect(fetcher).toHaveBeenCalledOnce();
  });
it("configuración con otro nombre público queda incierta sin recarga ni repetición", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          updated: true,
          acceptedForReview: true,
          settings: { general: { storeName: "Ajeno" } },
          operationalState: { status: "requires_secure_secret_flow" },
        }),
        { status: 200 },
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  const provider = { provider: "none", ready: false, configured: {} };
  render(
    <SettingsWorkspace
      settings={{
        persisted: [],
        general: { storeName: "JL", currency: "COP" },
      }}
      providers={{
        payments: provider,
        shipping: provider,
        notifications: provider,
      }}
      permissions={["settings.write"]}
    />,
  );
  fireEvent.change(screen.getByLabelText("Nombre público registrado"), {
    target: { value: "Nombre enviado" },
  });
  const button = screen.getByRole("button", { name: "Guardar datos públicos" });
  fireEvent.submit(button.closest("form")!);
  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveAttribute("data-state", "uncertain");
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(fetcher).toHaveBeenCalledOnce();
});
