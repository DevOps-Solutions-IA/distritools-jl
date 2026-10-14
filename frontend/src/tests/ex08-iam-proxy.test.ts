import { POST as createUser } from "@/app/api/admin/users/route";
import { PUT as assignPermissions } from "@/app/api/admin/roles/[id]/permissions/route";
import {
  PATCH as updateSettings,
  GET as readSettings,
} from "@/app/api/admin/settings/route";
import { GET as auditDetail } from "@/app/api/admin/audit/[id]/route";
import { POST as validateProviders } from "@/app/api/admin/settings/providers/validate/route";
const mocks = vi.hoisted(() => ({ token: "qa-cookie", fetch: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (mocks.token ? { value: mocks.token } : undefined),
  }),
}));
vi.mock("@/config/env", () => ({
  env: {
    apiBaseUrl: "http://127.0.0.1:33873",
    siteUrl: "http://127.0.0.1:33874",
  },
}));
const id = "019a1000-0000-7000-8000-000000000001";
function req(
  path: string,
  method: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(`http://127.0.0.1:33874/api/admin/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:33874",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  mocks.token = "qa-cookie";
  mocks.fetch.mockReset();
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());
it("sin cookie y cross-site rechaza antes de llamar backend", async () => {
  mocks.token = "";
  expect((await createUser(req("users", "POST", {}))).status).toBe(401);
  mocks.token = "qa-cookie";
  expect(
    (
      await createUser(
        req("users", "POST", {}, { Origin: "http://external.invalid" }),
      )
    ).status,
  ).toBe(403);
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("PUT específico conserva RBAC backend, CSRF y descarta campos extra de la respuesta", async () => {
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        roleId: id,
        roleName: "Consulta",
        roleSlug: "reader",
        permissions: ["users.read"],
        privateExtra: "SHOULD_NOT_SURVIVE",
      }),
      { status: 200 },
    ),
  );
  const response = await assignPermissions(
    req(`roles/${id}/permissions`, "PUT", { permissionSlugs: ["users.read"] }),
    { params: Promise.resolve({ id }) },
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    roleId: id,
    permissions: ["users.read"],
  });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(String(mocks.fetch.mock.calls[0][0])).toBe(
    `http://127.0.0.1:33873/api/v1/admin/roles/${id}/permissions`,
  );
  expect(mocks.fetch.mock.calls[0][1].method).toBe("PUT");
});
for (const body of [
  { general: { storeName: "JL", privateKey: "BAD" } },
  { shipping: { provider: "real" } },
  { general: { storeName: "" } },
  { general: { storeName: "JL" }, security: { twoFactor: false } },
])
  it("configuración rechaza campos ajenos al dato público permitido", async () => {
    expect((await updateSettings(req("settings", "PATCH", body))).status).toBe(
      400,
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
it("no acepta una máscara de email ni propiedades de privilegios al crear usuario", async () => {
  expect(
    (
      await createUser(
        req("users", "POST", {
          fullName: "Usuario",
          email: "op***@example.test",
          password: "synthetic-long-password",
          roleId: id,
        }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await createUser(
        req("users", "POST", {
          fullName: "Usuario",
          email: "operator@example.test",
          password: "synthetic-long-password",
          roleId: id,
          isActive: true,
        }),
      )
    ).status,
  ).toBe(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
for (const status of [400, 401, 403, 404, 409, 500])
  it(`mantiene el status backend ${status} y no retransmite mensaje arbitrario`, async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ message: "SENSITIVE_ARBITRARY_DETAIL" }), {
        status,
      }),
    );
    const response = await assignPermissions(
      req("roles/x/permissions", "PUT", { permissionSlugs: ["users.read"] }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(status);
    expect(JSON.stringify(await response.json())).not.toContain(
      "SENSITIVE_ARBITRARY_DETAIL",
    );
    expect(mocks.fetch).toHaveBeenCalledOnce();
  });
it("respuesta de éxito malformada falla cerrada con 502", async () => {
  mocks.fetch.mockResolvedValue(new Response("{}", { status: 201 }));
  expect(
    (
      await assignPermissions(
        req("roles/x/permissions", "PUT", { permissionSlugs: ["users.read"] }),
        { params: Promise.resolve({ id }) },
      )
    ).status,
  ).toBe(502);
});
it("auditoría proyecta sólo contrato y sanea datos de cambios anidados", async () => {
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        id,
        actorUserId: id,
        action: "users.admin.updated",
        entityType: "user",
        entityId: id,
        createdAt: "2026-10-11T00:00:00Z",
        beforeData: null,
        afterData: {
          email: "private@example.test",
          fullName: "Private Name",
          role: { slug: "reader" },
          nested: { password: "BAD" },
        },
        ipAddress: "PRIVATE",
        unknownSeed: "BAD",
      }),
      { status: 200 },
    ),
  );
  const response = await auditDetail(
    new Request("http://127.0.0.1:33874/api/admin/audit/" + id),
    { params: Promise.resolve({ id }) },
  );
  const body = await response.json();
  expect(body.afterData).toEqual({
    email: "[REDACTED]",
    fullName: "[REDACTED]",
    role: { slug: "reader" },
    nested: { password: "[REDACTED]" },
  });
  expect(body).not.toHaveProperty("ipAddress");
  expect(body).not.toHaveProperty("unknownSeed");
});
it("validación de providers es un único POST local con cuerpo vacío", async () => {
  const p = { provider: "none", ready: false, configured: { email: false } };
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        valid: true,
        failures: [],
        providers: { payments: p, shipping: p, notifications: p },
        secretExtra: "BAD",
      }),
      { status: 201 },
    ),
  );
  const response = await validateProviders(
    req("settings/providers/validate", "POST", {}),
  );
  expect(response.status).toBe(201);
  expect(await response.json()).not.toHaveProperty("secretExtra");
  expect(mocks.fetch).toHaveBeenCalledOnce();
  expect(String(mocks.fetch.mock.calls[0][0])).toContain(
    "/api/v1/admin/settings/providers/validate",
  );
});
it("lectura de settings sólo informa configuración de filas secretas", async () => {
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        persisted: [
          {
            id,
            key: "payments.privateKey",
            category: "payments",
            isSecret: true,
            isEditableFromAdmin: false,
            value: { configured: true },
            updatedAt: "2026-10-11T00:00:00Z",
          },
        ],
        general: { storeName: "JL", currency: "COP" },
        extra: "BAD",
      }),
      { status: 200 },
    ),
  );
  const response = await readSettings(
    new Request("http://127.0.0.1:33874/api/admin/settings"),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).not.toHaveProperty("extra");
});
it("lista de auditoría sanea también before/after si upstream devuelve datos sensibles inesperados", async () => {
  const { GET } = await import("@/app/api/admin/audit/route");
  mocks.fetch.mockResolvedValue(
    new Response(
      JSON.stringify({
        data: [
          {
            id,
            actorUserId: id,
            action: "users.admin.updated",
            entityType: "user",
            entityId: id,
            createdAt: "2026-10-11T00:00:00Z",
            beforeData: { email: "UNEXPECTED_PRIVATE_CONTACT" },
            afterData: { nested: { password: "UNEXPECTED_PRIVATE_VALUE" } },
            ipAddress: "UNEXPECTED_PRIVATE_IP",
          },
        ],
      }),
      { status: 200 },
    ),
  );
  const response = await GET(
    new Request("http://127.0.0.1:33874/api/admin/audit"),
  );
  expect(response.status).toBe(200);
  const text = JSON.stringify(await response.json());
  expect(text).not.toContain("UNEXPECTED_PRIVATE");
  expect(text).toContain("[REDACTED]");
});
