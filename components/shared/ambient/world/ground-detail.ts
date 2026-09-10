/** Preserve distant pixels; introduce genuine new artwork only in the near half. */
export function nearDetailOpacity(depth: number) {
  const t = Math.max(0, Math.min(1, (depth - .5) / .35));
  return t * t * (3 - 2 * t);
}
/** One-time composition, without resampling or per-frame scratch work. */
export function composeNearGround(original: HTMLImageElement, detail: HTMLImageElement) {
  const c = document.createElement('canvas'); c.width = 1536; c.height = 1024;
  const g = c.getContext('2d')!;
  g.drawImage(original, 0, 0);
  for (let y = 512; y < 1024; y++) {
    g.globalAlpha = nearDetailOpacity((y + .5) / 1024);
    g.drawImage(detail, 0, y, 1536, 1, 0, y, 1536, 1);
  }
  return c;
}
