import { beforeEach, describe, expect, it, vi } from "vitest";
import { proxyAdminRequest } from "@/lib/admin/proxy";
import {
  cancelPayloadSchema,
  codPayloadSchema,
  saleProxyWrite,
} from "@/features/admin/orders/proxy-write";
vi.mock("@/lib/admin/proxy", () => ({ proxyAdminRequest: vi.fn() }));
beforeEach(() => vi.mocked(proxyAdminRequest).mockReset());
describe("SALE dedicated BFF contract", () => {
  it("rejects malformed/blank/unknown fields without contacting backend", async () => {
    for (const value of [
      { reason: "" },
      { reason: [] },
      { reason: "x", status: "paid" },
    ]) {
      const result = await saleProxyWrite(
        new Request("http://localhost/api/admin/orders/ORDER/cancel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        }),
        "/admin/orders/ORDER/cancel",
        cancelPayloadSchema,
        { kind: "cancel", orderNumber: "ORDER" },
      );
      expect(result.status).toBe(400);
    }
    expect(proxyAdminRequest).not.toHaveBeenCalled();
  });
  it("uses canonical number path and strips personal/financial cancel fields", async () => {
    vi.mocked(proxyAdminRequest).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "00000000-0000-4000-8000-000000000001",
          status: "cancelled",
          orderNumber: "ORDER-1",
          customerName: "sensitive",
          grandTotal: "1000",
        }),
        { status: 201 },
      ) as never,
    );
    const result = await saleProxyWrite(
      new Request("http://localhost/api/admin/orders/ORDER-1/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify({ reason: " cancel " }),
      }),
      "/admin/orders/ORDER-1/cancel",
      cancelPayloadSchema,
      { kind: "cancel", orderNumber: "ORDER-1" },
    );
    expect(await result.json()).toEqual({
      id: "00000000-0000-4000-8000-000000000001",
      status: "cancelled",
    });
    expect(proxyAdminRequest).toHaveBeenCalledWith(
      expect.any(Request),
      "/admin/orders/ORDER-1/cancel",
      "POST",
    );
    const forwarded = vi.mocked(proxyAdminRequest).mock.calls[0][0];
    expect(await forwarded.json()).toEqual({ reason: "cancel" });
    expect(forwarded.headers.get("origin")).toBe("http://localhost");
  });
  it("preserves authorization error without treating it as empty success", async () => {
    vi.mocked(proxyAdminRequest).mockResolvedValue(
      new Response(JSON.stringify({ kind: "forbidden" }), {
        status: 403,
      }) as never,
    );
    const result = await saleProxyWrite(
      new Request("http://localhost/api/admin/payments/id/reconcile-cod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: "r", note: "received" }),
      }),
      "/admin/payments/id/reconcile-cod",
      codPayloadSchema,
      { kind: "cod", id: "00000000-0000-4000-8000-000000000001" },
    );
    expect(result.status).toBe(403);
    expect((await result.json()).kind).toBe("forbidden");
  });
  it("treats malformed committed reply as unconfirmed", async () => {
    vi.mocked(proxyAdminRequest).mockResolvedValue(
      new Response("{}", { status: 201 }) as never,
    );
    const result = await saleProxyWrite(
      new Request("http://localhost/api/admin/payments/id/reconcile-cod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: "r", note: "received" }),
      }),
      "/admin/payments/id/reconcile-cod",
      codPayloadSchema,
      { kind: "cod", id: "00000000-0000-4000-8000-000000000001" },
    );
    expect(result.status).toBe(502);
    expect((await result.json()).kind).toBe("contract_error");
  });
});
