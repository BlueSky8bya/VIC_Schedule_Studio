import type { CompanionIndividualContext, CompanionIndividualExperience } from "./individuality";

/** Only confirmed direct contact opens a session. Raw input, clocks and object
 * identities are never persisted. An ignored invitation creates no feedback. */
export function createCompanionInteractionLearning() {
  let contact: { began: number; last: number; generation: number; context: CompanionIndividualContext; place: "home" | "card" | "floor" } | undefined;
  let discovery: { until: number; generation: number; context: CompanionIndividualContext } | undefined;
  const shared = (at: number, generation: number, context: CompanionIndividualContext) => Boolean(discovery && discovery.generation === generation && discovery.context === context && at <= discovery.until);
  return {
    contact(at: number, generation: number, context: CompanionIndividualContext, place: "home" | "card" | "floor") {
      if (!Number.isFinite(at)) return;
      if (!contact || contact.generation !== generation) contact = { began: at, last: at, generation, context, place };
      else contact.last = at;
    },
    touch(at: number) { if (contact && Number.isFinite(at)) contact.last = Math.max(contact.last, at); },
    finish(at: number, generation: number, force = false): { kind: CompanionIndividualExperience; context: CompanionIndividualContext; place: "home" | "card" | "floor" } | undefined {
      if (!contact || !Number.isFinite(at) || !force && at - contact.last < 1000) return;
      const ended = contact; contact = undefined;
      if (ended.generation !== generation || at < ended.last) return;
      const kind = shared(ended.last, generation, ended.context) ? "shared-discovery" : ended.last - ended.began >= 3000 ? "long-contact" : "short-contact";
      if (kind === "shared-discovery") discovery = undefined;
      return { kind, context: ended.context, place: ended.place };
    },
    discovered(at: number, generation: number, context: CompanionIndividualContext) {
      if (Number.isFinite(at)) discovery = { until: at + 12000, generation, context };
    },
    play(at: number, generation: number, context: CompanionIndividualContext): CompanionIndividualExperience {
      const kind = shared(at, generation, context) ? "shared-discovery" : "shared-play";
      if (kind === "shared-discovery") discovery = undefined;
      return kind;
    },
    /** Environmental interruptions are unobserved contact, not preference.
     * Keep a real discovery pending for a later deliberate response. */
    cancelContact() { contact = undefined; },
    reset() { contact = undefined; discovery = undefined; },
  };
}
