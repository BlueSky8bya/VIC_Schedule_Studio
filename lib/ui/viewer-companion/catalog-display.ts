import bounds from "./catalog-display-bounds.json";

type CatalogBounds = { src: string; width: number; height: number; x: number; y: number; contentWidth: number; contentHeight: number };

/** Translate only. Keep original size, aspect ratio and every source pixel. */
export function companionCatalogDisplay(kind: "food" | "toy", id: string): CatalogBounds & { dx: number; dy: number } {
  const value = (bounds[kind] as Record<string, CatalogBounds>)[id];
  if (!value) throw new Error(`Missing catalog display bounds: ${kind}/${id}`);
  return { ...value, dx: value.width / 2 - value.x - value.contentWidth / 2, dy: value.height / 2 - value.y - value.contentHeight / 2 };
}
