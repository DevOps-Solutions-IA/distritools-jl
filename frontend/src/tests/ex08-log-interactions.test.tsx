import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LogReadFence } from "@/features/admin/logistics/LogReadFence";
import { NotificationExplorer } from "@/features/admin/logistics/NotificationExplorer";
import { OperationsPanel } from "@/features/admin/logistics/OperationsPanel";
import { notification } from "@/features/admin/logistics/contract";
let permissions: string[], sessionStatus: number, loginStatus: number;
const rows = [
  notification({
    id: "019a1000-0000-7000-8000-000000000001",
    eventName: "order.created",
    channel: "email",
    recipient: "cu***@example.test",
    provider: "none",
    status: "failed",
    attempts: 3,
    lastError: "PROVIDER_BLOCKED",
    createdAt: "2026-10-11T11:00:00.000Z",
  }),
  notification({
    id: "019a1000-0000-7000-8000-000000000002",
    eventName: "shipment.guide_created",
    channel: "internal",
    recipient: "op***@internal",
    provider: "internal",
    status: "sent",
    attempts: 1,
    lastError: null,
    sentAt: "2026-10-11T11:02:00.000Z",
    createdAt: "2026-10-11T11:00:00.000Z",
  }),
];
beforeEach(() => {
  permissions = ["notifications.read", "shipping.read"];
  sessionStatus = 200;
  loginStatus = 200;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/admin/session")
        return new Response(
          JSON.stringify(
            sessionStatus === 200
              ? {
                  user: {
                    id: "019a1000-0000-7000-8000-000000000099",
                    email: "ad***@example.test",
                    role: "operator",
                    permissions,
                  },
                }
              : { message: "Denied" },
          ),
          { status: sessionStatus },
        );
      if (url === "/api/admin/shipping/login-test")
        return new Response(
          JSON.stringify({
            ok: false,
            status: "internal_tracking",
            tokenPresent: false,
          }),
          { status: loginStatus },
        );
      throw new Error("Unexpected domain request " + url);
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());
function history() {
  render(
    <LogReadFence permission="notifications.read">
      <NotificationExplorer rows={rows} limit={20} settingsRead={true} />
    </LogReadFence>,
  );
}
it("local failure filtering does not pretend to filter the entire persisted history", async () => {
  history();
  await screen.findByRole("cell", { name: "order.created" });
  fireEvent.change(screen.getByLabelText("Estado en esta vista"), {
    target: { value: "failed" },
  });
  expect(
    screen.getByRole("cell", { name: "order.created" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("cell", { name: "shipment.guide_created" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByText(/filtros locales sobre 2 registros/i),
  ).toBeInTheDocument();
});
it("notification detail shows safe persisted error and does not offer manual replay", async () => {
  history();
  await screen.findByRole("cell", { name: "order.created" });
  fireEvent.click(
    screen.getAllByRole("button", { name: "Revisar notificación" })[0],
  );
  expect(
    screen.getByRole("region", { name: "Detalle de notificación" }),
  ).toHaveTextContent("PROVIDER_BLOCKED");
  expect(
    screen.queryByRole("button", { name: /reenviar|reintentar/i }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar detalle" }));
  expect(
    screen.queryByRole("region", { name: "Detalle de notificación" }),
  ).not.toBeInTheDocument();
});
it("permission revocation on focus removes cached rows and failure detail", async () => {
  history();
  await screen.findByRole("cell", { name: "order.created" });
  fireEvent.click(
    screen.getAllByRole("button", { name: "Revisar notificación" })[0],
  );
  permissions = [];
  fireEvent.focus(window);
  await waitFor(() =>
    expect(
      screen.queryByRole("cell", { name: "order.created" }),
    ).not.toBeInTheDocument(),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No tienes permiso",
  );
  expect(
    screen.queryByRole("region", { name: "Detalle de notificación" }),
  ).not.toBeInTheDocument();
});
it("401 session feedback exposes a native login link and no persisted data", async () => {
  sessionStatus = 401;
  history();
  expect(
    await screen.findByRole("link", { name: "Iniciar sesión" }),
  ).toHaveAttribute("href", "/admin/login");
  expect(
    screen.queryByRole("cell", { name: "order.created" }),
  ).not.toBeInTheDocument();
});
it("403 session feedback does not render an empty history", async () => {
  sessionStatus = 403;
  history();
  expect(await screen.findByRole("alert")).toHaveTextContent("Acceso denegado");
  expect(
    screen.queryByText("No hay notificaciones en esta vista."),
  ).not.toBeInTheDocument();
});
it("500 current session lookup hides snapshots and reports a server error", async () => {
  sessionStatus = 500;
  history();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No fue posible verificar",
  );
  expect(
    screen.queryByRole("cell", { name: "order.created" }),
  ).not.toBeInTheDocument();
});
it("provider configuration link requires the current settings permission", async () => {
  history();
  await screen.findByRole("cell", { name: "order.created" });
  expect(
    screen.queryByRole("link", {
      name: "Revisar configuración local del proveedor",
    }),
  ).not.toBeInTheDocument();
  permissions = ["notifications.read", "settings.read"];
  fireEvent.focus(window);
  expect(
    await screen.findByRole("link", {
      name: "Revisar configuración local del proveedor",
    }),
  ).toHaveAttribute("href", "/admin/configuracion");
});
it("local connection diagnostic preserves provider blocked even after HTTP200", async () => {
  render(
    <OperationsPanel
      capabilities={{ provider: "internal", mode: "internal", ready: false }}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Probar login" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "BLOCKED_PROVIDER: sólo tracking interno",
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Crear preenvío" }),
  ).not.toBeInTheDocument();
});
it("backend403 connection failure remains denied without a successful provider badge", async () => {
  loginStatus = 403;
  render(
    <OperationsPanel
      capabilities={{ provider: "internal", mode: "internal", ready: false }}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Probar login" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "No tienes permiso",
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
