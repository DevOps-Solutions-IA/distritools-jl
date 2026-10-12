import {
  crmRequest,
  priceItemsPayload,
  customerChanges,
} from "@/features/admin/quotes/contracts";
describe("CRM action boundaries", () => {
  it("sends persisted own item ids and explicit quantities; rejects foreign ids", () => {
    expect(
      priceItemsPayload(
        [{ id: "own", quantity: 3 }],
        [{ id: "own", quantity: "3", unitPrice: "125.50" }],
      ),
    ).toEqual({ items: [{ id: "own", quantity: 3, unitPrice: "125.50" }] });
    expect(() =>
      priceItemsPayload(
        [{ id: "own", quantity: 3 }],
        [{ id: "foreign", quantity: "1", unitPrice: "1" }],
      ),
    ).toThrow();
  });
  it("rejects invalid quantity or negative amount before any request", () => {
    for (const edit of [
      { id: "own", quantity: "0", unitPrice: "1" },
      { id: "own", quantity: "1", unitPrice: "-1" },
      { id: "own", quantity: "1.5", unitPrice: "1" },
    ])
      expect(() =>
        priceItemsPayload([{ id: "own", quantity: 1 }], [edit]),
      ).toThrow();
  });
  it("never resubmits masked profile values or unchanged blank replacements", () => {
    expect(
      customerChanges({ fullName: "", email: "", phone: "", city: "Bogotá" }),
    ).toEqual({ city: "Bogotá" });
    expect(() => customerChanges({ email: "a***@example.test" })).toThrow();
  });
  it("preserves errors and never retries an uncertain mutation", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetcher);
    const result = await crmRequest("/quotes/q/convert-to-order", "POST");
    expect(result.ok).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result.error).toMatch(/incierto/);
  });
  it("bodyless action stays bodyless and malformed success is rejected", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response("[]", { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    const result = await crmRequest("/customers/export", "POST");
    expect(fetcher.mock.calls[0][1].body).toBeUndefined();
    expect(result.ok).toBe(false);
  });
  it.each([401, 403, 400, 409, 500, 503])(
    "HTTP %i is not success",
    async (status) => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response(JSON.stringify({ message: "test" }), { status }),
          ),
      );
      expect((await crmRequest("/quotes/q", "PATCH", { notes: "n" })).ok).toBe(
        false,
      );
    },
  );
  it.each([
    "/quotes/q/convert-to-order",
    "/quotes/q",
    "/customers/export",
    "/customers/c/view-sensitive",
  ])("rejects object success without actual contract at %s", async (path) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 201 })),
    );
    expect((await crmRequest(path, "POST")).ok).toBe(false);
  });
  afterEach(() => vi.unstubAllGlobals());
});
