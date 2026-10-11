import "reflect-metadata";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { ProductImageApprovalService } from "src/modules/products/domain/services/product-image-approval.service";

describe("EX08 catalog media authority", () => {
  const service = new ProductImageApprovalService();
  const resource = () => service.list()[0];
  it("registry reproduces tracked image paths and hashes without drift", () => {
    assert.ok(service.list().length > 0);
    execFileSync(process.execPath, [
      "scripts/generate-admin-media-registry.js",
      "--check",
    ]);
  });
  it("rejects unknown, traversal and external schemes", () => {
    for (const assetPath of [
      "/products/absent.jpg",
      "/../products/TOTAL-TG109136.jpg",
      "/products/%2e%2e/x.jpg",
      "https://example.com/a.jpg",
      "data:image/png,x",
      "javascript:alert(1)",
      "//example.com/a.jpg",
    ]) {
      assert.throws(() =>
        service.prepare({ image: { assetPath, status: "approved" } }),
      );
    }
  });
  it("new registered image is pending and forged provenance is discarded", () => {
    const next = service.prepare({
      image: {
        assetPath: resource().assetPath,
        status: "approved",
        approvedBy: "forged",
        approval: { reason: "forged" },
        source: "forged",
      },
    }) as { image: object };
    assert.deepEqual(next.image, {
      assetPath: resource().assetPath,
      status: "pending",
    });
  });
  it("same legacy approved path preserves exactly existing approval and cannot forge fields", () => {
    const image = {
      assetPath: "/legacy.jpg",
      status: "approved",
      source: "legacy",
      approval: { approvedBy: "real" },
    };
    const next = service.prepare(
      {
        name: "new",
        image: { assetPath: "/legacy.jpg", status: "pending", source: "fake" },
      },
      { image },
    ) as { image: object };
    assert.deepEqual(next.image, image);
  });
  it("replacement clears approval, removal cannot stay approved", () => {
    const old = {
      image: {
        assetPath: "/legacy.jpg",
        status: "approved",
        approval: { approvedBy: "real" },
      },
    };
    assert.deepEqual(
      (
        service.prepare(
          { image: { assetPath: resource().assetPath, status: "approved" } },
          old,
        ) as { image: object }
      ).image,
      { assetPath: resource().assetPath, status: "pending" },
    );
    assert.deepEqual(
      (
        service.prepare(
          { image: { assetPath: null, status: "approved" } },
          old,
        ) as { image: object }
      ).image,
      { assetPath: null, status: "pending" },
    );
  });
});
