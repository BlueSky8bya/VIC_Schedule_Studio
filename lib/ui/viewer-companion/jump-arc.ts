export type CompanionBallisticArc = { coefficient: number; apexProgress: number };

const positive = (value: number) => Number.isFinite(value) && value > 0 ? value : 0;
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Bound only the lift in y(p)=lerp(from,to,p)-coefficient*p*(1-p).
 * The caller retains its endpoints, flight duration and support identity.
 * For endpoint clearances a,b, the largest safe coefficient is
 * (sqrt(a)+sqrt(b))²: min(a/p+b/(1-p)). No per-frame position clamp or
 * flattened plateau is needed. A real anchor outside the ceiling remains
 * outside; the renderer must retain its ordinary visibility/safety guard. */
export function boundCompanionBallisticArc(fromY: number, toY: number, coefficient: number, ceiling: number): CompanionBallisticArc {
  if (![fromY, toY, ceiling].every(Number.isFinite)) return { coefficient: 0, apexProgress: 0 };
  let bounded = positive(coefficient);
  if (fromY >= ceiling && toY >= ceiling) {
    // A sub-micro-pixel interior margin also covers cancellation in lerp when
    // a distant origin lands almost exactly on the ceiling. Endpoints stay put.
    const safeCeiling = Math.min(fromY, toY, ceiling + 1e-7);
    const budget = Math.sqrt(fromY - safeCeiling) + Math.sqrt(toY - safeCeiling);
    const cap = budget * budget;
    // Stay a few floating-point ulps inside a touching apex. The renderer's
    // strict y<ceiling guard must not hide a99.99999999999999px sample.
    if (Number.isFinite(cap)) bounded = Math.min(bounded, Math.max(0, cap - Math.max(1, cap) * Number.EPSILON * 16));
  }
  const apex = bounded > 0 ? .5 - (toY - fromY) / (2 * bounded) : toY < fromY ? 1 : 0;
  return { coefficient: bounded, apexProgress: Number.isFinite(apex) ? clamp(apex) : toY < fromY ? 1 : 0 };
}

/** The home/settle paths ease their baseline separately from sin(pπ).
 * The smaller endpoint clearance safely bounds that sine at every progress,
 * including any monotone baseline easing. Offscreen anchors are not moved. */
export function boundCompanionSineArc(fromY: number, toY: number, amplitude: number, ceiling: number): number {
  if (![fromY, toY, ceiling].every(Number.isFinite)) return 0;
  const requested = positive(amplitude);
  return fromY >= ceiling && toY >= ceiling ? Math.min(requested, Math.min(fromY, toY) - ceiling) : requested;
}
