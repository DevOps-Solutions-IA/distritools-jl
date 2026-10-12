import { crmRead } from "@/features/admin/quotes/CrmFrame";
import { adminFetch } from "@/lib/admin/server-data";
vi.mock("@/lib/admin/server-data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/admin/server-data")>()),
  adminFetch: vi.fn(),
}));
describe("CRM selected read response contracts", () => {
  it.each([
    "/admin/customers/c/orders?page=1",
    "/admin/customers/c/quotes?page=1",
    "/admin/quotes/q",
    "/admin/customers/c",
  ])(
    "malformed200 at %s is a contract failure, never empty success",
    async (path) => {
      vi.mocked(adminFetch).mockResolvedValue({
        ok: true,
        kind: "success",
        status: 200,
        data: {},
        error: null,
      });
      await expect(crmRead(path)).rejects.toMatchObject({
        result: { kind: "contract_error" },
      });
    },
  );
});
