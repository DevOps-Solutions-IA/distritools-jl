import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/admin/payments/[id]/refresh-status/route";
const { cookieGet } = vi.hoisted(() => ({ cookieGet: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock("@/config/env", () => ({ env: { apiBaseUrl: "http://localhost:33763", siteUrl: "http://localhost:33764" } }));
const id = "00000000-0000-4000-8000-000000000001";
const message = "No se consultó proveedor externo porque PSE no está configurado.";
const normal = { id, status: "pending", refreshed: false, operationalState: { status: "provider_not_configured", message } };
const fetchMock = vi.fn();
function request(body = "{}", origin = "http://localhost:33764", contentType = "application/json") {
  return new Request(`http://localhost:33764/api/admin/payments/${id}/refresh-status`, { method: "POST", headers: { origin, "Content-Type": contentType }, body });
}
async function call(payload: unknown = normal, status = 201, req = request(), targetId = id) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status }));
  return POST(req, { params: Promise.resolve({ id: targetId }) });
}
beforeEach(() => { cookieGet.mockReturnValue({ value: "test-only-token" }); fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); });
describe("SALE refresh server boundary", () => {
  it("preserves the real blocked-provider response and private no-store", async () => {
    const result = await call(); expect(result.status).toBe(201); expect(await result.json()).toEqual(normal);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-only-token");
  });
  it("projects enriched upstream success without personal or financial fields", async () => {
    const result = await call({ ...normal, customerEmail: "private@example.invalid", amount: "999", gatewayReference: "secret-reference", internal: { token: "private" } });
    expect(result.status).toBe(201); expect(await result.json()).toEqual(normal);
  });
  it.each([
    ["empty", {}], ["mismatched identity", { ...normal, id: "00000000-0000-4000-8000-000000000002" }],
    ["unknown payment status", { ...normal, status: "settled" }], ["refreshed true", { ...normal, refreshed: true }],
    ["configured provider", { ...normal, operationalState: { ...normal.operationalState, status: "ready" } }],
    ["contradictory flag", { ...normal, operationalState: { ...normal.operationalState, configured: true } }],
    ["arbitrary message", { ...normal, operationalState: { ...normal.operationalState, message: "private upstream text" } }],
    ["missing message", { ...normal, operationalState: { status: "provider_not_configured" } }],
  ])("fails closed on %s upstream success", async (_name, payload) => {
    const result = await call(payload); expect(result.status).toBe(502); expect(await result.json()).toMatchObject({ kind: "contract_error" });
    expect(result.headers.get("cache-control")).toBe("private, no-store");
  });
  it.each(["pending", "approved", "rejected", "expired", "refunded"])("accepts existing payment status %s without changing it", async (status) => {
    expect(await (await call({ ...normal, status })).json()).toEqual({ ...normal, status });
  });
  it.each([401, 403, 404, 500])("preserves normalized upstream error %i", async (status) => {
    const result = await call({ message: "private upstream text", amount: "999" }, status); expect(result.status).toBe(status);
    expect(JSON.stringify(await result.json())).not.toContain("private upstream text");
  });
  it("requires authentication and same-site origin before contacting backend", async () => {
    cookieGet.mockReturnValue(undefined); expect((await call()).status).toBe(401); expect(fetchMock).not.toHaveBeenCalled();
    cookieGet.mockReturnValue({ value: "test-only-token" }); expect((await call(normal, 201, request("{}", "https://evil.invalid"))).status).toBe(403); expect(fetchMock).not.toHaveBeenCalled();
  });
  it.each(["{", "null", "[]", '{"status":"approved"}', '{"providerToken":"secret"}'])("rejects invalid request body %s before backend", async (body) => {
    expect((await call(normal, 201, request(body))).status).toBe(400); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("accepts empty body but rejects non-JSON payload and invalid identifier", async () => {
    expect((await call(normal, 201, request(""))).status).toBe(201);
    fetchMock.mockClear(); expect((await call(normal, 201, request("{}", undefined, "text/plain"))).status).toBe(400); expect(fetchMock).not.toHaveBeenCalled();
    expect((await call(normal, 201, request(), "not-a-uuid")).status).toBe(400); expect(fetchMock).not.toHaveBeenCalled();
  });
});
