import { act, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { QuoteActions } from "@/features/admin/quotes/QuoteActions";

const router = { refresh: vi.fn(), push: vi.fn(), replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const quote = {
  id: "q1",
  quoteNumber: "QTE-SYNTHETIC",
  status: "quoted",
  items: [],
  notes: "Persisted customer note <>&",
  internalNotes: "Persisted internal note <>&",
};
const hydrated: { root: Root; host: HTMLDivElement }[] = [];
function hydrate(permissions = ["quotes.write"]) {
  const host = document.createElement("div");
  document.body.append(host);
  const element = <QuoteActions quote={quote} permissions={permissions} />;
  host.innerHTML = renderToString(element);
  let root!: Root;
  act(() => { root = hydrateRoot(host, element); });
  hydrated.push({ root, host });
  return within(host);
}
afterEach(() => {
  for (const { root, host } of hydrated.splice(0)) {
    act(() => root.unmount());
    host.remove();
  }
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
describe("persisted quote notes remain addressable after SSR and hydration", () => {
  it.each([
    ["Notas del cliente", quote.notes],
    ["Notas internas", quote.internalNotes],
  ])("keeps %s and its persisted value through hydration", (label, value) => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(<QuoteActions quote={quote} permissions={["quotes.write"]} />);
    expect(within(host).getByLabelText(label, { exact: true })).toHaveValue(value);
    const view = hydrate();
    expect(view.getByLabelText(label, { exact: true })).toHaveValue(value);
    expect(view.getByRole("textbox", { name: label })).toBe(view.getByLabelText(label, { exact: true }));
  });
  it("exposes neither notes control without write permission in SSR or hydration", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(<QuoteActions quote={quote} permissions={[]} />);
    expect(within(host).queryAllByRole("textbox")).toHaveLength(0);
    const view = hydrate([]);
    expect(view.queryByLabelText("Notas del cliente", { exact: true })).not.toBeInTheDocument();
    expect(view.queryByLabelText("Notas internas", { exact: true })).not.toBeInTheDocument();
    expect(view.queryByRole("button", { name: "Guardar notas" })).not.toBeInTheDocument();
  });
  it("submits edits to both hydrated persisted values in the existing PATCH payload", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(quote));
    vi.stubGlobal("fetch", fetcher);
    const view = hydrate();
    fireEvent.change(view.getByLabelText("Notas del cliente", { exact: true }), { target: { value: "Edited customer note" } });
    fireEvent.change(view.getByLabelText("Notas internas", { exact: true }), { target: { value: "Edited internal note" } });
    fireEvent.submit(view.getByRole("button", { name: "Guardar notas" }).closest("form")!);
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("/api/admin/quotes/q1", expect.objectContaining({ method: "PATCH", credentials: "same-origin", cache: "no-store" }));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ notes: "Edited customer note", internalNotes: "Edited internal note" });
  });
  it("removes the controls on write revocation and restores persisted values rather than a draft", () => {
    const view = render(<QuoteActions quote={quote} permissions={["quotes.write"]} />);
    fireEvent.change(screen.getByLabelText("Notas del cliente", { exact: true }), { target: { value: "Unsaved draft" } });
    view.rerender(<QuoteActions quote={quote} permissions={[]} />);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
    view.rerender(<QuoteActions quote={quote} permissions={["quotes.write"]} />);
    expect(screen.getByLabelText("Notas del cliente", { exact: true })).toHaveValue(quote.notes);
    expect(screen.getByLabelText("Notas internas", { exact: true })).toHaveValue(quote.internalNotes);
  });
});
