import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { AdminProductCompleteForm } from "@/components/admin/forms/AdminProductCompleteForm";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
import { MediaApproval } from "@/features/admin/catalog/MediaApproval";
import { parseMediaResources } from "@/features/admin/catalog/media-contract";
const resource = {
  assetPath: "/products/TOTAL-TG109136.jpg",
  sha256: "a".repeat(64),
};
const initial = {
  id: "media-product",
  updatedAt: "2026-10-11T00:00:00.000Z",
  metadata: { image: { assetPath: resource.assetPath, status: "pending" } },
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("fails closed on malformed registry contracts", () => {
  expect(
    parseMediaResources({
      data: [{ assetPath: "https://example.com/a.jpg", sha256: "a" }],
    }),
  ).toBeNull();
  expect(parseMediaResources({ data: [resource] })).toEqual([resource]);
});
it("approves only a saved current registered image and confirms audited response", async () => {
  const confirmed = vi.fn();
  const calls: Array<{ path: string; body: unknown }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init?: RequestInit) => {
      calls.push({
        path,
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return Response.json(
        path.includes("media-resources")
          ? { data: [resource] }
          : {
              ...initial,
              updatedAt: "2026-10-11T00:00:01.000Z",
              metadata: {
                image: {
                  status: "approved",
                  assetPath: resource.assetPath,
                  approval: {
                    ...resource,
                    approvedBy: "editor",
                    approvedAt: "2026-10-11T00:00:01.000Z",
                    reason: "Checked resource",
                  },
                },
              },
            },
      );
    }),
  );
  render(
    <MediaApproval
      value={resource.assetPath}
      onChange={vi.fn()}
      product={initial}
      canRead
      canApprove
      onApproved={confirmed}
    />,
  );
  await screen.findByRole("option", { name: resource.assetPath });
  fireEvent.change(screen.getByLabelText("Motivo de aprobación"), {
    target: { value: "Checked resource" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Aprobar imagen guardada" }),
  );
  await waitFor(() => expect(confirmed).toHaveBeenCalled());
  expect(calls[1]).toEqual({
    path: "/api/admin/products/media-product/image-approval",
    body: {
      ...resource,
      expectedUpdatedAt: initial.updatedAt,
      reason: "Checked resource",
    },
  });
  expect(screen.getByText("Imagen aprobada y auditada.")).toBeInTheDocument();
});
it("shows stale responses without inventing approval", async () => {
  const confirmed = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) =>
      path.includes("media-resources")
        ? Response.json({ data: [resource] })
        : Response.json({ message: "stale" }, { status: 409 }),
    ),
  );
  render(
    <MediaApproval
      value={resource.assetPath}
      onChange={vi.fn()}
      product={initial}
      canRead
      canApprove
      onApproved={confirmed}
    />,
  );
  await screen.findByRole("option", { name: resource.assetPath });
  fireEvent.change(screen.getByLabelText("Motivo de aprobación"), {
    target: { value: "Valid reason" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Aprobar imagen guardada" }),
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(/recarga/i);
  expect(confirmed).not.toHaveBeenCalled();
});
it("shows registry 403 and does not grant approval", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ message: "denied" }, { status: 403 })),
  );
  render(
    <MediaApproval
      value={resource.assetPath}
      onChange={vi.fn()}
      product={initial}
      canRead
      canApprove={false}
      onApproved={vi.fn()}
    />,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(/permiso/i);
  expect(
    screen.queryByRole("button", { name: "Aprobar imagen guardada" }),
  ).not.toBeInTheDocument();
});
it("CompleteForm offers registered selection rather than arbitrary path entry", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string) =>
      Response.json(
        path === "/api/admin/session"
          ? {
              user: {
                id: "editor",
                email: "editor@example.test",
                role: "editor",
                permissions: ["products.read", "products.write"],
              },
            }
          : {
              data: [
                {
                  assetPath: "/products/TOTAL-TG109136.jpg",
                  sha256: "a".repeat(64),
                },
              ],
            },
      ),
    ),
  );
  render(
    <AdminProductCompleteForm brands={[]} categories={[]} warehouses={[]} />,
  );
  expect(
    await screen.findByRole("combobox", { name: /imagen principal/i }),
  ).toBeInTheDocument();
  expect(
    await screen.findByRole("option", { name: "/products/TOTAL-TG109136.jpg" }),
  ).toBeInTheDocument();
});

it("reports registry timeout instead of leaving approval loading indefinitely", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_path: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    ),
  );
  try {
    render(
      <MediaApproval
        value={resource.assetPath}
        onChange={vi.fn()}
        product={initial}
        canRead
        canApprove
        onApproved={vi.fn()}
      />,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent(/tardó demasiado/i);
    expect(
      screen.queryByText("Cargando imágenes registradas…"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Aprobar imagen guardada" }),
    ).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

const pageMocks = vi.hoisted(() => ({ options: vi.fn(), read: vi.fn(), collection: vi.fn() }));
vi.mock("@/features/admin/catalog/server", () => ({ catalogOptions: pageMocks.options, catalogRead: pageMocks.read, catalogCollection: pageMocks.collection }));
vi.mock("@/components/layout/AdminShell", () => ({ AdminShell: ({ children }: { children: React.ReactNode }) => children }));
import AdminProductEditPage from "@/app/admin/productos/[id]/editar/page";
it("edit page exposes saved image approval to a products editor without variants.read", async () => {
  pageMocks.options.mockResolvedValue({ permissions: ["products.read", "products.write"], brands: [], categories: [], warehouses: [] });
  pageMocks.read.mockResolvedValue({ ...initial, name: "Media product", slug: "media-product", isActive: false, brand: null, category: null });
  pageMocks.collection.mockResolvedValue([]);
  vi.stubGlobal("fetch", vi.fn(async (path: string) => {
    if (path === "/api/admin/session") return Response.json({ user: { id: "editor", email: "editor@example.test", role: "editor", permissions: ["products.read", "products.write"] } });
    if (path === "/api/admin/media-resources") return Response.json({ data: [resource] });
    throw new Error("Unexpected read " + path);
  }));
  render(await AdminProductEditPage({ params: Promise.resolve({ id: initial.id }) }));
  expect(await screen.findByRole("combobox", { name: /imagen principal/i })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Aprobar imagen guardada" })).toBeInTheDocument();
  expect(screen.getByText(/Necesitas permiso de lectura de variantes/)).toBeInTheDocument();
  expect(screen.queryByLabelText("SKU")).not.toBeInTheDocument();
  expect(pageMocks.collection).not.toHaveBeenCalled();
});

import { ProductMediaPanel } from "@/features/admin/catalog/ProductMediaPanel";
it("independent media panel saves a replacement pending with actual version then permits audited approval", async () => {
  const second = { assetPath: "/products/TOTAL-TG108136.jpg", sha256: "b".repeat(64) };
  const current = { ...initial, metadata: { ...initial.metadata, seo: { title: "Retained" } } };
  const saved = { ...current, updatedAt: "2026-10-11T00:00:02.000Z", metadata: { ...current.metadata, image: { assetPath: second.assetPath, status: "pending" } } };
  const writes: Array<{ path: string; method: string; body: unknown }> = [];
  vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
    if (path === "/api/admin/session") return Response.json({ user: { id: "editor", email: "editor@example.test", role: "editor", permissions: ["products.read", "products.write"] } });
    if (path === "/api/admin/media-resources") return Response.json({ data: [resource, second] });
    if (!init?.method) return Response.json(current);
    writes.push({ path, method: init.method, body: JSON.parse(String(init.body)) });
    return Response.json(init.method === "PATCH" ? saved : { ...saved, metadata: { ...saved.metadata, image: { assetPath: second.assetPath, status: "approved", approval: { ...second, approvedBy: "editor", approvedAt: "2026-10-11T00:00:03.000Z", reason: "Inspected replacement" } } } });
  }));
  render(<ProductMediaPanel initialProduct={current} />);
  await screen.findByRole("option", { name: second.assetPath });
  fireEvent.change(screen.getByRole("combobox", { name: /imagen principal/i }), { target: { value: second.assetPath } });
  expect(screen.queryByRole("button", { name: "Aprobar imagen guardada" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Guardar imagen seleccionada" }));
  expect((await screen.findAllByText("Imagen guardada pendiente de aprobación.")).length).toBeGreaterThan(0);
  expect(writes[0]).toEqual({ path: "/api/admin/products/media-product", method: "PATCH", body: { metadata: saved.metadata } });
  fireEvent.change(screen.getByLabelText("Motivo de aprobación"), { target: { value: "Inspected replacement" } });
  fireEvent.click(screen.getByRole("button", { name: "Aprobar imagen guardada" }));
  expect(await screen.findByText("Imagen aprobada y auditada.")).toBeInTheDocument();
  expect(writes[1]).toEqual({ path: "/api/admin/products/media-product/image-approval", method: "POST", body: { ...second, expectedUpdatedAt: saved.updatedAt, reason: "Inspected replacement" } });
});
it("read-only product role can inspect media but has no image writes or approval controls", async () => {
  const writes = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
    if (init?.method && init.method !== "GET") { writes(); return Response.json({ message: "Forbidden" }, { status: 403 }); }
    return Response.json(path === "/api/admin/session" ? { user: { id: "reader", email: "reader@example.test", role: "reader", permissions: ["products.read"] } } : { data: [resource] });
  }));
  render(<ProductMediaPanel initialProduct={initial} />);
  await screen.findByRole("option", { name: resource.assetPath });
  expect(screen.queryByRole("button", { name: "Guardar imagen seleccionada" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Aprobar imagen guardada" })).not.toBeInTheDocument();
  expect(writes).not.toHaveBeenCalled();
});
it("media panel detects a changed persisted version before a replacement save", async () => {
  const second = { assetPath: "/products/TOTAL-TG108136.jpg", sha256: "b".repeat(64) };
  const writes = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (path: string, init?: RequestInit) => {
    if (init?.method && init.method !== "GET") { writes(); throw new Error("Unexpected mutation"); }
    if (path === "/api/admin/session") return Response.json({ user: { id: "editor", email: "editor@example.test", role: "editor", permissions: ["products.read", "products.write"] } });
    if (path === "/api/admin/media-resources") return Response.json({ data: [resource, second] });
    return Response.json({ ...initial, updatedAt: "2026-10-11T00:00:01.000Z" });
  }));
  render(<ProductMediaPanel initialProduct={initial} />);
  await screen.findByRole("option", { name: second.assetPath });
  fireEvent.change(screen.getByRole("combobox", { name: /imagen principal/i }), { target: { value: second.assetPath } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar imagen seleccionada" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Recarga/);
  expect(writes).not.toHaveBeenCalled();
});
it("edit page retains the complete SKU form for the current variants.read role", async () => {
  pageMocks.options.mockResolvedValue({ permissions: ["products.read", "products.write", "variants.read"], brands: [], categories: [], warehouses: [] });
  pageMocks.read.mockResolvedValue({ ...initial, name: "Media product", slug: "media-product", isActive: false, brand: null, category: null });
  pageMocks.collection.mockClear();pageMocks.collection.mockResolvedValue([]);
  vi.stubGlobal("fetch", vi.fn(async (path: string) => Response.json(path === "/api/admin/session" ? { user: { id: "editor", email: "editor@example.test", role: "editor", permissions: ["products.read", "products.write", "variants.read"] } } : path.includes("media-resources") ? { data: [resource] } : initial)));
  render(await AdminProductEditPage({ params: Promise.resolve({ id: initial.id }) }));
  expect(screen.getByLabelText("SKU")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Guardar imagen seleccionada" })).not.toBeInTheDocument();
  expect(pageMocks.collection).toHaveBeenCalledWith("/admin/variants?productId=media-product");
});
