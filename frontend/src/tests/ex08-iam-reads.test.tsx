import type { ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import UsersPage from "@/app/admin/usuarios/page";
import RolesPage from "@/app/admin/roles/page";
import AuditPage from "@/app/admin/auditoria/page";
import { iamRead, iamLoad } from "@/features/admin/system/server";
import { usersSchema } from "@/features/admin/system/contracts";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), session: vi.fn() }));
vi.mock("@/lib/admin/server-data", async () => {
  const original = await vi.importActual<
    typeof import("@/lib/admin/server-data")
  >("@/lib/admin/server-data");
  return { ...original, adminFetch: mocks.fetch };
});
vi.mock("@/lib/admin/transport/session", () => ({
  getAdminSessionContext: mocks.session,
}));
vi.mock("@/components/layout/AdminShell", () => ({
  AdminShell: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const success = (data: unknown) => ({
  ok: true,
  kind: "success",
  status: 200,
  error: null,
  data,
});
function session(permissions: string[]) {
  mocks.session.mockResolvedValue(
    success({
      user: { id: "actor", email: "protected", role: "reader", permissions },
    }),
  );
}
beforeEach(() => {
  mocks.fetch.mockReset();
  mocks.session.mockReset();
});
afterEach(cleanup);
for (const status of [401, 403, 500])
  it(`rechaza el error de lectura ${status} sin fabricar colección vacía`, async () => {
    session(["users.read"]);
    mocks.fetch.mockResolvedValue({
      ok: false,
      status,
      kind:
        status === 401
          ? "auth_required"
          : status === 403
            ? "forbidden"
            : "server_error",
      error: "Lectura denegada",
      data: null,
    });
    render(await UsersPage());
    expect(screen.getByRole("alert")).toHaveTextContent("Lectura denegada");
    expect(
      screen.queryByText("No hay usuarios en la respuesta autorizada."),
    ).not.toBeInTheDocument();
  });
it("users.read consulta únicamente usuarios y no exige permissions.read al lector", async () => {
  session(["users.read"]);
  mocks.fetch.mockResolvedValue(success({ data: [] }));
  render(await UsersPage());
  expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith("/admin/users");
  expect(
    screen.getByText("No hay usuarios en la respuesta autorizada."),
  ).toBeInTheDocument();
});
it("permisos insuficientes detienen lecturas del módulo", async () => {
  session([]);
  render(await UsersPage());
  expect(screen.getByRole("alert")).toHaveTextContent("No tiene permiso");
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("matriz malformada se muestra como error de contrato y conserva acceso a la alerta", async () => {
  session(["permissions.read"]);
  mocks.fetch.mockImplementation(async (path: string) =>
    success(
      path === "/admin/roles"
        ? { data: [] }
        : {
            catalog: [],
            roles: [
              {
                roleId: "x",
                roleName: "x",
                roleSlug: "x",
                permissions: [{ slug: "users.read" }],
              },
            ],
          },
    ),
  );
  render(await RolesPage());
  expect(screen.getByRole("alert")).toHaveTextContent("respuesta inválida");
  expect(
    screen.queryByText("No hay roles registrados."),
  ).not.toBeInTheDocument();
});
it("auditoría envía únicamente filtros soportados por servidor en URL y muestra vacío exitoso", async () => {
  session(["audit.read"]);
  mocks.fetch.mockResolvedValue(success({ data: [] }));
  render(
    await AuditPage({
      searchParams: Promise.resolve({
        action: "users.admin.updated",
        entityType: "user",
        entityId: "entity",
        limit: "20",
        actor: "not-supported",
        page: "9",
      }),
    }),
  );
  expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith(
    "/admin/audit?action=users.admin.updated&entityType=user&entityId=entity&limit=20",
  );
  expect(
    screen.getByRole("button", { name: "Filtrar eventos" }),
  ).toHaveAttribute("type", "submit");
  expect(
    screen.getByText("No hay eventos para los filtros recibidos."),
  ).toBeInTheDocument();
});
it("objeto exitoso que omite data falla contrato; jamás se convierte en lista vacía", async () => {
  mocks.fetch.mockResolvedValue(success({ notData: [] }));
  const result = await iamLoad(() => iamRead("/admin/users", usersSchema));
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.result.kind).toBe("contract_error");
});
