export type CompanionEyeView = "front" | "quarter" | "side" | "back";

/** Existing vector camera projections, shared by its source cells and fitting.
 * Expression-specific eye boxes own contact, not a worn object's nominal size. */
export function companionEyeViewScale(view: CompanionEyeView): number {
  return view === "quarter" ? .83 : view === "side" ? .56 : 1;
}

export function companionEyeAccessorySpan(standingSpan: number, view: CompanionEyeView): number | undefined {
  return Number.isFinite(standingSpan) && standingSpan > 0 ? standingSpan * companionEyeViewScale(view) : undefined;
}
