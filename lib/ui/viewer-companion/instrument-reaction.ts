import type { CompanionInstrumentPulse } from "./instrument-music";
import type { CompanionPreferences } from "./preferences";
import { DEFAULT_COMPANION_LIFE, type CompanionLife } from "./life";
import { getCompanionRadioReaction, sampleCompanionRadioReaction, type CompanionRadioReaction } from "./radio-reaction";

export type CompanionInstrumentReaction = CompanionRadioReaction | "encourage" | "tease";
export function createCompanionInstrumentInbox() {
  let anchor: { sequence: number; segment: number; index: number; tapAt: number; onsetMs: number; lastTapAt: number; lastOnsetMs: number; outputDelay: number; gapMs: number; errors: number[] } | undefined;
  let pending: { pulse: CompanionInstrumentPulse; quality: "steady" | "uneven" | "unknown"; expires: number } | undefined;
  return {
    offer(pulse: CompanionInstrumentPulse, now: number, allowed: boolean) {
      if (!allowed) { this.clear(); return; }
      if (![pulse?.at, pulse?.bpm, pulse?.expectedGapMs, now].every(Number.isFinite) || pulse.expectedGapMs <= 0 || pulse.expectedGapMs > 15000 || !["lively", "graceful", "calm"].includes(pulse.mood) || pulse.at > now + 100 || now - pulse.at > 1000) return;
      let quality: "steady" | "uneven" | "unknown" = "unknown";
      const score = pulse.rhythm;
      const scored = score && [score.sequence, score.segment, score.index].every(value => Number.isSafeInteger(value) && value >= 0)
        && [score.onsetMs, score.gapMs, score.tapAt, score.audibleAt].every(Number.isFinite)
        && score.onsetMs >= 0 && score.onsetMs < 3_600_000 && score.gapMs > 0 && score.gapMs <= 15000 && score.tapAt <= pulse.at + 5 && pulse.at - score.tapAt <= 120
        && score.audibleAt >= pulse.at - 10 && score.audibleAt - pulse.at <= 500;
      if (!scored) anchor = undefined;
      else {
        const outputDelay = score.audibleAt - pulse.at;
        const continuous = anchor && anchor.sequence === score.sequence && anchor.segment === score.segment && score.index === anchor.index + 1
          && score.tapAt > anchor.lastTapAt && score.onsetMs > anchor.lastOnsetMs
          && Math.abs(outputDelay - anchor.outputDelay) <= 80
          && score.tapAt - anchor.lastTapAt <= Math.max(2500, anchor.gapMs * 1.8 + 500);
        if (!continuous) anchor = { sequence: score.sequence, segment: score.segment, index: score.index, tapAt: score.tapAt, onsetMs: score.onsetMs, lastTapAt: score.tapAt, lastOnsetMs: score.onsetMs, outputDelay, gapMs: score.gapMs, errors: [] };
        else if (anchor) {
          // The first admitted tap anchors phase. Compare every later onset
          // with this arrangement's fixed score clock, including long notes,
          // rests and subdivisions. Input time compensates render/driver
          // delay; a changed audio clock resets confidence, never the grade.
          const expected = score.onsetMs - anchor.onsetMs;
          const tolerance = Math.max(45, Math.min(110, Math.min(anchor.gapMs, score.gapMs) * .22));
          const error = Math.abs((score.tapAt - anchor.tapAt) - expected) / tolerance;
          anchor.errors = [...anchor.errors, error].slice(-6);
          if (anchor.errors.length >= 3) {
            const bad = anchor.errors.filter(value => value > 1).length / anchor.errors.length;
            quality = error > 2.5 || bad >= .5 ? "uneven" : bad <= .2 && error <= 1 ? "steady" : "unknown";
          }
          anchor.index = score.index; anchor.lastTapAt = score.tapAt; anchor.lastOnsetMs = score.onsetMs; anchor.outputDelay = outputDelay; anchor.gapMs = score.gapMs;
        }
      }
      pending = { pulse, quality, expires: now + 6000 };
    },
    take(now: number) { const next = pending; pending = undefined; return next && now <= next.expires ? next : undefined; },
    clear() { anchor = pending = undefined; },
  };
}

/** Transient notation feedback changes neither stats nor learned traits.
 * Unknown scores/automatic fanfares cannot grade a player's rhythm. */
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
