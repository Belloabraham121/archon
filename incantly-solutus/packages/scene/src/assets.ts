export type AssetStatus = "idle" | "loading" | "ready" | "error";
export type ImageAsset = Readonly<{ id: string; source: string; alt: string; status: AssetStatus; width?: number; height?: number; error?: string }>;

export function createImageAsset(id: string, source: string, alt = ""): ImageAsset {
  return { id, source, alt, status: "idle" };
}

export function updateImageAsset(asset: ImageAsset, update: Partial<Pick<ImageAsset, "status" | "width" | "height" | "error">>): ImageAsset {
  return { ...asset, ...update };
}

export function imageFallbackDescription(asset: ImageAsset): string {
  if (asset.status === "error") return `${asset.alt || "Image"} unavailable. Source could not be loaded.`;
  if (asset.status !== "ready") return `${asset.alt || "Image"} is loading.`;
  return asset.alt || "Image asset";
}
