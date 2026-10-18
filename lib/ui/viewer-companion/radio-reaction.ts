import type { CompanionHabits } from "./habits";
import { DEFAULT_COMPANION_LIFE, type CompanionLife } from "./life";
import type { CompanionPreferences } from "./preferences";
import { COMPANION_FULL_THRESHOLD } from "./care";

export type CompanionRadioMood = "lively" | "graceful" | "calm";
export type CompanionRadioReaction = "bounce" | "sway" | "calm" | "bored" | "ignore";
export type CompanionRadioMoment = { generation: number; playing: boolean; mood: CompanionRadioMood | null; bpm: number };
export const COMPANION_RADIO_REACTION_MS = 5200;
const bounded = (value: number | undefined, fallback: number, min = 0, max = 1) => Number.isFinite(value) ? Math.max(min, Math.min(max, value!)) : fallback;

/** A full pet may ignore a leftover snack and listen. Only food it can
 * actually pursue at the existing feeding threshold takes meal priority. */
export function companionRadioFoodPriority(input: { feeding: boolean; hunger: number; availableFoods: number }): boolean {
  return input.feeding && input.hunger >= COMPANION_FULL_THRESHOLD && input.availableFoods > 0;
}

/** Existing chosen/earned traits select interest; listening earns no care,
 * habit, discovery or persistent timestamp. Learning OFF uses authored traits. */
export function getCompanionRadioReaction(input: { mood: CompanionRadioMood; preferences: CompanionPreferences; habits?: CompanionHabits; life?: CompanionLife; energy: number }): CompanionRadioReaction {
  const { preferences: p } = input;
  if (!p.enabled || !p.roam || !Number.isFinite(input.energy) || input.energy < .3) return "ignore";
  const life = p.learnFromYou ? input.life ?? DEFAULT_COMPANION_LIFE : DEFAULT_COMPANION_LIFE;
  const play = bounded(life.play, .5) + (p.learnFromYou ? bounded(input.habits?.playfulness, 0, -1, 1) * .15 : 0);
  if (input.mood === "lively") {
    if (p.personality === "sleepy") return play >= .72 && input.energy >= .65 ? "sway" : "ignore";
    if (p.animalMode === "cat") return play < .35 && bounded(life.social, .5) < .4 ? "ignore" : "sway";
    if (play < .3 && p.personality === "curious") return "ignore";
    return input.energy >= .5 && (play >= .45 || p.personality === "affectionate" || p.animalMode === "dog") ? "bounce" : "sway";
  }
  if (play >= .65 || p.speed === "lively" && p.personality === "curious" && bounded(life.curiosity, .5) >= .55) return "bored";
  return p.personality === "sleepy" || p.personality === "affectionate" || p.animalMode === "cat" || bounded(life.comfort, .5) >= .6 ? "calm" : "sway";
}

/** Stable real support with room for the complete92px body and its small
 * musical bob. This is a same-support gesture, never an implicit jump/route. */
export function canStartCompanionRadioReaction(input: { enabled: boolean; react: boolean; roam: boolean; focused: boolean; hidden: boolean; reduced: boolean; graphics: string; stable: boolean; safe: boolean; busy: boolean; headroom: number; edgeClearance: number; energy: number }): boolean {
  return input.enabled && input.react && input.roam && input.focused && !input.hidden && !input.reduced && !["off", "soft"].includes(input.graphics) && input.stable && input.safe && !input.busy
    && [input.headroom, input.edgeClearance, input.energy].every(Number.isFinite) && input.headroom >= 112 && input.edgeClearance >= 48 && input.energy >= .3;
}

/** Only a newly and actually playing generation may offer one short reaction.
 * Hidden/blocked offers are consumed, not saved for an unexpected catch-up. */
export function createCompanionRadioReactionInbox(initialGeneration = 0) {
  let seen = initialGeneration, pending: { moment: CompanionRadioMoment; expires: number } | undefined;
  return {
    offer(moment: CompanionRadioMoment, now: number, allowed: boolean) {
      if (!moment.playing) { pending = undefined; return; }
      if (!Number.isSafeInteger(moment.generation) || moment.generation <= seen) return;
      seen = moment.generation; pending = undefined;
      if (allowed && moment.mood && Number.isFinite(now)) pending = { moment: { ...moment }, expires: now + 8000 };
    },
    peek(moment: CompanionRadioMoment, now: number) {
      if (!pending || !moment.playing || moment.generation !== pending.moment.generation || !Number.isFinite(now) || now > pending.expires) { pending = undefined; return; }
      return pending.moment;
    },
    take(moment: CompanionRadioMoment, now: number) { const offered = this.peek(moment, now); pending = undefined; return offered; },
    clear() { pending = undefined; },
  };
}

/** Source rows remain idle/look/happy/yawn. Transform envelopes return exactly
 * to rest, share the world pose clock and add neither limbs nor a second RAF. */
export function sampleCompanionRadioReaction(reaction: CompanionRadioReaction, elapsedMs: number, bpm: number) {
  const progress = bounded(elapsedMs / COMPANION_RADIO_REACTION_MS, 0), beatMs = 60000 / bounded(bpm, 96, 48, 180);
  const age = bounded(elapsedMs, 0, 0, COMPANION_RADIO_REACTION_MS), beat = age / beatMs, phase = (Math.sin(beat * Math.PI * 2) + 1) / 2;
  const envelope = Math.sin(progress * Math.PI) ** 2, wave = Math.sin(beat * Math.PI * 2) * envelope;
  let row = 0, bob = 0, tilt = 0, squash = 0;
  if (reaction === "bounce") { row = 9; bob = -Math.max(0, Math.sin(beat * Math.PI * 2)) * envelope * 5; tilt = wave * 6; squash = Math.max(0, -Math.sin(beat * Math.PI * 2)) * envelope * .045; }
  else if (reaction === "sway") { row = progress < .12 ? 1 : 9; bob = -phase * envelope * 1.4; tilt = wave * 4; }
  else if (reaction === "calm") { row = 1; bob = -phase * envelope * .6; tilt = wave * 1.3; }
  else if (reaction === "bored") { row = progress < .58 ? 10 : 1; tilt = envelope * -2; }
  if (progress <= 0 || progress >= 1 || reaction === "ignore") { bob = tilt = squash = 0; if (progress >= 1) row = 0; }
  return { row, frame: reaction === "bored" && row === 10 ? Math.min(1, progress / .58) * 15 : phase * 15, bob, tilt, squash, done: progress >= 1 };
}
