export type CompanionSpriteSelection = { atlas: "fluid" | "keypose"; index: number };

/** Native key poses contain real source detail, unlike upscaling the small
 * 256-frame sheet. Large resting/looking and direct affection use that source;
 * walking, flight and authored actions keep their continuous native clips. */
export function selectCompanionSprite(index: number, row: number, column: number, large: boolean, keyposeReady: boolean): CompanionSpriteSelection {
  if (!keyposeReady) return { atlas: "fluid", index };
  if (index >= 256 && index < 272) return { atlas: "keypose", index: index - 256 };
  if (row === 9) return { atlas: "keypose", index: 9 };
  if (large && row === 0) return { atlas: "keypose", index: column === 9 ? 1 : 0 };
  if (large && row === 1) return { atlas: "keypose", index: 0 };
  return { atlas: "fluid", index };
}

// Warm only enabled companions. Keep the current decoded atlas until the new
// one is ready, so choosing Large or starting contact never produces a blank.
const decoded = new Map<string, Promise<boolean>>();
export function decodeCompanionSprite(src: string): Promise<boolean> {
  if (typeof Image === "undefined") return Promise.resolve(false);
  const existing = decoded.get(src); if (existing) return existing;
  const ready = (async () => {
    const image = new Image(); image.src = src;
    try { await image.decode(); return true; } catch { decoded.delete(src); return false; }
  })();
  decoded.set(src, ready); return ready;
}
