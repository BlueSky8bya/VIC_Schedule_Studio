import atlas from "./memory-scenes-atlas.json";
import type { CompanionCollectionArtFrame } from "./collection-art";

const { cell, columns, ids } = atlas;
const width = cell * columns, height = cell * Math.ceil(ids.length / columns);
const src = "/companion/collection/memory-scenes-v1.webp";
const frames = new Map(ids.map((id, index): [string, CompanionCollectionArtFrame] => [id, {
  id, atlas: "behavior-stamp", index, x: index % columns * cell, y: Math.floor(index / columns) * cell,
  width: cell, height: cell, content: { x: 0, y: 0, width: cell, height: cell },
  src, atlasWidth: width, atlasHeight: height,
}]));
export const companionIllustratedMemoryStamp = (id: string | undefined) => id ? frames.get(id) : undefined;
