import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { crmRequest } from "@/features/admin/quotes/contracts";
import { crmRead } from "@/features/admin/quotes/CrmFrame";
import { QuoteActions } from "@/features/admin/quotes/QuoteActions";
import { CreateQuoteForm } from "@/features/admin/quotes/CreateQuoteForm";
import { CustomerActions } from "@/features/admin/customers/CustomerActions";
import { adminFetch } from "@/lib/admin/server-data";
const router = { refresh: vi.fn(), push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/admin/server-data", async (original) => ({
  ...(await original<typeof import("@/lib/admin/server-data")>()),
  adminFetch: vi.fn(),
}));
const customer = {
  id: "customer-a",
  fullName: "Synthetic customer",
  email: "private@example.invalid",
  consents: [],
};
const quote = {
  id: "quote-a",
  quoteNumber: "QTE-SYNTHETIC",
  status: "quoted",
  customer,
  order: null,
  sentAt: null,
  items: [
    {
      id: "item-a",
      nameSnapshot: "Synthetic item",
      quantity: 1,
      unitPrice: "100.00",
    },
  ],
  timeline: [],
};
const productId = "00000000-0000-4000-8000-000000000004";
const createItem = { productId, nameSnapshot: "Synthetic item", quantity: 1 };
const createdQuote = {
  ...quote,
  id: "00000000-0000-4000-8000-000000000002",
  subtotal: "100.00",
  currency: "COP",
  notes: null,
  internalNotes: null,
  expiresAt: null,
  acceptedAt: null,
  rejectedAt: null,
  convertedAt: null,
  createdAt: "2026-10-11",
  updatedAt: "2026-10-11",
  items: [
    {
      ...quote.items[0],
      productId,
      variantId: null,
      skuSnapshot: null,
      totalPrice: "100.00",
      notes: null,
    },
  ],
};
function respond(data: unknown, status = 201) {
  const fetcher = vi
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify(data), { status }),
    );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("CRM confirmations match the requested resource and canonical effect", () => {
  it.each([200, 201])(
    "rejects another customer even with successful HTTP %i",
    async (status) => {
      const fetcher = respond({ ...customer, id: "customer-b" }, status);
      const result = await crmRequest(
        "/customers/customer-a/view-sensitive",
        "POST",
      );
      expect(result).toMatchObject({
        ok: false,
        kind: "contract_error",
        status,
      });
      expect(result.error).toMatch(/incierto/);
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    "",
    "/price-items",
    "/submit-review",
    "/accept",
    "/reject",
    "/cancel",
    "/send",
    "/convert-to-order",
  ])("rejects another quote at %s", async (action) => {
    const fetcher = respond({ ...quote, id: "quote-b" });
    expect(
      await crmRequest(
        `/quotes/quote-a${action}`,
        action ? "POST" : "PATCH",
        action ? undefined : { notes: "note" },
      ),
    ).toMatchObject({ ok: false, kind: "contract_error" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    ["/price-items", "requested"],
    ["/submit-review", "quoted"],
    ["/accept", "quoted"],
    ["/reject", "accepted"],
    ["/cancel", "requested"],
  ])("rejects incompatible %s status %s", async (action, status) => {
    respond({ ...quote, status });
    expect(await crmRequest(`/quotes/quote-a${action}`, "POST")).toMatchObject({
      ok: false,
      kind: "contract_error",
    });
  });
  it("decodes the selected resource ID without imposing a UUID-only rule", async () => {
    respond({ ...customer, id: "customer/a" });
    expect(
      (
        await crmRequest("/customers/customer%2Fa", "PATCH", {
          city: "Synthetic",
        })
      ).ok,
    ).toBe(true);
  });
  it("rejects create confirmation for another selected customer", async () => {
    respond({ ...createdQuote, customer: { ...customer, id: "customer-b" } });
    expect(
      await crmRequest("/quotes", "POST", {
        customerId: "customer-a",
        items: [{ ...createItem, unitPrice: "100" }],
      }),
    ).toMatchObject({ ok: false, kind: "contract_error" });
  });
  it.each([
    [{}, "requested"],
    [{ unitPrice: "100" }, "quoted"],
  ])(
    "accepts the backend create status derived from submitted pricing",
    async (item, status) => {
      respond({
        ...createdQuote,
        status,
        subtotal: status === "quoted" ? "100.00" : "0.00",
        items: [
          {
            ...createdQuote.items[0],
            unitPrice: status === "quoted" ? "100.00" : null,
            totalPrice: status === "quoted" ? "100.00" : null,
          },
        ],
      });
      expect(
        (
          await crmRequest("/quotes", "POST", {
            customerId: "customer-a",
            items: [{ ...createItem, ...item }],
          })
        ).ok,
      ).toBe(true);
    },
  );
  it.each([
    { ...createdQuote, id: "not-a-resource-uuid" },
    { ...createdQuote, id: "" },
    { ...createdQuote, items: [] },
    {
      ...createdQuote,
      items: [
        {
          ...createdQuote.items[0],
          productId: "00000000-0000-4000-8000-000000000006",
        },
      ],
    },
    { ...createdQuote, items: [{ ...createdQuote.items[0], quantity: 2 }] },
  ])(
    "rejects create confirmations that contradict the newly created ID or requested lines",
    async (payload) => {
      const fetcher = respond(payload);
      expect(
        await crmRequest("/quotes", "POST", {
          customerId: "customer-a",
          items: [{ ...createItem, unitPrice: "100" }],
        }),
      ).toMatchObject({ ok: false, kind: "contract_error" });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it("confirms notes while preserving the canonical expired quote status", async () => {
    const expiredQuote = { ...quote, status: "expired" };
    respond(expiredQuote);
    render(
      <QuoteActions quote={expiredQuote} permissions={["quotes.write"]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar notas" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/confirmado/);
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
  it("accepts created lines in a different returned order without inventing line ordering", async () => {
    const otherProductId = "00000000-0000-4000-8000-000000000007";
    respond({
      ...createdQuote,
      items: [
        { ...createdQuote.items[0], productId: otherProductId, quantity: 2 },
        createdQuote.items[0],
      ],
    });
    expect(
      (
        await crmRequest("/quotes", "POST", {
          customerId: "customer-a",
          items: [
            { ...createItem, unitPrice: "100" },
            { ...createItem, productId: otherProductId, quantity: 2 },
          ],
        })
      ).ok,
    ).toBe(true);
  });
  it("does not use a duplicate returned line to confirm two distinct requested lines", async () => {
    respond({
      ...createdQuote,
      items: [createdQuote.items[0], createdQuote.items[0]],
    });
    expect(
      await crmRequest("/quotes", "POST", {
        customerId: "customer-a",
        items: [
          { ...createItem, unitPrice: "100" },
          {
            ...createItem,
            productId: "00000000-0000-4000-8000-000000000007",
            quantity: 2,
          },
        ],
      }),
    ).toMatchObject({ ok: false, kind: "contract_error" });
  });
  it("rejects note confirmation that changed the known current status", async () => {
    respond({ ...quote, status: "cancelled" });
    render(<QuoteActions quote={quote} permissions={["quotes.write"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar notas" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/incierto/);
    expect(router.refresh).not.toHaveBeenCalled();
  });
  it("confirms notes that preserve the known current status", async () => {
    respond(quote);
    render(<QuoteActions quote={quote} permissions={["quotes.write"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar notas" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("status")).toHaveTextContent(/confirmado/);
  });
  it("does not display another customer's sensitive data or an audited success", async () => {
    respond({
      ...customer,
      id: "customer-b",
      email: "foreign@example.invalid",
    });
    render(
      <CustomerActions
        id="customer-a"
        permissions={["customers.read_sensitive"]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Consultar datos sensibles con auditoría",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(/incierto/);
    expect(
      screen.queryByLabelText("Datos sensibles consultados"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("foreign@example.invalid"),
    ).not.toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });
  it("clears a prior reveal when the next confirmation belongs to another customer", async () => {
    const fetcher = respond(customer);
    render(
      <CustomerActions
        id="customer-a"
        permissions={["customers.read_sensitive"]}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Consultar datos sensibles con auditoría",
      }),
    );
    await screen.findByText(customer.email);
    fetcher.mockImplementation(
      async () =>
        new Response(JSON.stringify({ ...customer, id: "customer-b" }), {
          status: 201,
        }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Consultar datos sensibles con auditoría",
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(/incierto/),
    );
    expect(
      screen.queryByLabelText("Datos sensibles consultados"),
    ).not.toBeInTheDocument();
  });
  it("does not navigate after creating a quote for a different selected customer", async () => {
    const selected = "00000000-0000-4000-8000-000000000001";
    const fetcher = respond({
      ...createdQuote,
      status: "requested",
      customer: { ...customer, id: "another" },
    });
    render(<CreateQuoteForm />);
    fireEvent.change(
      screen.getByLabelText("ID de cliente existente (opcional)"),
      { target: { value: selected } },
    );
    fireEvent.change(screen.getByLabelText("ID real de producto"), {
      target: { value: productId },
    });
    fireEvent.change(screen.getByLabelText("Descripción de la línea"), {
      target: { value: "Synthetic item" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Crear cotización" }).closest("form")!,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/incierto/);
    expect(router.push).not.toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("does not echo an incompatible delivery confirmation", async () => {
    respond({
      ...quote,
      status: "sent",
      operationalState: { status: "sent", message: "DELIVERED_SYNTHETIC" },
    });
    render(<QuoteActions quote={quote} permissions={["quotes.write"]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar envío manual pendiente" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/incierto/);
    expect(screen.queryByText("DELIVERED_SYNTHETIC")).not.toBeInTheDocument();
    expect(router.refresh).not.toHaveBeenCalled();
  });
  it("preserves the canonical pending manual send message", async () => {
    respond({
      ...quote,
      operationalState: {
        status: "pending_manual_send",
        message: "Envío manual pendiente, sin entrega confirmada.",
      },
    });
    render(<QuoteActions quote={quote} permissions={["quotes.write"]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar envío manual pendiente" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Envío manual pendiente, sin entrega confirmada.",
    );
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
  it("keeps manual send pending when the producer preserves a historical sentAt", async () => {
    respond({
      ...quote,
      sentAt: "2025-01-01T00:00:00.000Z",
      operationalState: {
        status: "pending_manual_send",
        message: "Envío manual pendiente; no confirma una entrega nueva.",
      },
    });
    render(<QuoteActions quote={quote} permissions={["quotes.write"]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Registrar envío manual pendiente" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Envío manual pendiente; no confirma una entrega nueva.",
    );
    expect(router.refresh).toHaveBeenCalledTimes(1);
  });
  it.each([
    { ...quote, status: "converted_to_order" },
    {
      ...quote,
      operationalState: {
        status: "manual_order_creation_required",
        message: "Manual",
      },
    },
    {
      ...quote,
      status: "converted_to_order",
      order: { id: "order-a" },
      operationalState: {
        status: "manual_order_creation_required",
        message: "Manual",
      },
    },
    {
      ...quote,
      status: "converted_to_order",
      alreadyConverted: true,
      order: null,
    },
  ])(
    "rejects conversion without its canonical manual or existing-order outcome",
    async (payload) => {
      respond(payload);
      expect(
        await crmRequest("/quotes/quote-a/convert-to-order", "POST"),
      ).toMatchObject({ ok: false, kind: "contract_error" });
    },
  );
  it("accepts the real alreadyConverted branch with an existing order", async () => {
    respond({
      ...quote,
      status: "converted_to_order",
      alreadyConverted: true,
      order: { id: "order-a", orderNumber: "ORD-SYNTHETIC", status: "pending" },
    });
    expect(
      (await crmRequest("/quotes/quote-a/convert-to-order", "POST")).ok,
    ).toBe(true);
  });
  it.each(["quotes", "customers"])(
    "rejects another detail resource at /admin/%s",
    async (resource) => {
      vi.mocked(adminFetch).mockResolvedValue({
        ok: true,
        kind: "success",
        status: 200,
        data:
          resource === "quotes"
            ? { ...quote, id: "foreign" }
            : { ...customer, id: "foreign" },
        error: null,
      });
      await expect(
        crmRead(
          `/admin/${resource}/${resource === "quotes" ? "quote-a" : "customer-a"}`,
        ),
      ).rejects.toMatchObject({ result: { kind: "contract_error" } });
    },
  );
  it("decodes the detail path while accepting the same actual ID", async () => {
    vi.mocked(adminFetch).mockResolvedValue({
      ok: true,
      kind: "success",
      status: 200,
      data: { ...customer, id: "customer/a" },
      error: null,
    });
    expect(await crmRead("/admin/customers/customer%2Fa")).toMatchObject({
      id: "customer/a",
    });
  });
  it("keeps paginated relationship contracts without inventing a parent ID", async () => {
    const data = {
      data: [{ id: "order-a" }],
      meta: { page: 1, limit: 20, total: 1 },
    };
    vi.mocked(adminFetch).mockResolvedValue({
      ok: true,
      kind: "success",
      status: 200,
      data,
      error: null,
    });
    expect(await crmRead("/admin/customers/customer-a/orders?page=1")).toEqual(
      data,
    );
  });
});
