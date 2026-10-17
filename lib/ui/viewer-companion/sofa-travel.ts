import { boundCompanionBallisticArc, companionBallisticArcIsSafe } from "./jump-arc";

type Point = Readonly<{ x: number; y: number }>;
export type CompanionSofaTravelBounds = Readonly<{
  left: number;
  right: number;
  /** The registered opaque half-width, with the same containment margin as
   * the measured seat. This is not the transparent atlas cell's half-width. */
  bodyHalfWidth: number;
  ceiling: number;
}>;
export type CompanionSofaTravelShape = Readonly<{ coefficient: number; curve: "leave" | "enter" | "plain" }>;
const finitePoint = (point: Point) => [point.x, point.y].every(Number.isFinite);
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** One simultaneous x/y quadratic curve clears only the real side rims. The old
 * lift→level passage→landing route froze x during28% of either end and y
 * throughout the middle, making every house hop look rectangular.
 *
 * For a rim crossing at p, its required coefficient is a/p+b/(1-p), where
 * a,b are endpoint distances below clearance. Its maximum on a closed
 * crossing interval is at an endpoint (the only interior extremum is a
 * minimum when a,b are positive). The full finite arc therefore needs only
 * the four measured sidewall boundaries, never a per-frame collision scan.
 *
 * An impossible ceiling/start geometry is reported rather than inventing a
 * hidden high jump or moving either endpoint. The caller retains its normal
 * collider/replan recovery; it must not accept `safe:false` as a valid route. */
export function sampleCompanionSofaTravel(from: Point, to: Point, progress: number, clearanceY: number, bounds?: CompanionSofaTravelBounds, fixed?: CompanionSofaTravelShape) {
  const p = Number.isFinite(progress) ? clamp(progress) : 0;
  if (!finitePoint(from) || !finitePoint(to) || !Number.isFinite(clearanceY)) return { x: from.x, y: from.y, horizontal: 0, coefficient: 0, curve: "plain" as const, safe: false };
  const dy = to.y - from.y, dx = to.x - from.x;
  // Without furniture geometry the useful default is still one parabola,
  // with its midpoint at the requested clearance instead of a flat plateau.
  let coefficient = fixed?.coefficient ?? Math.max(0, 2 * (from.y + to.y - 2 * clearanceY));
  let safe = Number.isFinite(coefficient) && coefficient >= 0;
  let curve: CompanionSofaTravelShape["curve"] = fixed?.curve ?? "plain";
  if (bounds) {
    const { left, right, bodyHalfWidth, ceiling } = bounds;
    if (![left, right, bodyHalfWidth, ceiling].every(Number.isFinite) || right <= left || bodyHalfWidth <= 0) safe = false;
    else {
      // Contained/same-x travel does not cross either rim. Give it a modest
      // ceiling-safe lift, rather than needlessly demanding the sidewall's
      // clearance height at the midpoint of a long vertical descent.
      const natural = 4 * Math.min(60, Math.max(0, Math.min(from.y, to.y) - ceiling - 1e-5));
      let required = 0;
      const innerLeft = left + (right - left) * 31 / 180 + bodyHalfWidth;
      const innerRight = right - (right - left) * 31 / 180 - bodyHalfWidth;
      const fromInside = from.x >= innerLeft && from.x <= innerRight;
      const toInside = to.x >= innerLeft && to.x <= innerRight;
      // A snug seat gives only a few pixels of lateral clearance. Starting
      // with full horizontal speed would need an impossible vertical impulse
      // to clear its sidewall immediately. A quadratic horizontal component
      // starts/ends at zero speed on the sofa side: still one geometric
      // parabola, with no vertical hold, level plateau or separate segments.
      curve = fixed?.curve ?? (fromInside && !toInside ? "leave" : !fromInside && toInside ? "enter" : "plain");
      const timeAt = (fraction: number) => curve === "leave" ? Math.sqrt(clamp(fraction)) : curve === "enter" ? 1 - Math.sqrt(1 - clamp(fraction)) : clamp(fraction);
      const rims = [[left - bodyHalfWidth, innerLeft], [innerRight, right + bodyHalfWidth]];
      for (const [edgeLeft, edgeRight] of rims) {
        if (Math.abs(dx) < 1e-7) {
          const startY = fixed ? from.y + dy * p - coefficient * p * (1 - p) : from.y;
          if (from.x > edgeLeft && from.x < edgeRight && Math.max(startY, to.y) > clearanceY + 1e-7) safe = false;
          continue;
        }
        const crosses = [(edgeLeft - from.x) / dx, (edgeRight - from.x) / dx].sort((a, b) => a - b);
        const enter = Math.max(0, crosses[0]), leave = Math.min(1, crosses[1]);
        if (leave <= enter) continue;
        const first = Math.max(fixed ? p : 0, timeAt(enter)), last = timeAt(leave);
        if (last < first) continue;
        for (const crossing of [first, last]) {
          const baseline = from.y + dy * crossing;
          if (baseline <= clearanceY) continue;
          const denominator = crossing * (1 - crossing);
          if (denominator <= 1e-9) safe = false;
          else required = Math.max(required, (baseline - clearanceY) / denominator);
        }
      }
      if (fixed) {
        // A launched shape is immutable. More headroom never adds lift, and
        // a changed seat classification never morphs its horizontal curve.
        // Only remaining actual rim/ceiling safety is revalidated. The caller
        // adopts its carried point into finite recovery if this becomes false.
        if (coefficient < required - 1e-7 || !companionBallisticArcIsSafe(from.y, to.y, coefficient, ceiling, p)) safe = false;
      } else {
        coefficient = Math.max(natural, required);
        // A small interior margin covers floating-point touching at the rim.
        coefficient += coefficient ? 1e-6 : 0;
        const bounded = boundCompanionBallisticArc(from.y, to.y, coefficient, ceiling).coefficient;
        if (bounded < coefficient - 1e-7 || from.y < ceiling || to.y < ceiling) safe = false;
        coefficient = bounded;
      }
    }
  }
  const horizontal = curve === "leave" ? p * p : curve === "enter" ? p * (2 - p) : p;
  return { x: from.x + dx * horizontal, y: from.y + dy * p - coefficient * p * (1 - p), horizontal, coefficient, curve, safe };
}
