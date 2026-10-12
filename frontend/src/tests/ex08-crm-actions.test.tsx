import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QuoteActions } from "@/features/admin/quotes/QuoteActions";
import {
  ExportCustomers,
  CustomerActions,
} from "@/features/admin/customers/CustomerActions";
const router = { refresh: vi.fn(), replace: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const quote = {
  id: "q1",
  quoteNumber: "QTE-1",
  status: "quoted",
  items: [
    { id: "own", nameSnapshot: "Taladro", quantity: 3, unitPrice: "100.00" },
  ],
  notes: "n",
};
describe("CRM authorized controls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });
  it("does not grant write or approve or convert from read permission", () => {
    render(<QuoteActions quote={quote} permissions={["quotes.read"]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("sends only own line with its actual persisted quantity", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ...quote, subtotal: "300.00" }), {
        status: 201,
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<QuoteActions quote={quote} permissions={["quotes.write"]} />);
    fireEvent.click(screen.getByRole("button", { name: "Guardar precios" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      items: [{ id: "own", quantity: 3, unitPrice: "100.00" }],
    });
  });
  it("shows manual conversion message without claiming order creation", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...quote,
            status: "converted_to_order",
            order: null,
            operationalState: {
              status: "manual_order_creation_required",
              message: "Pedido pendiente de creación manual.",
            },
          }),
          { status: 201 },
        ),
      ),
    );
    render(<QuoteActions quote={quote} permissions={["quotes.convert"]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Solicitar conversión a pedido" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Pedido pendiente de creación manual.",
    );
  });
  it("keeps permission failure visible without refresh or success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 403 })),
    );
    render(<QuoteActions quote={quote} permissions={["quotes.convert"]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Solicitar conversión a pedido" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/permiso/);
    expect(router.refresh).not.toHaveBeenCalled();
  });
  it("rejection sends the declared object body rather than undefined", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ...quote, status: "rejected" }), {
          status: 201,
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    render(<QuoteActions quote={quote} permissions={["quotes.approve"]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Rechazar cotización" }),
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(fetcher.mock.calls[0][1].body).toBe("{}");
  });
  it("blocked export produces no file or fake success", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          exported: false,
          operationalState: {
            status: "blocked",
            message: "Política pendiente.",
          },
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<ExportCustomers permissions={["customers.export"]} />);
    fireEvent.click(screen.getByRole("button"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Política pendiente.",
    );
    expect(fetcher.mock.calls[0][0]).toBe("/api/admin/customers/export");
    expect(fetcher.mock.calls[0][1].body).toBeUndefined();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("profile replacement inputs remain blank and only changed value is sent", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "c", fullName: "C***" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetcher);
    render(<CustomerActions id="c" permissions={["customers.notes.write"]} />);
    expect(screen.getByLabelText("Correo nuevo")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Ciudad nueva"), {
      target: { value: "Bogotá" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar perfil" }));
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      city: "Bogotá",
    });
  });
});
