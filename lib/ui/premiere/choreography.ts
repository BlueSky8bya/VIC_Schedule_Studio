// Public timing only. Never derives layout, progress or placeholders from hidden content.
export const REGION_WINDOWS: Record<string, readonly [number, number]> = {
  "1": [180, 168], // debut
  "6": [174, 162], // live card
  "5": [166, 154], // season controls
  "7": [158, 156], // 1.8s exit lands at156.2; badge takes its slot from156
  "2": [154, 138], // filters
  "3": [122, 112], // navigation/chrome
  "4": [96, 84] // ambient
};
export function passage(seconds: number, from: number, to: number): number {
  const t = Math.max(0, Math.min(1, (from - seconds) / (from - to)));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
export type CardDeparture = { start: number; end: number; variant: number };

function hash(value: string): number {
  let n = 2166136261;
  for (let i = 0; i < value.length; i++) n = Math.imul(n ^ value.charCodeAt(i), 16777619);
  return n >>> 0;
}

// Public IDs and reveal generation only. Segments share one slot; DOM order,
// viewport size and clock ticks cannot reshuffle an ongoing performance.
export function planCardDepartures(ids: string[], seed: string): Map<string, CardDeparture> {
  const shuffled = [...new Set(ids)].sort((a, b) => hash(`${seed}:${a}`) - hash(`${seed}:${b}`) || a.localeCompare(b));
  const spacing = shuffled.length > 1 ? 49.6 / (shuffled.length - 1) : 0;
  const duration = Math.min(1.4, spacing ? spacing * .85 : 1.4);
  return new Map(shuffled.map((id, index) => {
    const start = 126 - index * spacing;
    return [id, { start, end: start - duration, variant: index % 4 }];
  }));
}

// New schedules must not reset the slots of cards already leaving.
export function lateCardDeparture(id: string, seed: string): CardDeparture {
  const start = 126 - (hash(`${seed}:${id}`) / 0xffffffff) * 49.6;
  return { start, end: start - 1.4, variant: hash(id) % 4 };
}
