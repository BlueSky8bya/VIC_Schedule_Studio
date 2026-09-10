/** Deterministic, bounded pointer depth. Simulation time only; no spring integration. */
export type DepthPoint = { x: number; y: number };
export type DepthTier = "full" | "lite" | "still";
export type DepthOffsets = { far: DepthPoint; ground: DepthPoint; frame: DepthPoint };
export const DEPTH_PAD = 32;
export const DEPTH_TAU = 0.12;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export function depthOffsets(p: DepthPoint, width: number, dpr: number, tier: DepthTier, gain = 1): DepthOffsets {
  const scale = Math.min(1, width / 1400) * clamp(gain, 0, 1);
  const round = (v: number) => Math.round(v * Math.max(0.1, dpr)) / Math.max(0.1, dpr);
  const at = (x: number, y: number) => ({ x: round(-p.x * x * scale), y: round(-p.y * y * scale) });
  if (tier === "still") return { far: at(0, 0), ground: at(0, 0), frame: at(0, 0) };
  return tier === "lite" ? { far: at(1, 0), ground: at(4, 1), frame: at(4, 1) }
    : { far: at(3, 0), ground: at(8, 2), frame: at(16, 4) };
}
export function createDepthPointer() {
  let from: DepthPoint = { x: 0, y: 0 }, target: DepthPoint = { x: 0, y: 0 }, t0 = 0;
  const value = (t: number): DepthPoint => {
    const k = Math.exp(-Math.max(0, t - t0) / DEPTH_TAU);
    const axis = (a: number, b: number) => Math.abs(a - b) * k < 0.0001 ? b : b + (a - b) * k;
    return { x: axis(from.x, target.x), y: axis(from.y, target.y) };
  };
  return {
    value,
    reset(t: number) { from = target = { x: 0, y: 0 }; t0 = t; },
    aim(t: number, pointer: { x: number; y: number; inside: boolean }, w: number, h: number) {
      const next = pointer.inside && w > 0 && h > 0
        ? { x: clamp(2 * pointer.x / w - 1, -1, 1), y: clamp(2 * pointer.y / h - 1, -1, 1) } : { x: 0, y: 0 };
      if (next.x === target.x && next.y === target.y) return;
      from = value(t); target = next; t0 = t;
    }
  };
}

/** Temporary quality, not the persisted two-visit device classification. */
export function createDepthBudget() {
  let tier: DepthTier = "full", bad = 0, good = 0, goodMs = 0;
  return {
    get tier() { return tier; },
    reset(next: DepthTier = "full") { tier = next; bad = good = goodMs = 0; },
    sample(mean: number, late: number, load: number, pref: "auto" | "max" | "lite" | "off") {
      if (pref === "max") { tier = "full"; bad = good = 0; return tier; }
      if (pref === "off") return tier = "still";
      if (pref === "lite" && tier === "full") tier = "lite";
      const poor = mean > 21 || late > 0.12;
      bad = poor ? bad + 1 : 0;
      good = mean < 18.5 && late < 0.03 ? good + 1 : 0;
      goodMs = good ? goodMs + mean * 90 : 0;
      if (bad >= 2) {
        if (tier === "full" && load < 0.45) tier = "lite";
        else if (tier === "lite" && (pref === "lite" || load < 0.2)) tier = "still";
        bad = 0;
      }
      if (good >= 5 && goodMs >= 10000) {
        if (tier === "still") tier = "lite";
        else if (pref === "auto" && load > 0.6) tier = "full";
        good = goodMs = 0;
      }
      return tier;
    },
    recover() { tier = "lite"; bad = good = goodMs = 0; }
  };
}
