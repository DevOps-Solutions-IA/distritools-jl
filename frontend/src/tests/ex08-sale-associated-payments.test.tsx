import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderPayments } from "@/features/admin/orders/OrderPayments";
import { adminFetch } from "@/lib/admin/server-data";
vi.mock("@/lib/admin/server-data", () => ({ adminFetch: vi.fn() }));
const id = "00000000-0000-4000-8000-000000000001";
describe("Actual scoped payment association", () => {
  it("uses a backend order filter and respects permission", async () => {
    vi.mocked(adminFetch).mockClear();
    render(await OrderPayments({ id, allowed: false }));
    expect(adminFetch).not.toHaveBeenCalled();
    expect(screen.getByText(/Se requiere permiso/)).toBeInTheDocument();
  });
  it("does not invent absence from a failed request", async () => {
    vi.mocked(adminFetch).mockResolvedValue({
      ok: false,
      kind: "server_error",
      status: 500,
      data: null,
      error: "backend failed",
    });
    render(await OrderPayments({ id, allowed: true }));
    expect(adminFetch).toHaveBeenCalledWith(
      `/admin/payments?orderId=${id}&page=1&limit=20`,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("backend failed");
    expect(screen.queryByText(/Sin pagos registrados/)).not.toBeInTheDocument();
  });
  it("renders exact scoped records and a link to all actual paginated results", async () => {
    vi.mocked(adminFetch).mockResolvedValue({
      ok: true,
      kind: "success",
      status: 200,
      error: null,
      data: {
        data: [
          {
            id,
            orderId: id,
            orderNumber: "ORDER",
            gateway: "cash_on_delivery",
            status: "pending",
            amount: "NO_PERMISSION",
            currency: "COP",
            providerReference: "[PROTECTED]",
            createdAt: "2026-10-11",
          },
        ],
        meta: { page: 1, limit: 20, total: 21 },
      },
    });
    render(await OrderPayments({ id, allowed: true }));
    expect(screen.getByRole("link", { name: "Revisar pago" })).toHaveAttribute(
      "href",
      `/admin/pagos/${id}`,
    );
    expect(
      screen.getByRole("link", { name: "Ver todos los pagos del pedido" }),
    ).toHaveAttribute("href", `/admin/pagos?orderId=${id}`);
    expect(screen.getByText(/Importe protegido/)).toBeInTheDocument();
  });
});
