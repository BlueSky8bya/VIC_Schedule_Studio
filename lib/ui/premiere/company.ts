import { hypeIntensity, hypeMotionFrame } from "@/lib/ui/hype-curve";
import { passage } from "./choreography";

/** Controls/host retire before ten; the audience quietly gathers until eight.
 * The numbered ring retains its own 10→2s transformation. */
export function premiereCompany(remainMs: number) {
  const seconds = remainMs / 1000;
  const retire = passage(seconds, 18, 10.5);
  const settle = passage(seconds, 21, 14);
  const strength = (.25 + hypeIntensity(remainMs) * .75) * (1 - settle);
  return { retire, settle, strength, audienceOpacity: Number.isFinite(seconds) ? 1 - passage(seconds, 5, 2) : 1, phase: hypeMotionFrame(remainMs, hypeIntensity(remainMs)).beatPhase };
}

function random(seed: number, salt: number) {
  let value = (seed >>> 0) ^ Math.imul(salt + 1, 0x9e3779b1);
  value = Math.imul(value ^ value >>> 16, 0x21f0aaad);
  value = Math.imul(value ^ value >>> 15, 0x735a2d97);
  return ((value ^ value >>> 15) >>> 0) / 0x100000000;
}

/** One random opening seed produces six stable, independent scores. Rendering,
 * hope toggles, clock corrections and visibility returns never draw again. */
export function premiereAudienceSeed(opening: number, index: number) {
  return Math.floor(random(opening, Math.max(0, Math.min(5, index))) * 0x100000000);
}

export function premiereAudienceTiming(seed: number) {
  return {
    turnStart: 13.6 + random(seed, 11) * 1.2,
    turnEnd: 10.75 + random(seed, 12) * .9,
    seatStart: 10.5 - random(seed, 13) * .55,
    seatEnd: 8.45 + random(seed, 14) * .35
  };
}

// Native cells9/10 reverse the inner-ear colors. Preserve the evidence asset,
// and select only the ten usable frames, in several complete small gestures.
const gestures = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 11],
  [0, 1, 2, 1, 0, 11],
  [0, 6, 7, 8, 7, 6, 0],
  [0, 2, 3, 4, 5, 2, 0]
];

/** Pure score sampling on the existing clock: individual bouts, tempo and
 * pauses rather than six phase offsets of one endlessly identical loop. */
export function premiereAudienceFrame(remainMs: number, seed: number, cheerAgeMs = Infinity, lite = false) {
  if (!Number.isFinite(remainMs)) return 15;
  const timing = premiereAudienceTiming(seed), seconds = remainMs / 1000;
  if (seconds <= timing.turnEnd) return 15;
  if (seconds <= timing.turnStart) return Math.min(15, 12 + Math.floor((timing.turnStart - seconds) / (timing.turnStart - timing.turnEnd) * 4));
  const elapsed = Math.max(0, 68000 - remainMs);
  const cheering = cheerAgeMs >= 0 && cheerAgeMs < 1500;
  const period = 2300 + random(seed, 20) * 1700;
  const offset = random(seed, 21) * period, slot = Math.floor((elapsed + offset) / period);
  const scoreSeed = premiereAudienceSeed(seed, slot % 6) ^ Math.imul(slot, 0x45d9f3b);
  const gesture = gestures[Math.floor(random(scoreSeed, cheering ? 23 : 22) * gestures.length)];
  const stepMs = lite ? 230 + random(scoreSeed, 24) * 70 : 115 + random(scoreSeed, 24) * 65;
  const age = cheering ? cheerAgeMs : (elapsed + offset) % period - random(scoreSeed, 25) * 550;
  if (age < 0 || age >= gesture.length * stepMs) return random(scoreSeed, 26) < .5 ? 0 : 11;
  return gesture[Math.floor(age / stepMs)];
}

/** One finite walk towards the screen after turning around. No loop, restart
 * on tab return, or animation in the final eight seconds. */
export function premiereAudienceSeat(remainMs: number, index: number, lite = false, seed = premiereAudienceSeed(0, index)) {
  if (!Number.isFinite(remainMs)) return { progress: 0, y: 0, depth: 1 };
  const timing = premiereAudienceTiming(seed);
  // Leave clock-sample + CSS interpolation margin before the eight-second cut.
  const progress = passage(remainMs / 1000, timing.seatStart, timing.seatEnd);
  const step = Math.sin(Math.PI * progress) * Math.sin(progress * Math.PI * 4) * (lite ? .5 : 1.25);
  return { progress, y: -progress * (lite ? 3 : 6) + step, depth: 1 - progress * .14 };
}
