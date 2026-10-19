/** Click-time packing only: a food/toy keeps its real44px native footprint.
 * No identity, DOM reads, RNG, persistence or display clock is involved. */
export type CompanionItemPoint = Readonly<{ x: number; y: number }>;
export type CompanionItemSpan = CompanionItemPoint & Readonly<{ id: string; width: number }>;
export type CompanionItemLanding = CompanionItemPoint & { platformId: string; overlap: number; clearance: number; distance: number };
const finite = (p: CompanionItemPoint) => Number.isFinite(p.x) && Number.isFinite(p.y);
const clamp = (v: number, low: number, high: number) => Math.max(low, Math.min(high, v));

/** Free44px footprints come first. Once crowded, protect the closest neighbour
 * before total shared area: an area tie must not stack everything at an edge. */
export function compareCompanionItemLandings(a: CompanionItemLanding, b: CompanionItemLanding) {
  return Number(a.overlap > 0) - Number(b.overlap > 0) || b.clearance - a.clearance
    || a.overlap - b.overlap || a.distance - b.distance || a.x - b.x || a.platformId.localeCompare(b.platformId);
}

/** Prefer a free footprint, then maximize the worst remaining separation.
 * Reservations include destinations of the other finite, still-falling items. */
export function rankCompanionItemLandings(spans: readonly CompanionItemSpan[], preferredX: number, occupied: readonly CompanionItemPoint[]) {
  if (!Number.isFinite(preferredX)) return [];
  const items = occupied.slice(0, 12).filter(finite);
  const result: CompanionItemLanding[] = [];
  for (const span of spans.slice(0, 8)) {
    if (!span.id || !finite(span) || !Number.isFinite(span.width) || span.width < 0) continue;
    const end = span.x + span.width;
    if (!Number.isFinite(end)) continue;
    const xs = new Set([span.x, end, clamp(preferredX, span.x, end)]);
    for (const point of items) if (Math.abs(point.y - span.y) < 44) {
      xs.add(clamp(point.x - 44, span.x, end)); xs.add(clamp(point.x + 44, span.x, end));
    }
    const neighbours = items.filter(p => Math.abs(p.y - span.y) < 44).map(p => p.x).sort((a, b) => a - b);
    for (let i = 1; i < neighbours.length; i++) xs.add(clamp((neighbours[i - 1] + neighbours[i]) / 2, span.x, end));
    for (const x of xs) {
      const overlap = items.reduce((sum, p) => sum + Math.max(0, 44 - Math.abs(p.x - x)) * Math.max(0, 44 - Math.abs(p.y - span.y)), 0);
      const clearance = Math.min(44, ...neighbours.map(px => Math.abs(px - x)));
      result.push({ x, y: span.y, platformId: span.id, overlap, clearance, distance: Math.abs(x - preferredX) });
    }
  }
  return result.sort(compareCompanionItemLandings);
}
