import { Injectable, UnprocessableEntityException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ADMIN_MEDIA_RESOURCES } from "./admin-media-registry.generated";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

@Injectable()
export class ProductImageApprovalService {
  list() {
    return ADMIN_MEDIA_RESOURCES;
  }

  resource(assetPath: string) {
    const resource = ADMIN_MEDIA_RESOURCES.find(
      (item) => item.assetPath === assetPath,
    );
    if (!resource)
      throw new UnprocessableEntityException(
        "Image must be an existing registered media resource",
      );
    return resource;
  }

  prepare(metadata: unknown, current?: unknown): Prisma.InputJsonValue | null {
    if (metadata === null || metadata === undefined) return null;
    const next = record(metadata);
    const image = record(next.image);
    const previous = record(record(current).image);
    // Omitted image keeps the current authoritative image during metadata edits.
    if (!Object.hasOwn(next, "image"))
      return {
        ...next,
        ...(Object.keys(previous).length ? { image: previous } : {}),
      } as Prisma.InputJsonValue;
    const assetPath = image.assetPath;
    if (
      typeof assetPath === "string" &&
      assetPath !== "" &&
      assetPath === previous.assetPath
    ) {
      return { ...next, image: previous } as Prisma.InputJsonValue;
    }
    if (assetPath === null || assetPath === undefined || assetPath === "") {
      return {
        ...next,
        image: { status: "pending", assetPath: null },
      } as Prisma.InputJsonValue;
    }
    if (typeof assetPath !== "string")
      throw new UnprocessableEntityException("Invalid image resource");
    this.resource(assetPath);
    // Generic metadata can select a resource, but cannot write approval/provenance.
    return {
      ...next,
      image: { assetPath, status: "pending" },
    } as Prisma.InputJsonValue;
  }
}
