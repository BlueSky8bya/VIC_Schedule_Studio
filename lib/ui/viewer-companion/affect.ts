/** Small authored appraisal state, not a model of human emotion. Values live
 * only in this creature's session and advance through supplied active time. */
export type CompanionMood = "neutral" | "happy" | "disappointed" | "sulky";
export type CompanionAffect = { joy: number; frustration: number; handling: number; handlingQuietMs: number };
export type CompanionAppraisalEvent = "petted" | "ate" | "rested" | "heart-blocked" | "food-lost" | "handled";
const unit = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function createCompanionAffect(): CompanionAffect { return { joy: 0, frustration: 0, handling: 0, handlingQuietMs: 0 }; }

export function advanceCompanionAffect(state: CompanionAffect, elapsedMs: number): CompanionAffect {
  const ms = Math.max(0, Math.min(30000, Number.isFinite(elapsedMs) ? elapsedMs : 0));
  return {
    joy: unit(state.joy - ms / 6500),
    frustration: unit(state.frustration - ms / 9000),
    handling: unit(state.handling - ms / 12000),
    handlingQuietMs: Math.max(0, state.handlingQuietMs - ms),
  };
}

export function appraiseCompanionEvent(state: CompanionAffect, event: CompanionAppraisalEvent): CompanionAffect {
  if (event === "petted" || event === "ate") return { ...state, joy: .9, frustration: unit(state.frustration - .5), handling: unit(state.handling - .35) };
  if (event === "rested") return { ...state, frustration: unit(state.frustration - .3), handling: 0 };
  if (event === "handled") {
    // One pickup is ordinary play. Repeated distinct pickups can earn a brief
    // pout, while one held gesture cannot accumulate frustration every frame.
    if (state.handlingQuietMs > 0) return state;
    const handling = unit(state.handling + .34);
    // .82 leaves about1.15s of readable pout after a650ms release/landing;
    // the earlier .7 fell below the pose threshold almost on arrival.
    return { ...state, handling, handlingQuietMs: 650, joy: unit(state.joy - .15), frustration: handling > .7 ? Math.max(state.frustration, .82) : state.frustration };
  }
  return { ...state, joy: 0, frustration: unit(Math.max(.38, state.frustration + (event === "food-lost" ? .38 : .3))) };
}

export function companionMood(state: CompanionAffect): CompanionMood {
  // Direct friendly contact wins immediately, including a recent small pout.
  if (state.joy >= .18) return "happy";
  if (state.frustration >= .62) return "sulky";
  if (state.frustration >= .16) return "disappointed";
  return "neutral";
}
