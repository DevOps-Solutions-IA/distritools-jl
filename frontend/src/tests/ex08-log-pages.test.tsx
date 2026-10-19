import { render, screen } from "@testing-library/react";
import AdminShipmentsPage from "@/app/admin/envios/page";
import AdminShipmentDetailPage from "@/app/admin/envios/[id]/page";
import AdminTrackingPage from "@/app/admin/rastreo/page";
import AdminNotificationsPage from "@/app/admin/notificaciones/page";
const fixture = vi.hoisted(() => ({
  permissions: ["shipping.read", "tracking.read", "notifications.read"],
  fail: false,
}));
vi.mock("@/features/admin/shell/useAdminSession", () => ({
  useAdminSession: () => ({
    state: { status: "success", user: { permissions: fixture.permissions } },
    retry: vi.fn(),
  }),
}));
vi.mock("@/components/layout/AdminShell", () => ({
  AdminShell: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));
vi.mock("@/lib/admin/server-data", async (original) => {
  const actual = await original<typeof import("@/lib/admin/server-data")>();
  const row = {
    id: "019a1000-0000-7000-8000-000000000001",
    orderId: "019a1000-0000-7000-8000-000000000002",
    orderNumber: "DTJL-20261011-000001",
    provider: "none",
    status: "pending_provider",
    trackingNumber: null,
    routeNumber: null,
    quotedAmount: null,
    customer: {
      fullName: "Cl***",
      email: "cl***@example.test",
      phone: "300***77",
    },
    events: [
      {
        id: "019a1000-0000-7000-8000-000000000003",
        status: "pending_provider",
        occurredAt: "2026-10-11T11:00:00.000Z",
      },
    ],
    createdAt: "2026-10-11T11:00:00.000Z",
  };
  return {
    ...actual,
    adminFetch: vi.fn(async (path: string) => ({
      ok: true,
      kind: "success",
      status: 200,
      data:
        path === "/admin/session"
          ? { user: { permissions: fixture.permissions } }
          : path.endsWith("/events")
            ? { data: row.events }
            : row,
      error: null,
    })),
    getAdminOperationalSnapshot: vi.fn(async () => {
      if (fixture.fail)
        throw new actual.AdminReadError({
          ok: false,
          kind: "forbidden",
          status: 403,
          data: null,
          error: "No tiene permiso para leer este módulo.",
        });
      return {
        shipments: { data: [row], meta: { page: 1, limit: 20, total: 21 } },
        shippingCapabilities: {
          provider: "internal",
          mode: "internal",
          ready: false,
          supportsQuote: false,
          supportsCreateShipment: false,
          supportsTracking: true,
          supportsLabels: false,
          supportsIssues: false,
        },
        notifications: {
          data: [
            {
              id: "019a1000-0000-7000-8000-000000000004",
              eventName: "order.created",
              channel: "email",
              recipient: "cl***@example.test",
              subject: "[PROTECTED]",
              provider: "none",
              status: "uncertain",
              attempts: 3,
              lastError: "PROVIDER_OUTCOME_UNCERTAIN",
              sentAt: null,
              failedAt: null,
              createdAt: "2026-10-11T11:00:00.000Z",
              updatedAt: "2026-10-11T11:00:00.000Z",
            },
          ],
        },
        errors: {},
      };
    }),
  };
});
beforeEach(() => {
  fixture.permissions = [
    "shipping.read",
    "tracking.read",
    "notifications.read",
  ];
  fixture.fail = false;
});
it("shipping list submits real search/status and exposes server pagination", async () => {
  render(await AdminShipmentsPage());
  expect(screen.getByRole("form", { name: "Filtrar envíos" })).toHaveAttribute(
    "method",
    "get",
  );
  expect(screen.getByLabelText("Pedido o guía")).toHaveAttribute(
    "name",
    "search",
  );
  expect(
    screen.getByRole("link", { name: "Página siguiente" }),
  ).toHaveAttribute("href", expect.stringContaining("page=2"));
  expect(
    screen.getByRole("link", { name: "Ver envío DTJL-20261011-000001" }),
  ).toHaveAttribute(
    "href",
    "/admin/envios/019a1000-0000-7000-8000-000000000001",
  );
});
it("shipment detail has an ordered persisted safe timeline, without generic customer JSON", async () => {
  render(
    await AdminShipmentDetailPage({
      params: Promise.resolve({ id: "019a1000-0000-7000-8000-000000000001" }),
    }),
  );
  expect(
    screen.getByRole("region", { name: "Eventos del envío" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Abrir rastreo público" }),
  ).toHaveAttribute("href", "/rastreo-de-pedido?query=DTJL-20261011-000001");
  expect(screen.queryByText("customer")).not.toBeInTheDocument();
});
it("tracking-only permission can look up safe events without requesting shipping list", async () => {
  fixture.permissions = ["tracking.read"];
  render(await AdminTrackingPage());
  expect(screen.getByLabelText("ID del envío")).toHaveAttribute(
    "name",
    "shipmentId",
  );
  expect(
    screen.getByRole("button", { name: "Consultar eventos" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("form", { name: "Filtrar envíos" }),
  ).not.toBeInTheDocument();
});
it("notification history distinguishes uncertain outcome and blocks manual replay", async () => {
  render(await AdminNotificationsPage());
  expect(screen.getByLabelText("Estado en esta vista")).toBeInTheDocument();
  expect(
    screen.getByRole("cell", { name: "Resultado incierto" }),
  ).toBeInTheDocument();
  expect(screen.getByText(/BLOCKED_DECISION/)).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: /reenviar|reintentar/i }),
  ).not.toBeInTheDocument();
});
it("read 403 remains a visible failure rather than an empty successful collection", async () => {
  fixture.fail = true;
  render(await AdminShipmentsPage());
  expect(screen.getByRole("alert")).toHaveTextContent("No tiene permiso");
  expect(
    screen.queryByText("No hay envíos para estos filtros."),
  ).not.toBeInTheDocument();
});

it("invalid shipping status is visible400 before querying Prisma enum", async () => {
  render(
    await AdminShipmentsPage({
      searchParams: Promise.resolve({ status: "pending_guide" }),
    }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/parámetros/i);
  expect(
    screen.queryByRole("region", { name: "Listado de envíos" }),
  ).not.toBeInTheDocument();
});
