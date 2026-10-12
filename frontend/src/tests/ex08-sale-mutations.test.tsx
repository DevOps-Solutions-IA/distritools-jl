import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MutationForm } from "@/features/admin/orders/MutationForm";
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockClear();
});
describe("COD confirmation", () => {
  it("requires input and confirmation before send", async () => {
    const send = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "00000000-0000-4000-8000-000000000001",
          status: "approved",
        }),
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", send);
    render(
      <MutationForm kind="cod" id="00000000-0000-4000-8000-000000000001" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Conciliar COD" }));
    expect(send).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Referencia de recaudo"), {
      target: { value: "COD-1" },
    });
    fireEvent.change(screen.getByLabelText("Nota de conciliación"), {
      target: { value: "Received" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Conciliar COD" }));
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar conciliar cod" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("approved"),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
  });
  it("prevents blind retry on uncertain outcome", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    render(
      <MutationForm kind="cod" id="00000000-0000-4000-8000-000000000001" />,
    );
    fireEvent.change(screen.getByLabelText("Referencia de recaudo"), {
      target: { value: "COD-1" },
    });
    fireEvent.change(screen.getByLabelText("Nota de conciliación"), {
      target: { value: "Received" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Conciliar COD" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar conciliar cod" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Resultado incierto"),
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Conciliar COD" }),
    ).toBeDisabled();
  });
});
