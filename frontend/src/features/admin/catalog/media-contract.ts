export interface MediaResource {
  assetPath: string;
  sha256: string;
}
export interface MediaProduct {
  id: string;
  updatedAt: string;
  metadata: {
    image?: {
      assetPath?: string | null;
      status?: string;
      approval?: {
        assetPath: string;
        sha256: string;
        approvedBy: string;
        approvedAt: string;
        reason: string;
      };
    };
  };
}
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function parseMediaResources(value: unknown): MediaResource[] | null {
  const data = record(value).data;
  if (!Array.isArray(data)) return null;
  if (
    !data.every(
      (item) =>
        typeof item?.assetPath === "string" &&
        /^\/(?!\/)[^?#%\\]+\.(png|jpe?g|webp|gif|avif|svg)$/i.test(
          item.assetPath,
        ) &&
        !item.assetPath.split("/").includes("..") &&
        typeof item.sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(item.sha256),
    )
  )
    return null;
  return data as MediaResource[];
}
export function parseMediaProduct(value: unknown): MediaProduct | null {
  const item = record(value);
  if (
    typeof item.id !== "string" ||
    typeof item.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(item.updatedAt))
  )
    return null;
  return {
    id: item.id,
    updatedAt: item.updatedAt,
    metadata: record(item.metadata) as MediaProduct["metadata"],
  };
}
export function confirmedImageApproval(
  value: unknown,
  resource: MediaResource,
): MediaProduct | null {
  const product = parseMediaProduct(value);
  const image = product?.metadata.image;
  const approval = image?.approval;
  return image?.status === "approved" &&
    image.assetPath === resource.assetPath &&
    approval?.assetPath === resource.assetPath &&
    approval.sha256 === resource.sha256 &&
    typeof approval.approvedBy === "string" &&
    !!approval.approvedBy &&
    Number.isFinite(Date.parse(approval.approvedAt)) &&
    typeof approval.reason === "string" &&
    approval.reason.trim().length >= 3
    ? product
    : null;
}
