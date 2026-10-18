import type { CompanionInstrumentPulse } from "./instrument-music";
import type { CompanionPreferences } from "./preferences";
import { DEFAULT_COMPANION_LIFE, type CompanionLife } from "./life";
import { getCompanionRadioReaction, sampleCompanionRadioReaction, type CompanionRadioReaction } from "./radio-reaction";

export type CompanionInstrumentReaction = CompanionRadioReaction | "encourage" | "tease";
export function createCompanionInstrumentInbox() {
  let last: CompanionInstrumentPulse | undefined, gaps: number[] = [];
  let pending: { pulse: CompanionInstrumentPulse; quality: "steady" | "uneven" | "unknown"; expires: number } | undefined;
  return {
    offer(pulse: CompanionInstrumentPulse, now: number, allowed: boolean) {
      if (!allowed) { this.clear(); return; }
      if (![pulse?.at, pulse?.bpm, pulse?.expectedGapMs, now].every(Number.isFinite) || pulse.expectedGapMs <= 0 || pulse.expectedGapMs > 3000 || !["lively", "graceful", "calm"].includes(pulse.mood) || pulse.at > now + 100 || now - pulse.at > 1000) return;
      const gap = last ? pulse.at - last.at : 0;
      if (last && gap <= 0) return;
      if (gap > 0 && gap < 3500) gaps = [...gaps, gap].slice(-6); else gaps = [];
      last = pulse;
      const mean = gaps.reduce((sum, value) => sum + value, 0) / (gaps.length || 1);
      const spread = Math.sqrt(gaps.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (gaps.length || 1)) / Math.max(1, mean);
      const quality = gaps.length < 3 ? "unknown" : spread <= .2 ? "steady" : spread >= .4 ? "uneven" : "unknown";
      pending = { pulse, quality, expires: now + 6000 };
    },
    take(now: number) { const next = pending; pending = undefined; return next && now <= next.expires ? next : undefined; },
    clear() { last = pending = undefined; gaps = []; },
  };
}

/** Transient rhythm feedback changes neither the player's stats nor learned
 * traits. A steady half/double tempo is still steady; no negative grade UI. */
export function getCompanionInstrumentReaction(input: { mood: CompanionInstrumentPulse["mood"]; quality: "steady" | "uneven" | "unknown"; preferences: CompanionPreferences; life?: CompanionLife; energy: number }): CompanionInstrumentReaction {
  const normal = getCompanionRadioReaction(input);
  const learned = input.preferences.learnFromYou ? input.life ?? DEFAULT_COMPANION_LIFE : DEFAULT_COMPANION_LIFE;
  if (normal === "ignore" || input.quality !== "uneven") return normal;
  if (input.preferences.personality === "affectionate" || input.preferences.animalMode === "dog") return "encourage";
  if (input.preferences.personality === "sleepy" || input.preferences.animalMode === "cat" && learned.social < .6) return "ignore";
  return learned.play >= .45 ? "tease" : "sway";
}

export function sampleCompanionInstrumentReaction(reaction: CompanionInstrumentReaction, age: number, bpm: number) {
  if (reaction !== "encourage" && reaction !== "tease") return sampleCompanionRadioReaction(reaction, age, bpm);
  const base = sampleCompanionRadioReaction("sway", age, bpm);
  return { ...base, row: base.done ? 0 : reaction === "encourage" ? 29 : 28, tilt: base.tilt * (reaction === "tease" ? 1.5 : .6), bob: base.bob * .5 };
}
