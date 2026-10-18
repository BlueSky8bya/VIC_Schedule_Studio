import base from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import play from "@/lib/ui/viewer-companion/play-motion-sprite.json";
import living from "@/lib/ui/viewer-companion/living-motion-sprite.json";

/** Add authored play packets without rewriting the established HD lineage or
 * registration. Every consumer uses this same global frame/atlas mapping. */
export const companionSpriteMetadata = {
  ...base,
  atlases: [...base.atlases, ...play.atlases, ...living.atlases],
  frames: [...base.frames, ...play.frames.map(frame => ({ ...frame, atlas: frame.atlas + base.atlases.length })), ...living.frames.map(frame => ({ ...frame, atlas: frame.atlas + base.atlases.length + play.atlases.length }))],
  rows: [...base.rows, ...play.rows.map(row => row.map(index => index + base.frames.length)), ...living.rows.map(row => row.map(index => index + base.frames.length + play.frames.length))],
};
const metadata = companionSpriteMetadata;

export type CompanionSpriteSelection = {
  atlas: "hd";
  /** Cell within this action's eight-by-two packet. */
  index: number;
  /** Stable global authored/rig frame, including the two new mood actions. */
  physicalIndex: number;
  src: string;
  grid: number;
  gridRows: number;
  frame: { x: number; y: number; clip: readonly number[] };
};

/** Every action reads the same genuine high-resolution texture pipeline.
 * Runtime decoding chooses when to display a packet; this selector never
 * substitutes a blurry legacy sheet while an action is loading. Base slots
 * remain offline rigs; play packets hold/repeat36 new native key drawings. */
export function selectCompanionSprite(index: number, row = 0, column = 0): CompanionSpriteSelection {
  const selectedRow = Number.isInteger(row) ? metadata.rows[row] : undefined;
  const selectedColumn = Number.isFinite(column) ? Math.max(0, Math.floor(column)) : 0;
  const fallback = selectedRow?.[Math.min(selectedColumn, selectedRow.length - 1)] ?? 0;
  const physicalIndex = Number.isInteger(index) && index >= 0 && index < metadata.frames.length ? index : fallback;
  const frame = metadata.frames[physicalIndex];
  return { atlas: "hd", index: frame.index, physicalIndex, src: metadata.atlases[frame.atlas].src, grid: metadata.grid, gridRows: metadata.gridRows, frame };
}

/** A wake clip deliberately starts with the matching clean native pose and
 * continues through its phase packet. Deduplicate without loading unrelated
 * motion; callers keep OFF completely free of companion image requests. */
export function companionSpriteSources(row: number): string[] {
  const frames = Number.isInteger(row) ? metadata.rows[row] : undefined;
  return [...new Set((frames ?? metadata.rows[0]).map(index => metadata.atlases[metadata.frames[index].atlas].src))];
}

// Warm only enabled companions. Keep at most three decoded Image references,
// including connected presentation nodes; at most two decodes are in flight.
// Failed requests leave no permanent Promise entry and can retry finitely in
// the renderer. In-flight calls for the same packet share one decode.
const pending = new Map<string, Promise<boolean>>();
const decoded = new Map<string, HTMLImageElement>();
/** A prior success is insufficient after LRU eviction. */
export function isCompanionSpriteDecoded(src: string): boolean {
  return decoded.has(src);
}

/** A connected presentation owns its exact decoded node. Cold callers yield
 * without queueing/failure poisoning when all three retained nodes are owned.
 * An ordinary later paint may retry after a host releases one; no polling
 * timer or permanent rejected Promise is retained here. */
export function canDecodeCompanionSprite(src: string): boolean {
  if (decoded.has(src) || decoded.size < 3) return true;
  for (const image of decoded.values()) if (!image.isConnected) return true;
  return false;
}

/** Return the SAME Image whose decode resolved, not a URI, clone or new Image.
 * Moving this already prepared node into its host avoids a separate CSS image
 * request/first-paint gap. A live foreign host cannot have its drawing stolen;
 * disconnected hosts may hand their cached node to the next mounted surface.
 * The caller configures and inserts synchronously before yielding control. */
export function acquireDecodedCompanionSprite(src: string, owner: HTMLElement): HTMLImageElement | undefined {
  const image = decoded.get(src);
  if (!image || image.isConnected && image.parentElement !== owner) return;
  decoded.delete(src); decoded.set(src, image);
  return image;
}
const queued: Array<() => Promise<void>> = [];
let activeDecodes = 0;
function startQueuedDecodes() {
  while (activeDecodes < 2 && queued.length) {
    activeDecodes++;
    void queued.shift()!();
  }
}
export function decodeCompanionSprite(src: string): Promise<boolean> {
  if (typeof Image === "undefined") return Promise.resolve(false);
  const cached = decoded.get(src);
  if (cached) { decoded.delete(src); decoded.set(src, cached); return Promise.resolve(true); }
  const existing = pending.get(src); if (existing) return existing;
  if (!canDecodeCompanionSprite(src)) return Promise.resolve(false);
  let finish!: (ready: boolean) => void;
  const ready = new Promise<boolean>(resolve => { finish = resolve; });
  pending.set(src, ready);
  queued.push(async () => {
    let success = false;
    try {
      // Other completed packets may have filled the bounded cache while this
      // work waited in the shared two-slot queue. Busy is a retriable yield.
      if (!canDecodeCompanionSprite(src)) return;
      const image = new Image(); image.src = src;
      await image.decode();
      // A late decode must never evict a connected presentation or expand the
      // retained budget. Its caller can retry after ownership changes.
      if (!canDecodeCompanionSprite(src)) return;
      decoded.set(src, image);
      if (decoded.size > 3) for (const [key, retained] of decoded) {
        if (!retained.isConnected) { decoded.delete(key); break; }
      }
      success = true;
    } catch { /* Failed packets can retry through the renderer's finite cap. */ }
    finally {
      pending.delete(src); activeDecodes--; finish(success); startQueuedDecodes();
    }
  });
  startQueuedDecodes();
  return ready;
}
