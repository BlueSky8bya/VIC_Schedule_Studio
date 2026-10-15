export type RegionDeparture = Readonly<{ progress: number; travel: number; anticipation: number; fold: number; opacity: number }>;
export const REGION_DEPARTURE_SECONDS = 1.8;
export const REGION_DEPARTURE_STAGGER = .14;
/** Actual layout/visual viewport intersection. Transformed offscreen panels can
 * inflate mobile innerWidth/innerHeight, so neither is a geometry input. */
export function premiereViewportBounds(input: { clientWidth: number; clientHeight: number; visualViewport?: { width: number; height: number; offsetLeft?: number; offsetTop?: number } | null }) {
  const positive = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
  const visual = input.visualViewport;
  const clientWidth = positive(input.clientWidth) || positive(visual?.width) || 1;
  const clientHeight = positive(input.clientHeight) || positive(visual?.height) || 1;
  const offset = (value: number | undefined, limit: number) => Math.max(0, Math.min(limit - 1, typeof value === "number" && Number.isFinite(value) ? value : 0));
  const left = visual && positive(visual.width) ? offset(visual.offsetLeft, clientWidth) : 0;
  const top = visual && positive(visual.height) ? offset(visual.offsetTop, clientHeight) : 0;
  const right = Math.max(left + 1, Math.min(clientWidth, left + (positive(visual?.width) || clientWidth)));
  const bottom = Math.max(top + 1, Math.min(clientHeight, top + (positive(visual?.height) || clientHeight)));
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return clamp(t * t * t * (t * (t * 6 - 15) + 10)); };
const resting = (): RegionDeparture => ({ progress: 0, travel: 0, anticipation: 0, fold: 0, opacity: 1 });

/** One short departure inside the existing public region window. Geometry
 * and direction belong to the caller; this score never measures or loops.
 * A late topology arrival samples its current place instead of replaying. */
export function regionDeparture(seconds: number, window: readonly [number, number], index = 0): RegionDeparture {
  const [from, to] = window;
  if (![seconds, from, to].every(Number.isFinite) || from <= to) return resting();
  const duration = Math.min(REGION_DEPARTURE_SECONDS, from - to);
  const order = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0;
  const stagger = Math.min(order * REGION_DEPARTURE_STAGGER, from - to - duration);
  const elapsed = from - stagger - seconds;
  const progress = elapsed >= duration - 1e-10 ? 1 : clamp(elapsed / duration);
  const anticipation = progress > 0 && progress < .26 ? Math.sin(progress / .26 * Math.PI) ** 2 : 0;
  return {
    progress,
    anticipation,
    travel: smooth((progress - .14) / .86),
    fold: smooth((progress - .24) / .76),
    // The card remains tangible through preparation and most of its flight.
    opacity: 1 - smooth((progress - .56) / .44),
  };
}
