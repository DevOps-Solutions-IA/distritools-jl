import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  UsersWorkspace,
  RolesWorkspace,
  SettingsWorkspace,
} from "@/features/admin/system/Workspaces";
const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
const user = {
  id: "u1",
  fullName: "Operador",
  email: "op***@example.test",
  phone: "300***01",
  role: { id: "r1", name: "Consulta", slug: "reader" },
  isActive: true,
  twoFactorEnabled: true,
  lastLoginAt: null,
};
const role = {
  id: "r1",
  name: "Consulta",
  slug: "reader",
  description: null,
  usersCount: 1,
  permissions: [{ id: "p1", slug: "users.read", module: "users" }],
};
// AdminUserState returned by the canonical repository; the UI sends only edited fields.
const mutationUser = {
  id: "u1",
  fullName: "Operador",
  email: "operator@example.test",
  phone: "3001111111",
  roleId: "r1",
  roleName: "Consulta",
  roleSlug: "reader",
  isActive: true,
  createdAt: "2026-10-14T00:00:00.000Z",
  updatedAt: "2026-10-14T00:00:00.000Z",
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("read-only no ofrece crear, editar o desactivar usuarios", () => {
  render(
    <UsersWorkspace
      users={[user]}
      roles={[]}
      permissions={["users.read"]}
      actorId="other"
    />,
  );
  for (const name of ["Crear usuario", "Editar usuario", "Desactivar usuario"])
    expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  expect(screen.getByText("op***@example.test")).toBeInTheDocument();
});
it("edición omite email y teléfono protegidos; sólo envía campos explícitamente editados", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ ...mutationUser, fullName: "Operador actualizado" }),
      {
        status: 200,
      },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(
    <UsersWorkspace
      users={[user]}
      roles={[role]}
      permissions={["users.read", "users.update", "permissions.read"]}
      actorId="other"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Editar usuario" }));
  expect(screen.getByLabelText("Nuevo email (opcional)")).toHaveValue("");
  expect(screen.getByLabelText("Nuevo teléfono (opcional)")).toHaveValue("");
  fireEvent.change(screen.getByLabelText("Nombre completo"), {
    target: { value: "Operador actualizado" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Guardar usuario" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    fullName: "Operador actualizado",
  });
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
});
it("400 es recuperable y 500 queda incierto sin reintento automático", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Nombre inválido" }), {
        status: 400,
      }),
    )
    .mockResolvedValueOnce(new Response("{}", { status: 500 }));
  vi.stubGlobal("fetch", fetcher);
  render(
    <UsersWorkspace
      users={[user]}
      roles={[]}
      permissions={["users.read", "users.update"]}
      actorId="other"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Editar usuario" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar usuario" }));
  await screen.findByText("Nombre inválido");
  expect(screen.getByRole("button", { name: "Guardar usuario" })).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Guardar usuario" }));
  await screen.findByText(/Resultado incierto/);
  expect(
    screen.getByRole("button", { name: "Guardar usuario" }),
  ).toBeDisabled();
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("no ofrece desactivarse a sí mismo ni vuelve a desactivar inactivos", () => {
  render(
    <UsersWorkspace
      users={[user, { ...user, id: "u2", isActive: false }]}
      roles={[]}
      permissions={["users.read", "users.deactivate"]}
      actorId="u1"
    />,
  );
  expect(
    screen.queryByRole("button", { name: "Desactivar usuario" }),
  ).not.toBeInTheDocument();
});
it("roles usa PUT existente con los slugs reales seleccionados, sin permisos decorativos", async () => {
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        roleId: "r1",
        roleName: "Consulta",
        roleSlug: "reader",
        permissions: ["users.read"],
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(
    <RolesWorkspace
      roles={[role]}
      users={[]}
      catalog={[
        {
          id: "p1",
          slug: "users.read",
          module: "users",
          name: "Leer usuarios",
          description: null,
        },
      ]}
      permissions={["permissions.read", "permissions.assign"]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Asignar permisos" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar permisos" }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  expect(fetcher.mock.calls[0][0]).toBe("/api/admin/roles/r1/permissions");
  expect(fetcher.mock.calls[0][1].method).toBe("PUT");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
    permissionSlugs: ["users.read"],
  });
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  expect(screen.getByRole("status")).toHaveAttribute("data-state", "success");
});
it("configuración declara validación local y nunca muestra ni solicita secretos", () => {
  render(
    <SettingsWorkspace
      settings={{
        persisted: [],
        general: { storeName: "DistriTools JL", currency: "COP" },
      }}
      providers={{
        payments: {
          provider: "none",
          pseProvider: "none",
          ready: false,
          configured: { wompi: false, payu: false },
        },
        shipping: {
          provider: "none",
          ready: false,
          configured: { authPassword: false },
        },
        notifications: {
          provider: "none",
          ready: false,
          configured: { email: false },
        },
      }}
      permissions={["settings.read", "settings.write"]}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Validar configuración local" }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/no comprueba credenciales con proveedores/i),
  ).toBeInTheDocument();
  expect(document.querySelector("input[type=password]")).toBeNull();
});
it("la revocación de permisos oculta el formulario ya abierto sin permitir una escritura", () => {
  const view = render(
    <UsersWorkspace
      users={[user]}
      roles={[]}
      permissions={["users.read", "users.update"]}
      actorId="other"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Editar usuario" }));
  fireEvent.change(screen.getByLabelText("Nuevo email (opcional)"), {
    target: { value: "private@example.test" },
  });
  view.rerender(
    <UsersWorkspace
      users={[user]}
      roles={[]}
      permissions={["users.read"]}
      actorId="other"
    />,
  );
  expect(
    screen.queryByRole("form", { name: "Editar usuario interno" }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByDisplayValue("private@example.test"),
  ).not.toBeInTheDocument();
});
it("un éxito malformado queda incierto sin afirmar persistencia ni recargar", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetcher);
  render(
    <UsersWorkspace
      users={[user]}
      roles={[]}
      permissions={["users.read", "users.update"]}
      actorId="other"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Editar usuario" }));
  fireEvent.click(screen.getByRole("button", { name: "Guardar usuario" }));
  await screen.findByText(/Resultado incierto/);
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(
    screen.getByRole("button", { name: "Guardar usuario" }),
  ).toBeDisabled();
});
it("un doble envío durante pending produce una sola solicitud y no reintenta", async () => {
  let finish!: (v: Response) => void;
  const fetcher = vi.fn().mockReturnValue(
    new Promise<Response>((r) => {
      finish = r;
    }),
  );
  vi.stubGlobal("fetch", fetcher);
  render(
    <UsersWorkspace
      users={[user]}
      roles={[]}
      permissions={["users.read", "users.update"]}
      actorId="other"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Editar usuario" }));
  const save = screen.getByRole("button", { name: "Guardar usuario" });
  fireEvent.click(save);
  fireEvent.click(save);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(save).toBeDisabled();
  finish(new Response(JSON.stringify(mutationUser), { status: 200 }));
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
});
for (const status of [401, 403, 409])
  it(`denegación/conflicto ${status} no afirma éxito ni crea un reintento`, async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Conflicto existente" }), {
        status,
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(
      <UsersWorkspace
        users={[user]}
        roles={[]}
        permissions={["users.read", "users.update"]}
        actorId="other"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Editar usuario" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar usuario" }));
    await screen.findByRole("alert");
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledOnce();
  });
it("roles.assign funciona con un ID explícito sin exigir permiso de lectura de usuarios adicional", () => {
  render(
    <RolesWorkspace
      roles={[role]}
      users={[]}
      catalog={[]}
      permissions={["permissions.read", "roles.assign"]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Asignar usuario" }));
  expect(
    screen.getByLabelText("ID del usuario destinatario"),
  ).toBeInTheDocument();
  expect(
    screen.queryByLabelText("Usuario destinatario"),
  ).not.toBeInTheDocument();
});
it("users.create conserva la operación con ID de rol existente cuando no puede leer catálogo de roles", () => {
  render(
    <UsersWorkspace
      users={[]}
      roles={[]}
      permissions={["users.read", "users.create"]}
      actorId="other"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
  expect(screen.getByLabelText("ID del rol inicial")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Guardar usuario" })).toBeEnabled();
});
it("resultado valid:false del proveedor se muestra como fallo local, nunca verde ficticio", async () => {
  const p = { provider: "none", ready: false, configured: { email: false } };
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        valid: false,
        failures: ["Credenciales locales incompletas."],
        providers: { payments: p, shipping: p, notifications: p },
      }),
      { status: 201 },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  render(
    <SettingsWorkspace
      settings={{
        persisted: [],
        general: { storeName: "JL", currency: "COP" },
      }}
      providers={{ payments: p, shipping: p, notifications: p }}
      permissions={["settings.read", "settings.write"]}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Validar configuración local" }),
  );
  await screen.findByText("Credenciales locales incompletas.");
  expect(
    screen.queryByText("Sin errores locales de configuración."),
  ).not.toBeInTheDocument();
  expect(fetcher).toHaveBeenCalledOnce();
});
it("los selectores de rol y usuario conservan el nombre accesible exacto sin incluir sus opciones", () => {
  const view = render(
    <UsersWorkspace
      users={[]}
      roles={[role]}
      permissions={["users.read", "users.create", "permissions.read"]}
      actorId="other"
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Crear usuario" }));
  const selector = screen.getByRole("combobox", {
    name: /^Rol inicial$/,
  }) as HTMLSelectElement;
  expect(selector.labels?.[0].textContent?.trim()).toBe("Rol inicial");
  view.unmount();
  render(
    <RolesWorkspace
      roles={[role]}
      users={[user]}
      catalog={[]}
      permissions={["permissions.read", "roles.assign", "users.read"]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Asignar usuario" }));
  expect(
    screen.getByRole("combobox", { name: /^Usuario destinatario$/ }),
  ).toBeInTheDocument();
});
