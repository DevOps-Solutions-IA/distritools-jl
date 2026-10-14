import { PATCH as updateUser } from "@/app/api/admin/users/[id]/route";
import { PATCH as deactivateUser } from "@/app/api/admin/users/[id]/deactivate/route";
import { POST as createUser } from "@/app/api/admin/users/route";
import { POST as createRole } from "@/app/api/admin/roles/route";
import { POST as assignUser } from "@/app/api/admin/roles/[id]/assign-user/route";
import { PUT as assignPermissions } from "@/app/api/admin/roles/[id]/permissions/route";
import { PATCH as updateSettings } from "@/app/api/admin/settings/route";
import {
  parseIamMutationConfirmation,
  parseIamSettingsConfirmation,
} from "@/features/admin/system/contracts";
const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "synthetic-unit-token" }) }),
}));
vi.mock("@/config/env", () => ({
  env: { apiBaseUrl: "http://backend.invalid", siteUrl: "http://localhost" },
}));
const userId = "00000000-0000-4000-8000-000000000001",
  roleId = "00000000-0000-4000-8000-000000000002",
  otherId = "00000000-0000-4000-8000-000000000003",
  newId = "00000000-0000-4000-8000-000000000004";
const state = { id: userId, roleId, isActive: true };
const matrix = {
  roleId,
  roleName: "Consulta",
  roleSlug: "reader",
  permissions: ["users.read"],
};
type Route = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response> | Response;
const cases: [
  string,
  string,
  string,
  unknown,
  unknown,
  number,
  Route,
  string,
][] = [
  [
    "PATCH otro usuario",
    "PATCH",
    `users/${userId}`,
    { fullName: "Nuevo" },
    { ...state, id: otherId },
    200,
    updateUser,
    userId,
  ],
  [
    "desactivar otro usuario",
    "PATCH",
    `users/${userId}/deactivate`,
    {},
    { ...state, id: otherId, isActive: false },
    200,
    deactivateUser,
    userId,
  ],
  [
    "desactivar conserva activo",
    "PATCH",
    `users/${userId}/deactivate`,
    {},
    state,
    200,
    deactivateUser,
    userId,
  ],
  [
    "desactivar omite estado",
    "PATCH",
    `users/${userId}/deactivate`,
    {},
    { id: userId },
    200,
    deactivateUser,
    userId,
  ],
  [
    "crear usuario rol distinto",
    "POST",
    "users",
    {
      fullName: "Nuevo",
      email: "unit@example.invalid",
      password: "synthetic-password-123",
      roleId,
    },
    { ...state, id: newId, roleId: otherId },
    201,
    createUser,
    userId,
  ],
  [
    "permisos de otro rol",
    "PUT",
    `roles/${roleId}/permissions`,
    { permissionSlugs: ["users.read"] },
    { ...matrix, roleId: otherId },
    200,
    assignPermissions,
    roleId,
  ],
  [
    "permisos contradictorios",
    "PUT",
    `roles/${roleId}/permissions`,
    { permissionSlugs: ["users.read"] },
    { ...matrix, permissions: ["roles.assign"] },
    200,
    assignPermissions,
    roleId,
  ],
  [
    "asignación otro usuario",
    "POST",
    `roles/${roleId}/assign-user`,
    { userId },
    { ...state, id: otherId },
    201,
    assignUser,
    roleId,
  ],
  [
    "asignación otro rol",
    "POST",
    `roles/${roleId}/assign-user`,
    { userId },
    { ...state, roleId: otherId },
    201,
    assignUser,
    roleId,
  ],
  [
    "crear rol slug distinto",
    "POST",
    "roles",
    { name: "Nuevo", slug: "new-role" },
    { id: newId, slug: "foreign-role" },
    201,
    createRole,
    roleId,
  ],
  [
    "permisos sin matriz",
    "PUT",
    `roles/${roleId}/permissions`,
    { permissionSlugs: ["users.read"] },
    { roleId },
    200,
    assignPermissions,
    roleId,
  ],
  [
    "PATCH nombre distinto",
    "PATCH",
    `users/${userId}`,
    { fullName: "Nuevo" },
    { ...state, fullName: "Ajeno" },
    200,
    updateUser,
    userId,
  ],
  [
    "crear usuario nombre distinto",
    "POST",
    "users",
    {
      fullName: "Nuevo",
      email: "unit@example.invalid",
      password: "synthetic-password-123",
      roleId,
    },
    { ...state, id: newId, fullName: "Ajeno", email: "unit@example.invalid" },
    201,
    createUser,
    userId,
  ],
  [
    "crear rol nombre distinto",
    "POST",
    "roles",
    { name: "Nuevo", slug: "new-role" },
    { id: newId, name: "Ajeno", slug: "new-role" },
    201,
    createRole,
    roleId,
  ],
  [
    "settings nombre distinto",
    "PATCH",
    "settings",
    { general: { storeName: "Nuevo" } },
    {
      updated: true,
      acceptedForReview: true,
      settings: { general: { storeName: "Ajeno" } },
      operationalState: { status: "requires_secure_secret_flow" },
    },
    200,
    updateSettings,
    userId,
  ],
];
function request(method: string, path: string, body: unknown) {
  return new Request(`http://localhost/api/admin/${path}`, {
    method,
    headers: { "Content-Type": "application/json", Origin: "http://localhost" },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());
for (const [name, method, path, input, output, status, route, id] of cases)
  it(`BFF rechaza ${name} sin retransmitir confirmación falsa`, async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify(output), { status }),
    );
    const result = await route(request(method, path, input), {
      params: Promise.resolve({ id }),
    });
    expect(result.status).toBe(502);
    expect(await result.json()).toEqual({
      error: "El servicio devolvió una respuesta inválida.",
    });
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });
for (const [input, output] of [
  [{ fullName: "Nuevo" }, { id: userId }],
  [
    { email: "new@example.invalid" },
    { id: userId, email: "old@example.invalid" },
  ],
  [{ email: "new@example.invalid" }, { id: userId }],
  [{ phone: " 300123 " }, { id: userId, phone: "300999" }],
  [{ phone: null }, { id: userId, phone: "300123" }],
  [{ phone: " " }, { id: userId }],
])
  it(`PATCH exige el efecto explícito ${JSON.stringify(input)} ${JSON.stringify(output)}`, async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify(output), { status: 200 }),
    );
    const result = await updateUser(
      request("PATCH", `users/${userId}`, input),
      { params: Promise.resolve({ id: userId }) },
    );
    expect(result.status).toBe(502);
    expect(await result.json()).toEqual({
      error: "El servicio devolvió una respuesta inválida.",
    });
  });
it("PATCH confirma normalización del productor y proyecta sólo contacto enviado", async () => {
  const input = {
    fullName: " Nuevo ",
    email: "New@Example.invalid",
    phone: " ",
  };
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        ...state,
        fullName: "Nuevo",
        email: "new@example.invalid",
        phone: null,
        passwordHash: "PRIVATE",
        twoFactorSecret: "PRIVATE",
        roleName: "PRIVATE",
      }),
      { status: 200 },
    ),
  );
  const result = await updateUser(request("PATCH", `users/${userId}`, input), {
    params: Promise.resolve({ id: userId }),
  });
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({
    id: userId,
    fullName: "Nuevo",
    email: "new@example.invalid",
    phone: null,
  });
});
for (const [input, output, expected] of [
  [
    { phone: " 300123 " },
    { id: userId, phone: "300123" },
    { id: userId, phone: "300123" },
  ],
  [{ phone: null }, { id: userId, phone: null }, { id: userId, phone: null }],
])
  it(`PATCH permite teléfono normalizado ${JSON.stringify(input)}`, () => {
    expect(
      parseIamMutationConfirmation(
        `/admin/users/${userId}`,
        "PATCH",
        input,
        output,
      ),
    ).toEqual({ success: true, data: expected });
  });
for (const output of [
  { ...state, id: newId, fullName: "Nuevo" },
  { ...state, id: newId, fullName: "Nuevo", email: "foreign@example.invalid" },
  {
    ...state,
    id: newId,
    fullName: "Nuevo",
    email: "new@example.invalid",
    phone: "foreign",
  },
  {
    ...state,
    id: newId,
    fullName: "Nuevo",
    email: "new@example.invalid",
    phone: "300123",
    isActive: false,
  },
])
  it(`crear usuario exige efecto canónico ${JSON.stringify(output)}`, () => {
    expect(
      parseIamMutationConfirmation(
        "/admin/users",
        "POST",
        {
          fullName: "Nuevo",
          email: "new@example.invalid",
          phone: "300123",
          roleId,
        },
        output,
      ).success,
    ).toBe(false);
  });
for (const description of [undefined, "foreign"])
  it(`crear rol exige descripción enviada ${description}`, () => {
    expect(
      parseIamMutationConfirmation(
        "/admin/roles",
        "POST",
        { name: "Nuevo", slug: "new", description: "Descripción" },
        { id: newId, name: "Nuevo", slug: "new", description },
      ).success,
    ).toBe(false);
  });
it("crear rol confirma nombre, slug y descripción normalizados sin campos privados", async () => {
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        id: newId,
        name: "Nuevo",
        slug: "new",
        description: null,
        privateExtra: "PRIVATE",
      }),
      { status: 201 },
    ),
  );
  const result = await createRole(
    request("POST", "roles", {
      name: " Nuevo ",
      slug: " NEW ",
      description: " ",
    }),
  );
  expect(result.status).toBe(201);
  expect(await result.json()).toEqual({
    id: newId,
    name: "Nuevo",
    slug: "new",
    description: null,
  });
});
for (const [route, method, input, output, expected] of [
  [
    `/admin/users/${userId}/deactivate`,
    "PATCH",
    {},
    { ...state, isActive: false },
    { id: userId, isActive: false },
  ],
  [
    `/admin/roles/${roleId}/assign-user`,
    "POST",
    { userId },
    state,
    { id: userId, roleId },
  ],
])
  it(`mutación ${route} no expone contacto almacenado ni secretos`, () => {
    expect(
      parseIamMutationConfirmation(route as string, method as string, input, {
        ...(output as object),
        email: "stored@example.invalid",
        phone: "stored",
        fullName: "Stored",
        passwordHash: "PRIVATE",
        twoFactorSecret: "PRIVATE",
        accessToken: "PRIVATE",
      }),
    ).toEqual({ success: true, data: expected });
  });
it("settings exige nombre público confirmado y omite categorías, secretos y mensajes ajenos", async () => {
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        updated: true,
        acceptedForReview: true,
        settings: {
          general: { storeName: "Nuevo", currency: "PRIVATE" },
          payments: { privateKey: "PRIVATE" },
        },
        operationalState: {
          status: "requires_secure_secret_flow",
          message: "PRIVATE",
        },
      }),
      { status: 200 },
    ),
  );
  const result = await updateSettings(
    request("PATCH", "settings", { general: { storeName: " Nuevo " } }),
  );
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({
    updated: true,
    acceptedForReview: true,
    settings: { general: { storeName: "Nuevo" } },
    operationalState: { status: "requires_secure_secret_flow" },
  });
  expect(
    parseIamSettingsConfirmation(
      { general: { storeName: "Nuevo" } },
      {
        updated: true,
        acceptedForReview: true,
        operationalState: { status: "requires_secure_secret_flow" },
      },
    ).success,
  ).toBe(false);
});
it("BFF conserva permisos canónicos para validación UI y elimina extras privados", async () => {
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({ ...matrix, privateExtra: "SHOULD_NOT_SURVIVE" }),
      { status: 200 },
    ),
  );
  const result = await assignPermissions(
    request("PUT", `roles/${roleId}/permissions`, {
      permissionSlugs: ["users.read"],
    }),
    { params: Promise.resolve({ id: roleId }) },
  );
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ roleId, permissions: ["users.read"] });
  expect(mocks.fetch).toHaveBeenCalledOnce();
});
it("BFF acepta normalización canónica y orden independiente de permisos", async () => {
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        ...matrix,
        permissions: ["roles.assign", "users.read"],
      }),
      { status: 200 },
    ),
  );
  const result = await assignPermissions(
    request("PUT", `roles/${roleId}/permissions`, {
      permissionSlugs: [" USERS.READ ", "roles.assign", "users.read"],
    }),
    { params: Promise.resolve({ id: roleId }) },
  );
  expect(result.status).toBe(200);
  expect(mocks.fetch).toHaveBeenCalledOnce();
});
it("BFF conserva identificadores existentes sin imponer formato UUID", async () => {
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        id: "u1",
        fullName: "Nuevo",
        email: "private@example.invalid",
        phone: "private",
        passwordHash: "PRIVATE",
        twoFactorSecret: "PRIVATE",
      }),
      { status: 200 },
    ),
  );
  const result = await updateUser(
    request("PATCH", "users/u1", { fullName: "Nuevo" }),
    { params: Promise.resolve({ id: "u1" }) },
  );
  expect(result.status).toBe(200);
  expect(await result.json()).toEqual({ id: "u1", fullName: "Nuevo" });
});
