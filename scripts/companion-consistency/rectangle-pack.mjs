// Deterministic MaxRects packing; every crop stays upright and has a1px gutter.
export function packRectangles(items, width, height) {
  let free = [{ x: 0, y: 0, w: width, h: height }]; const placed = [];
  for (const item of [...items].sort((a, b) => b.width * b.height - a.width * a.height)) {
    const w = item.width + 2, h = item.height + 2;
    const fits = free.filter(r => r.w >= w && r.h >= h).sort((a, b) => Math.min(a.w - w, a.h - h) - Math.min(b.w - w, b.h - h) || a.y - b.y || a.x - b.x);
    if (!fits.length) return null;
    const box = { x: fits[0].x, y: fits[0].y, w, h };
    placed.push({ ...item, x: box.x + 1, y: box.y + 1 });
    const next = [];
    for (const r of free) {
      if (box.x >= r.x + r.w || box.x + w <= r.x || box.y >= r.y + r.h || box.y + h <= r.y) { next.push(r); continue; }
      if (box.x > r.x) next.push({ ...r, w: box.x - r.x });
      if (box.x + w < r.x + r.w) next.push({ ...r, x: box.x + w, w: r.x + r.w - box.x - w });
      if (box.y > r.y) next.push({ ...r, h: box.y - r.y });
      if (box.y + h < r.y + r.h) next.push({ ...r, y: box.y + h, h: r.y + r.h - box.y - h });
    }
    free = next.filter((r, i) => !next.some((o, j) => i !== j && o.x <= r.x && o.y <= r.y && o.x + o.w >= r.x + r.w && o.y + o.h >= r.y + r.h && (j < i || o.x !== r.x || o.y !== r.y || o.w !== r.w || o.h !== r.h)));
  }
  return placed;
}
