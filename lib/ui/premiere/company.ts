import { hypeIntensity, hypeMotionFrame } from "@/lib/ui/hype-curve";
import { passage } from "./choreography";

/** All decorative actors finish retiring BEFORE the final ten seconds.
 * The numbered ring retains its own 10→2s transformation. */
export function premiereCompany(remainMs: number) {
  const seconds = remainMs / 1000;
  const retire = passage(seconds, 18, 10.5);
  const settle = passage(seconds, 21, 14);
  const strength = (.25 + hypeIntensity(remainMs) * .75) * (1 - settle);
  return { retire, settle, strength, phase: hypeMotionFrame(remainMs, hypeIntensity(remainMs)).beatPhase };
}

/** Original pentatonic ostinato, written here: no recording, sampled melody or
 * YouTube countdown audio. Density grows, loudness stays bounded; silence first. */
export function premiereScore(remainMs: number) {
  const seconds = remainMs / 1000;
  if (!Number.isFinite(seconds) || seconds <= 10.5 || seconds > 68) return null;
  const elapsed = 68 - seconds;
  // Continuous beat phase: 0.9 → 1.7 beats/sec, no tempo staircase.
  const phase = elapsed * .9 + elapsed * elapsed * .007;
  const beat = Math.floor(phase);
  const motif = [0, 7, 12, 16, 7, 19, 12, 7];
  return { beat, semi: motif[beat % motif.length], bass: beat % 4 === 0,
    level: .13 * (1 - passage(seconds, 15, 10.5)),
    duration: Math.min(.42, Math.max(0, seconds - 10.5)) };
}
