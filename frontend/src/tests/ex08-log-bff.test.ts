import { GET as notifications } from "@/app/api/admin/notifications/route";
import { GET as login } from "@/app/api/admin/shipping/login-test/route";
import { GET as detail } from "@/app/api/admin/shipments/[id]/route";
import { GET as eventList } from "@/app/api/admin/shipments/[id]/events/route";
const fixture = vi.hoisted(() => ({ status: 200, body: {} as unknown }));
vi.mock("@/lib/admin/proxy", () => ({
  proxyAdminRequest: vi.fn(
    async () =>
      new Response(JSON.stringify(fixture.body), {
        status: fixture.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "private, no-store",
        },
      }),
  ),
}));
const id = "019a1000-0000-7000-8000-000000000001";
const note = {
  id,
  eventName: "order.created",
  channel: "email",
  recipient: "cu***@example.test",
  provider: "none",
  status: "uncertain",
  attempts: 3,
  lastError: "PROVIDER_OUTCOME_UNCERTAIN",
  createdAt: "2026-10-11T11:00:00.000Z",
};
const row = {
  id,
  orderId: "019a1000-0000-7000-8000-000000000002",
  orderNumber: "DTJL-20261011-000001",
  provider: "none",
  status: "pending_provider",
  createdAt: "2026-10-11T11:00:00.000Z",
  events: [],
};
async function call(path: string) {
  const r = new Request("http://localhost/api/admin/" + path);
  if (path === "notifications") return notifications(r);
  if (path === "shipping/login-test") return login(r);
  const id = path.split("/")[1];
  return path.endsWith("/events")
    ? eventList(r, { params: Promise.resolve({ id }) })
    : detail(r, { params: Promise.resolve({ id }) });
}
beforeEach(() => {
  fixture.status = 200;
  fixture.body = {};
});
it("notification response never forwards raw content, provider payload or private recipient", async () => {
  fixture.body = {
    data: [
      {
        ...note,
        recipient: "private@example.test",
        content: "Private content",
        subject: "Private subject",
        payload: { authorization: "private" },
        dispatchClaimToken: id,
      },
    ],
  };
  const r = await call("notifications");
  expect(r.status).toBe(200);
  const body = await r.json();
  expect(body.data[0].recipient).toBe("[redacted]");
  expect(body.data[0]).not.toHaveProperty("content");
  expect(body.data[0]).not.toHaveProperty("payload");
  expect(body.data[0]).not.toHaveProperty("dispatchClaimToken");
  expect(r.headers.get("Cache-Control")).toBe("private, no-store");
});
it("login diagnostic excludes actual credential/token fields", async () => {
  fixture.body = {
    ok: false,
    status: "internal_tracking",
    message: "Private email",
    tokenPresent: false,
    token: "private-token",
    password: "private-password",
  };
  const r = await call("shipping/login-test");
  expect(await r.json()).toEqual({
    ok: false,
    status: "internal_tracking",
    tokenPresent: false,
  });
});
it("safe event timeline forwards only id, status and occurredAt", async () => {
  fixture.body = {
    data: [
      {
        id,
        status: "pending_provider",
        occurredAt: "2026-10-11T11:00:00.000Z",
        description: "Private identity",
        rawPayload: { address: "Private address" },
      },
    ],
  };
  const r = await call("shipments/" + id + "/events");
  expect(await r.json()).toEqual({
    data: [
      {
        id,
        status: "pending_provider",
        occurredAt: "2026-10-11T11:00:00.000Z",
      },
    ],
  });
});
it("shipment response strips customer and provider snapshots", async () => {
  fixture.body = {
    ...row,
    customer: { email: "private@example.test" },
    addressSnapshot: { address: "Private address" },
    packageSnapshot: { secret: "private" },
    rawProviderStatus: "private",
  };
  const r = await call("shipments/" + id);
  const body = await r.json();
  expect(body).not.toHaveProperty("customer");
  expect(body).not.toHaveProperty("addressSnapshot");
  expect(body).not.toHaveProperty("packageSnapshot");
});
it("malformed successful collection is502 instead of an empty success", async () => {
  fixture.body = { data: "not-an-array" };
  expect((await call("notifications")).status).toBe(502);
});
it("invalid shipment identifier is400 without forwarding another administrative route", async () => {
  fixture.body = row;
  expect((await call("shipments/not-an-id")).status).toBe(400);
});
it("backend401,403,400,404,500 are preserved rather than successful empty collections", async () => {
  for (const status of [401, 403, 400, 404, 500]) {
    fixture.status = status;
    fixture.body = { kind: "server_error", message: "Safe error" };
    const r = await call("notifications");
    expect(r.status).toBe(status);
    expect(await r.json()).toEqual({
      kind: "server_error",
      message: "Safe error",
    });
  }
});
