import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QuoteActions } from "@/features/admin/quotes/QuoteActions";
import { CustomerActions } from "@/features/admin/customers/CustomerActions";
import { CreateQuoteForm } from "@/features/admin/quotes/CreateQuoteForm";
const router = { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const nativeAssign = vi.fn();
const quote = {
  id: "q1",
  quoteNumber: "QTE-SYNTHETIC",
  status: "quoted",
  items: [
    {
      id: "item",
      nameSnapshot: "Synthetic item",
      quantity: 1,
      unitPrice: "100.00",
    },
  ],
};
const customer = {
  id: "customer-a",
  fullName: "Synthetic private",
  email: "private@example.invalid",
};
const session = {
  user: {
    id: "reauthenticated",
    email: "qa@example.invalid",
    role: "qa",
    permissions: ["quotes.approve"],
  },
};
type Lane = "quote" | "customer" | "create";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}
function mount(lane: Lane) {
  if (lane === "quote")
    return render(
      <QuoteActions quote={quote} permissions={["quotes.approve"]} />,
    );
  if (lane === "customer")
    return render(
      <CustomerActions
        id="customer-a"
        permissions={["customers.read_sensitive"]}
      />,
    );
  return render(<CreateQuoteForm />);
}
function trigger(lane: Lane) {
  if (lane === "quote")
    fireEvent.click(screen.getByRole("button", { name: "Aceptar cotización" }));
  else if (lane === "customer")
    fireEvent.click(
      screen.getByRole("button", {
        name: "Consultar datos sensibles con auditoría",
      }),
    );
  else {
    fireEvent.change(
      screen.getByLabelText("ID de cliente existente (opcional)"),
      { target: { value: "00000000-0000-4000-8000-000000000001" } },
    );
    fireEvent.change(screen.getByLabelText("ID real de producto"), {
      target: { value: "00000000-0000-4000-8000-000000000002" },
    });
    fireEvent.change(screen.getByLabelText("Descripción de la línea"), {
      target: { value: "Synthetic" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Crear cotización" }).closest("form")!,
    );
  }
}
function transport(
  confirmation: () => Promise<Response>,
  mutation: () => Promise<Response> = async () =>
    Response.json({}, { status: 401 }),
) {
  const fetcher = vi
    .fn()
    .mockImplementation((path: string) =>
      path === "/api/admin/session" ? confirmation() : mutation(),
    );
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
beforeEach(() => vi.stubGlobal("location", { assign: nativeAssign }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("CRM401 recovery requires canonical self-context and a fresh native document", () => {
  it.each(["quote", "customer", "create"] as const)(
    "%s navigates natively only after mutation401 and authoritative GET401",
    async (lane) => {
      const authority = deferred<Response>();
      const fetcher = transport(() => authority.promise);
      mount(lane);
      trigger(lane);
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
      expect(fetcher).toHaveBeenLastCalledWith(
        "/api/admin/session",
        expect.objectContaining({
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal: expect.any(AbortSignal),
        }),
      );
      expect(nativeAssign).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
      await act(async () =>
        authority.resolve(Response.json({}, { status: 401 })),
      );
      expect(nativeAssign).toHaveBeenCalledExactlyOnceWith("/admin/login");
      expect(router.refresh).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();
      expect(
        fetcher.mock.calls.filter(([p]) => p !== "/api/admin/session"),
      ).toHaveLength(1);
    },
  );
  it.each(["quote", "customer", "create"] as const)(
    "%s retains a reauthenticated valid200 instead of forcing old login",
    async (lane) => {
      const fetcher = transport(async () => Response.json(session));
      mount(lane);
      trigger(lane);
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(
          screen.getByRole(lane === "customer" ? "status" : "alert"),
        ).toHaveTextContent(/sesión|operación/i),
      );
      expect(nativeAssign).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
      expect(router.refresh).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();
    },
  );
  it.each([403, 500, 200] as const)(
    "self-context%i or malformed200 does not claim authentication or logout",
    async (status) => {
      const fetcher = transport(async () => Response.json({}, { status }));
      mount("quote");
      trigger("quote");
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          /sesión|permiso|confirmar|respuesta/i,
        ),
      );
      expect(nativeAssign).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
      expect(router.refresh).not.toHaveBeenCalled();
    },
  );
  it.each(["network", "invalid-json"])(
    "self-context %s leaves an explicit error without retry or login",
    async (fault) => {
      const fetcher = transport(async () => {
        if (fault === "network") throw new Error("offline");
        return new Response("not-json", { status: 200 });
      });
      mount("quote");
      trigger("quote");
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent(
          /sesión|confirmar|respuesta/i,
        ),
      );
      expect(nativeAssign).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
      expect(fetcher).toHaveBeenCalledTimes(2);
    },
  );
  it("clears PII immediately while authoritative confirmation is still pending", async () => {
    const authority = deferred<Response>();
    const fetcher = transport(() => authority.promise);
    fetcher.mockResolvedValueOnce(Response.json(customer, { status: 201 }));
    mount("customer");
    trigger("customer");
    await screen.findByText(customer.email);
    trigger("customer");
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(
      screen.queryByLabelText("Datos sensibles consultados"),
    ).not.toBeInTheDocument();
    expect(nativeAssign).not.toHaveBeenCalled();
    await act(async () => authority.resolve(Response.json(session)));
    expect(nativeAssign).not.toHaveBeenCalled();
  });
  it.each(["quote", "customer", "create"] as const)(
    "%s ignores mutation401 arriving after unmount without starting self-context",
    async (lane) => {
      const late = deferred<Response>();
      const fetcher = transport(
        async () => Response.json({}, { status: 401 }),
        () => late.promise,
      );
      const view = mount(lane);
      trigger(lane);
      view.unmount();
      await act(async () => late.resolve(Response.json({}, { status: 401 })));
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(nativeAssign).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    },
  );
  it.each(["quote", "customer", "create"] as const)(
    "%s cancels late self-context401 on unmount and never navigates the new context",
    async (lane) => {
      const late = deferred<Response>();
      const fetcher = transport(() => late.promise);
      const view = mount(lane);
      trigger(lane);
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
      const signal = fetcher.mock.calls[1][1].signal as AbortSignal;
      view.unmount();
      mount(lane);
      expect(signal.aborted).toBe(true);
      await act(async () => late.resolve(Response.json({}, { status: 401 })));
      expect(nativeAssign).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    },
  );
  it.each([
    "quote-id",
    "quote-permission",
    "customer-id",
    "customer-permission",
  ])(
    "ignores old self-context401 after %s changes and restoration",
    async (change) => {
      const late = deferred<Response>();
      const fetcher = transport(() => late.promise);
      const isQuote = change.startsWith("quote");
      const lane = isQuote ? "quote" : "customer";
      const view = mount(lane);
      trigger(lane);
      await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
      if (isQuote) {
        view.rerender(
          <QuoteActions
            quote={change.endsWith("id") ? { ...quote, id: "q2" } : quote}
            permissions={
              change.endsWith("permission") ? [] : ["quotes.approve"]
            }
          />,
        );
        view.rerender(
          <QuoteActions quote={quote} permissions={["quotes.approve"]} />,
        );
      } else {
        view.rerender(
          <CustomerActions
            id={change.endsWith("id") ? "customer-b" : "customer-a"}
            permissions={
              change.endsWith("permission") ? [] : ["customers.read_sensitive"]
            }
          />,
        );
        view.rerender(
          <CustomerActions
            id="customer-a"
            permissions={["customers.read_sensitive"]}
          />,
        );
      }
      await act(async () => late.resolve(Response.json({}, { status: 401 })));
      expect(nativeAssign).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    },
  );
  it("bounds session confirmation timeout and ignores a later401 even when fetch ignores abort", async () => {
    vi.useFakeTimers();
    const late = deferred<Response>();
    const fetcher = transport(() => late.promise);
    mount("quote");
    await act(async () => trigger("quote"));
    expect(fetcher).toHaveBeenCalledTimes(2);
    const signal = fetcher.mock.calls[1][1].signal as AbortSignal;
    await act(async () => vi.advanceTimersByTimeAsync(12000));
    expect(signal.aborted).toBe(true);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /confirmar|tiempo|sesión/i,
    );
    await act(async () => late.resolve(Response.json({}, { status: 401 })));
    expect(nativeAssign).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([403, 500])(
    "mutation%i never invokes recovery or logout",
    async (status) => {
      const fetcher = transport(
        async () => Response.json({}, { status: 401 }),
        async () => Response.json({}, { status }),
      );
      mount("quote");
      trigger("quote");
      await screen.findByRole("alert");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(nativeAssign).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    },
  );
});
