import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { POST as cancel } from "@/app/api/admin/orders/[orderNumber]/cancel/route";
import { POST as cod } from "@/app/api/admin/payments/[id]/reconcile-cod/route";
import { mutateSale } from "@/features/admin/orders/transport";
import { MutationForm } from "@/features/admin/orders/MutationForm";
const { cookieGet, refresh } = vi.hoisted(() => ({
  cookieGet: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGet }) }));
vi.mock("@/config/env", () => ({
  env: {
    apiBaseUrl: "http://localhost:34601",
    siteUrl: "http://localhost:34602",
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const id = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
const orderNumber = "SYNTHETIC-ORDER-001";
const fetchMock = vi.fn();
const input = {
  cancel: { reason: "Synthetic cancellation" },
  cod: { reference: "Synthetic receipt", note: "Synthetic received" },
};
type Kind = "cancel" | "cod";
function url(kind: Kind) {
  return kind === "cancel"
    ? `/api/admin/orders/${orderNumber}/cancel`
    : `/api/admin/payments/${id}/reconcile-cod`;
}
function request(
  kind: Kind,
  origin = "http://localhost:34602",
  body = JSON.stringify(input[kind]),
) {
  return new Request("http://localhost:34602" + url(kind), {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body,
  });
}
async function call(
  kind: Kind,
  payload: unknown,
  status = 201,
  req = request(kind),
) {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify(payload), { status }),
  );
  return kind === "cancel"
    ? cancel(req, { params: Promise.resolve({ orderNumber }) })
    : cod(req, { params: Promise.resolve({ id }) });
}
const validCancel = { id, orderNumber, status: "cancelled" };
const validCod = { id, status: "approved" };
beforeEach(() => {
  cookieGet.mockReturnValue({ value: "synthetic-boundary-jwt" });
  fetchMock.mockReset();
  refresh.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
describe("SALE operation and target confirmation, real BFF/client with mocked upstream only", () => {
  it.each([
    ["cancel", "opposite status", { ...validCancel, status: "approved" }],
    [
      "cancel",
      "wrong canonical number",
      { ...validCancel, orderNumber: "OTHER-ORDER" },
    ],
    ["cancel", "missing canonical number", { id, status: "cancelled" }],
    ["cancel", "blank canonical number", { ...validCancel, orderNumber: "" }],
    ["cancel", "nontext canonical number", { ...validCancel, orderNumber: {} }],
    ["cod", "opposite status", { ...validCod, status: "cancelled" }],
    ["cod", "other UUID", { ...validCod, id: otherId }],
    [
      "cod",
      "other idempotent UUID",
      { ...validCod, id: otherId, alreadyReconciled: true },
    ],
    ["cod", "missing UUID", { status: "approved" }],
    ["cod", "unknown status", { ...validCod, status: "settled" }],
  ] as const)(
    "rejects %s %s without claiming mutation success",
    async (kind, _name, payload) => {
      const response = await call(kind, payload);
      expect(response.status).toBe(502);
      expect(await response.json()).toEqual({
        kind: "contract_error",
        message: "No se pudo confirmar el resultado de la operación.",
      });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["cancel", "cod"] as const)(
    "accepts exact %s result and strips enriched private data",
    async (kind) => {
      const response = await call(kind, {
        ...(kind === "cancel" ? validCancel : validCod),
        customerEmail: "private@example.invalid",
        amount: "PRIVATE_FINANCE",
        rawPayload: { token: "PRIVATE_TOKEN" },
      });
      expect(response.status).toBe(201);
      expect(await response.json()).toEqual({
        id,
        status: kind === "cancel" ? "cancelled" : "approved",
      });
      expect(fetchMock.mock.calls[0][0]).toBe(
        "http://localhost:34601/api/v1" +
          (kind === "cancel"
            ? `/admin/orders/${orderNumber}/cancel`
            : `/admin/payments/${id}/reconcile-cod`),
      );
      expect(fetchMock.mock.calls[0][1]).toMatchObject({
        method: "POST",
        cache: "no-store",
        headers: { Authorization: "Bearer synthetic-boundary-jwt" },
        body: JSON.stringify(input[kind]),
      });
    },
  );
  it("accepts already reconciled only for the exact approved COD target", async () => {
    const response = await call("cod", {
      ...validCod,
      alreadyReconciled: true,
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      ...validCod,
      alreadyReconciled: true,
    });
  });
  it.each([401, 403, 404, 409, 429, 500])(
    "preserves normalized upstream error %i",
    async (status) => {
      const response = await call(
        "cod",
        { message: "PRIVATE_TOKEN", amount: "PRIVATE_FINANCE" },
        status,
      );
      expect(response.status).toBe(status);
      expect(JSON.stringify(await response.json())).not.toContain("PRIVATE_");
    },
  );
  it.each(["cancel", "cod"] as const)(
    "keeps actual %s proxy authentication and origin fences",
    async (kind) => {
      cookieGet.mockReturnValue(undefined);
      expect(
        (await call(kind, kind === "cancel" ? validCancel : validCod)).status,
      ).toBe(401);
      expect(fetchMock).not.toHaveBeenCalled();
      cookieGet.mockReturnValue({ value: "synthetic-boundary-jwt" });
      expect(
        (await call(kind, validCod, 201, request(kind, "https://evil.invalid")))
          .status,
      ).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("does not turn a mocked current-JWT403 into confirmation and forwards the same token", async () => {
    expect((await call("cod", validCod)).status).toBe(201);
    expect((await call("cod", { message: "revoked" }, 403)).status).toBe(403);
    expect(fetchMock.mock.calls.map((c) => c[1].headers.Authorization)).toEqual(
      ["Bearer synthetic-boundary-jwt", "Bearer synthetic-boundary-jwt"],
    );
  });
  it.each(["cancel", "cod"] as const)(
    "rejects invalid %s request before any backend call",
    async (kind) => {
      expect(
        (
          await call(
            kind,
            validCod,
            201,
            request(kind, undefined, '{"status":"approved"}'),
          )
        ).status,
      ).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );
  it("preserves malformed upstream JSON as unconfirmed502", async () => {
    fetchMock.mockResolvedValue(new Response("{", { status: 201 }));
    const response = await cod(request("cod"), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(502);
    expect((await response.json()).kind).toBe("contract_error");
  });
  it.each([
    ["cancel", { id, status: "approved" }],
    ["cancel", { id: otherId, status: "cancelled" }],
    ["cod", { id, status: "cancelled" }],
    ["cod", { id: otherId, status: "approved" }],
    ["cod", { id: otherId, status: "approved", alreadyReconciled: true }],
  ] as const)(
    "client marks wrong %s operation/identity uncertain without retry",
    async (kind, payload) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(payload), { status: 201 }),
      );
      const result = await mutateSale(url(kind), input[kind], { kind, id });
      expect(result.ok).toBe(false);
      expect(result.kind).toBe("uncertain");
      expect(result.data).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
  it.each(["cancel", "cod"] as const)(
    "client confirms only the current exact %s target",
    async (kind) => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            id,
            status: kind === "cancel" ? "cancelled" : "approved",
            customerEmail: "PRIVATE",
          }),
          { status: 201 },
        ),
      );
      const result = await mutateSale(url(kind), input[kind], { kind, id });
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({
        id,
        status: kind === "cancel" ? "cancelled" : "approved",
      });
    },
  );
  it("client502 and transport loss remain uncertain with no automatic retry", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ kind: "contract_error" }), { status: 502 }),
    );
    expect(
      (await mutateSale(url("cod"), input.cod, { kind: "cod", id })).kind,
    ).toBe("uncertain");
    fetchMock.mockRejectedValue(new TypeError("Synthetic network loss"));
    expect(
      (await mutateSale(url("cod"), input.cod, { kind: "cod", id })).kind,
    ).toBe("uncertain");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each(["cancel", "cod"] as const)(
    "GUI rejects wrong %s target, never refreshes and blocks blind retry",
    async (kind) => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            id: otherId,
            status: kind === "cancel" ? "cancelled" : "approved",
          }),
          { status: 201 },
        ),
      );
      render(
        createElement(
          MutationForm,
          kind === "cancel"
            ? { kind, id: orderNumber, expectedId: id }
            : { kind, id },
        ),
      );
      const title = kind === "cancel" ? "Cancelar pedido" : "Conciliar COD";
      if (kind === "cancel")
        fireEvent.change(screen.getByLabelText("Motivo"), {
          target: { value: "Synthetic cancellation" },
        });
      else {
        fireEvent.change(screen.getByLabelText("Referencia de recaudo"), {
          target: { value: "Synthetic receipt" },
        });
        fireEvent.change(screen.getByLabelText("Nota de conciliación"), {
          target: { value: "Synthetic received" },
        });
      }
      fireEvent.click(screen.getByRole("button", { name: title }));
      fireEvent.click(
        screen.getByRole("button", {
          name: "Confirmar " + title.toLowerCase(),
        }),
      );
      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Resultado incierto",
        ),
      );
      expect(refresh).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: title })).toBeDisabled();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
});
