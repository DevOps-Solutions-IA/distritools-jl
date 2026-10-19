import {
  notification,
  shipment,
  events,
  uuid,
  guideLabel,
} from "@/features/admin/logistics/contract";
const id = "019a1000-0000-7000-8000-000000000001";
const baseNotification = {
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
const baseShipment = {
  id,
  orderId: "019a1000-0000-7000-8000-000000000002",
  orderNumber: "DTJL-20261011-000001",
  provider: "none",
  status: "pending_provider",
  createdAt: "2026-10-11T11:00:00.000Z",
  events: [],
};
it("notification view removes raw provider payload, recipient, subject and content", () => {
  const r = notification({
    ...baseNotification,
    recipient: "private@example.test",
    subject: "Private identity",
    content: "Private content",
    payload: { secret: "private-detail" },
    providerMessageId: "private-message",
    dispatchClaimToken: id,
  });
  expect(r.recipient).toBe("[redacted]");
  expect(r).not.toHaveProperty("payload");
  expect(r).not.toHaveProperty("subject");
  expect(r).not.toHaveProperty("content");
  expect(r).not.toHaveProperty("providerMessageId");
  expect(r).not.toHaveProperty("dispatchClaimToken");
});
it("a recipient containing stars is not automatically an authorized mask", () => {
  expect(
    notification({ ...baseNotification, recipient: "private@example.test***" })
      .recipient,
  ).toBe("[redacted]");
});
it("notification does not disclose free-form provider failure text", () => {
  expect(
    notification({
      ...baseNotification,
      lastError: "Authorization: private@example.test",
    }).lastError,
  ).toBe("[DETAILS_REDACTED]");
});
it("notification rejects unknown delivery states rather than presenting a successful record", () => {
  expect(() =>
    notification({ ...baseNotification, status: "delivered_real" }),
  ).toThrow();
});
it("notification rejects invalid attempt count", () => {
  for (const attempts of [-1, 1.5, "3"])
    expect(() => notification({ ...baseNotification, attempts })).toThrow();
});
it("shipment view never includes customer identity, snapshots or raw provider payload", () => {
  const r = shipment({
    ...baseShipment,
    customer: { email: "private@example.test" },
    addressSnapshot: { address: "Private address" },
    packageSnapshot: { secret: "private" },
    rawProviderStatus: "private-status",
  });
  expect(r).not.toHaveProperty("customer");
  expect(r).not.toHaveProperty("addressSnapshot");
  expect(r).not.toHaveProperty("packageSnapshot");
  expect(r).not.toHaveProperty("rawProviderStatus");
});
it("persisted events omit descriptions, provider status, locations and raw payload", () => {
  expect(
    events([
      {
        id,
        status: "pending_provider",
        occurredAt: "2026-10-11T11:00:00.000Z",
        description: "Private identity",
        rawPayload: { secret: "private" },
        location: "Private address",
        providerStatus: "private",
      },
    ]),
  ).toEqual([
    { id, status: "pending_provider", occurredAt: "2026-10-11T11:00:00.000Z" },
  ]);
});
it("UUID paths reject manipulated route segments and schemes", () => {
  for (const value of [
    "../settings",
    id + "/events",
    "%2fsettings",
    "javascript:alert(1)",
    "not-a-uuid",
  ])
    expect(uuid(value)).toBe(false);
  expect(uuid(id)).toBe(true);
});
it("MOCK99 never becomes a real guide despite misleading source metadata", () => {
  expect(
    guideLabel(
      shipment({
        ...baseShipment,
        provider: "99envios",
        trackingNumber: "MOCK99-FA1E4626",
        guideSource: "real_99envios",
      }),
    ),
  ).toBe("Mock local/test");
});
it("missing external number remains internal tracking", () => {
  expect(
    guideLabel(
      shipment({ ...baseShipment, provider: "99envios", trackingNumber: null }),
    ),
  ).toBe("Tracking interno");
});
it("unknown shipment status is rejected, never rendered as a real transition", () => {
  expect(() => shipment({ ...baseShipment, status: "fake_success" })).toThrow();
});
