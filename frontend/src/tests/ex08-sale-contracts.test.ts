import { afterEach, describe, expect, it, vi } from "vitest";
import {
  paymentSchema,
  ordersSchema,
  formatMoney,
} from "@/features/admin/orders/contracts";
import { mutateSale } from "@/features/admin/orders/transport";
const id = "00000000-0000-4000-8000-000000000001";
afterEach(() => vi.unstubAllGlobals());
describe("SALE contracts and outcomes", () => {
  it("rejects incomplete identity and strips provider raw payload", () => {
    const body = {
      id,
      orderId: id,
      gateway: "pse",
      gatewayReference: "reference",
      transactionId: null,
      amount: "1000.00",
      currency: "COP",
      status: "pending",
      confirmedAt: null,
      expiresAt: null,
      createdAt: "2026-10-11",
      updatedAt: "2026-10-11",
      rawPayload: { secret: "never-render" },
    };
    expect(paymentSchema.parse(body)).not.toHaveProperty("rawPayload");
    expect(
      paymentSchema.safeParse({ ...body, status: "fake_success" }).success,
    ).toBe(false);
    expect(
      paymentSchema.safeParse({ ...body, orderId: undefined }).success,
    ).toBe(false);
  });
  it("preserves masking and requires real pagination", () => {
    expect(formatMoney("NO_PERMISSION")).toBe("Importe protegido");
    expect(
      ordersSchema.safeParse({
        data: [],
        meta: { page: 1, limit: 20, total: 0 },
      }).success,
    ).toBe(true);
    expect(
      ordersSchema.safeParse({
        data: [],
        meta: { page: 0, limit: 20, total: 0 },
      }).success,
    ).toBe(false);
  });
  it.each([
    [401, "auth_required"],
    [403, "forbidden"],
    [400, "validation_error"],
    [422, "validation_error"],
    [404, "not_found"],
    [409, "conflict"],
    [500, "server_error"],
  ] as const)("distinguishes rejected %s", async (status, kind) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "Invalid action" }), {
          status,
        }),
      ),
    );
    expect(
      (
        await mutateSale(
          `/api/admin/payments/${id}/reconcile-cod`,
          {},
          { kind: "cod", id },
        )
      ).kind,
    ).toBe(kind);
  });
  it("cannot claim success for transport loss or malformed success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    expect(
      (
        await mutateSale(
          `/api/admin/payments/${id}/reconcile-cod`,
          {},
          { kind: "cod", id },
        )
      ).kind,
    ).toBe("uncertain");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ kind: "contract_error" }), {
          status: 502,
        }),
      ),
    );
    expect(
      (
        await mutateSale(
          `/api/admin/payments/${id}/reconcile-cod`,
          {},
          { kind: "cod", id },
        )
      ).kind,
    ).toBe("uncertain");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ kind: "network_error" }), {
          status: 502,
        }),
      ),
    );
    expect(
      (
        await mutateSale(
          `/api/admin/payments/${id}/reconcile-cod`,
          {},
          { kind: "cod", id },
        )
      ).kind,
    ).toBe("uncertain");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 201 })),
    );
    expect(
      (
        await mutateSale(
          `/api/admin/payments/${id}/reconcile-cod`,
          {},
          { kind: "cod", id },
        )
      ).kind,
    ).toBe("uncertain");
  });
  it("sends exact COD input and validates confirmation", async () => {
    const send = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id, status: "approved", alreadyReconciled: true }),
          { status: 201 },
        ),
      );
    vi.stubGlobal("fetch", send);
    expect(
      (
        await mutateSale(
          `/api/admin/payments/${id}/reconcile-cod`,
          {
            reference: "receipt-1",
            note: "Received",
          },
          { kind: "cod", id },
        )
      ).ok,
    ).toBe(true);
    expect(send).toHaveBeenCalledWith(
      `/api/admin/payments/${id}/reconcile-cod`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reference: "receipt-1", note: "Received" }),
      }),
    );
  });
});

describe("SALE write validation", () => {
  it("rejects blank, object, overlong and unknown fields before mutation", async () => {
    const { cancelPayloadSchema, codPayloadSchema } =
      await import("@/features/admin/orders/proxy-write");
    expect(cancelPayloadSchema.safeParse({ reason: "   " }).success).toBe(
      false,
    );
    expect(
      cancelPayloadSchema.safeParse({ reason: { message: "not text" } })
        .success,
    ).toBe(false);
    expect(
      cancelPayloadSchema.safeParse({ reason: "x".repeat(501) }).success,
    ).toBe(false);
    expect(
      cancelPayloadSchema.safeParse({ reason: "valid", status: "paid" })
        .success,
    ).toBe(false);
    expect(
      codPayloadSchema.safeParse({
        reference: "receipt",
        note: "received",
        approved: true,
      }).success,
    ).toBe(false);
    expect(
      codPayloadSchema.parse({ reference: " receipt ", note: " received " }),
    ).toEqual({ reference: "receipt", note: "received" });
  });
});

describe("SALE mutation response projection", () => {
  it("does not carry customer or financial fields from canonical cancel response", async () => {
    const { mutationConfirmationSchema } =
      await import("@/features/admin/orders/contracts");
    expect(
      mutationConfirmationSchema.parse({
        id,
        status: "cancelled",
        customerName: "private",
        grandTotal: "100",
        orderNumber: "ORDER",
      }),
    ).toEqual({ id, status: "cancelled" });
    expect(
      mutationConfirmationSchema.safeParse({ id, status: "paid" }).success,
    ).toBe(false);
  });
});


describe("SALE currency rendering boundary", () => {
  const payment = {
    id,
    orderId: id,
    gateway: "cash_on_delivery",
    gatewayReference: "synthetic-reference",
    transactionId: null,
    amount: "1000.00",
    currency: "COP",
    status: "pending",
    confirmedAt: null,
    expiresAt: null,
    createdAt: "2026-10-11",
    updatedAt: "2026-10-11",
  };
  const row = {
    id,
    orderId: id,
    orderNumber: "SYNTHETIC_ORDER",
    gateway: "cash_on_delivery",
    status: "pending",
    amount: "1000.00",
    currency: "COP",
    providerReference: null,
    createdAt: "2026-10-11",
  };

  it.each(["", "INVALID"])(
    "rejects currency %j before payment views can format it",
    async (currency) => {
      const { paymentRowSchema } =
        await import("@/features/admin/orders/contracts");
      expect(() => formatMoney(payment.amount, currency)).toThrow(RangeError);
      expect(paymentSchema.safeParse({ ...payment, currency }).success).toBe(false);
      expect(paymentRowSchema.safeParse({ ...row, currency }).success).toBe(false);
    },
  );

  it.each(["COP", "usd", "EUR", "XYZ"])(
    "preserves renderable currency %s and amounts without conversion",
    async (currency) => {
      const { paymentRowSchema } =
        await import("@/features/admin/orders/contracts");
      const parsedPayment = paymentSchema.parse({ ...payment, currency });
      const parsedRow = paymentRowSchema.parse({ ...row, currency });
      expect(parsedPayment.currency).toBe(currency);
      expect(parsedRow.currency).toBe(currency);
      expect(parsedPayment.amount).toBe(payment.amount);
      expect(parsedRow.amount).toBe(row.amount);
      expect(() => formatMoney(parsedPayment.amount, parsedPayment.currency)).not.toThrow();
      expect(() => formatMoney(parsedRow.amount, parsedRow.currency)).not.toThrow();
    },
  );

  it("preserves NO_PERMISSION amounts and their protected rendering", async () => {
    const { paymentRowSchema } =
      await import("@/features/admin/orders/contracts");
    const parsedPayment = paymentSchema.parse({ ...payment, amount: "NO_PERMISSION" });
    const parsedRow = paymentRowSchema.parse({ ...row, amount: "NO_PERMISSION" });
    expect(parsedPayment.amount).toBe("NO_PERMISSION");
    expect(parsedRow.amount).toBe("NO_PERMISSION");
    expect(formatMoney(parsedPayment.amount, parsedPayment.currency)).toBe("Importe protegido");
    expect(formatMoney(parsedRow.amount, parsedRow.currency)).toBe("Importe protegido");
    expect(formatMoney("NO_PERMISSION", "INVALID")).toBe("Importe protegido");
  });

  it.each(["", "INVALID"])(
    "rejects unrenderable currency %j inside payment collection reads",
    async (currency) => {
      const { paymentsSchema } =
        await import("@/features/admin/orders/contracts");
      expect(paymentsSchema.safeParse({
        data: [{ ...row, currency }],
        meta: { page: 1, limit: 20, total: 1 },
      }).success).toBe(false);
    },
  );
});
