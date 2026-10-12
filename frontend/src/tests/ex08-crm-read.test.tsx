import { render, screen } from "@testing-library/react";
import { ClientesScreen } from "@/features/admin/screen-adapters/crm/SectionScreens";
import { QuoteDetailScreen } from "@/features/admin/screen-adapters/crm/DetailScreens";
import { getAdminModule } from "@/lib/admin/operations";

describe("CRM operational reads", () => {
  it("shows restricted financial amount without NaN", () => {
    render(
      <ClientesScreen
        moduleKey="clientes"
        adminModule={getAdminModule("clientes")}
        snapshot={null}
        operations={{
          customers: {
            data: [
              {
                id: "c",
                fullName: "C***",
                email: "c***@example.test",
                phone: null,
                ordersCount: 0,
                totalSpent: "NO_PERMISSION",
                lastOrderAt: null,
              },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText("Sin permiso financiero")).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
  it("renders every returned quote timeline entry after the 16 legacy fields", () => {
    render(
      <QuoteDetailScreen
        value={{
          id: "q",
          quoteNumber: "QTE-1",
          status: "converted_to_order",
          subtotal: "100.00",
          currency: "COP",
          notes: null,
          internalNotes: null,
          expiresAt: null,
          sentAt: null,
          acceptedAt: null,
          rejectedAt: null,
          convertedAt: null,
          customer: { fullName: "C***" },
          order: null,
          items: [],
          createdAt: "2026-10-10",
          updatedAt: "2026-10-10",
          timeline: Array.from({ length: 8 }, (_, i) => ({
            id: `a${i}`,
            action: `quote.action_${i}`,
            createdAt: "2026-10-10",
            actorUserId: "actor",
          })),
        }}
      />,
    );
    expect(screen.getByText("quote.action_7")).toBeInTheDocument();
    expect(screen.getByText(/Pendiente de crear pedido/)).toBeInTheDocument();
  });
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/clientes",
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/admin/shell/useAdminSession", () => ({
  useAdminSession: () => ({
    state: {
      status: "success",
      user: {
        id: "synthetic",
        email: "synthetic@example.test",
        role: "reader",
        permissions: ["customers.read"],
      },
    },
    retry: vi.fn(),
  }),
}));
import { CrmFrame } from "@/features/admin/quotes/CrmFrame";
it("preserves one main landmark inside the actual administrative shell", () => {
  render(
    <CrmFrame title="Clientes" backHref="/admin/clientes">
      <p>Perfil de prueba</p>
    </CrmFrame>,
  );
  expect(screen.getAllByRole("main")).toHaveLength(1);
});
