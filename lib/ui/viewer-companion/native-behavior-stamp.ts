import { companionSpriteMetadata } from "./sprite-quality";
import { companionNewMemory } from "./memory-catalog";

/** A static cell from the exact existing strained-face packet. No generated
 * bitmap, duplicate seal or question-mark substitute is needed for the hidden
 * aftertaste entry. Discovery and the live reaction still own their ACK. */
export function companionNativeBehaviorStamp(id: string) {
  const memory = companionNewMemory(id);
  const row = id === "odd-food-reaction" ? 23 : memory && memory.family !== "expression" ? memory.row : undefined;
  if (row === undefined) return;
  const physical = companionSpriteMetadata.rows[row][Math.floor(companionSpriteMetadata.rows[row].length * .5)];
  const frame = companionSpriteMetadata.frames[physical], atlas = companionSpriteMetadata.atlases[frame.atlas];
  const cell = companionSpriteMetadata.cell;
  return { id, atlas: "behavior-stamp" as const, index: frame.index,
    x: frame.index % companionSpriteMetadata.grid * cell, y: Math.floor(frame.index / companionSpriteMetadata.grid) * cell,
    width: cell, height: cell, content: { x: 0, y: 0, width: cell, height: cell },
    src: atlas.src, atlasWidth: atlas.width, atlasHeight: atlas.height };
}
