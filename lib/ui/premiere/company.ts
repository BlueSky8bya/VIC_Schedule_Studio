import { hypeIntensity, hypeMotionFrame } from "@/lib/ui/hype-curve";
import { passage } from "./choreography";

/** Controls/host retire before ten; the audience quietly gathers until eight.
 * The numbered ring retains its own 10→2s transformation. */
export function premiereCompany(remainMs: number) {
  const seconds = remainMs / 1000;
  const retire = passage(seconds, 18, 10.5);
  const settle = passage(seconds, 21, 14);
  const strength = (.25 + hypeIntensity(remainMs) * .75) * (1 - settle);
  return { retire, settle, strength, phase: hypeMotionFrame(remainMs, hypeIntensity(remainMs)).beatPhase };
}

/** 4×4 atlas: ten usable cheering frames, four settling frames. The shared
 * clock selects them; no per-mascot timer or replay after tab sleep. */
export function premiereAudienceFrame(remainMs: number, seed: number, cheerAgeMs = Infinity, lite = false) {
  if (!Number.isFinite(remainMs) || remainMs <= 10500) return 15;
  if (remainMs <= 12500) return Math.min(15, 12 + Math.floor((12500 - remainMs) / 500));
  const elapsed = Math.max(0, 68000 - remainMs);
  const cheering = cheerAgeMs >= 0 && cheerAgeMs < 1500;
  const step = cheering ? cheerAgeMs / 100 : elapsed / (lite ? 220 : 140) + seed;
  // Generated cells9/10 reverse the inner-ear colors: preserve native evidence,
  // but omit those cells rather than teaching the runtime the wrong design.
  const loop = [0, 1, 2, 3, 4, 5, 6, 7, 8, 11];
  return loop[((Math.floor(step) % loop.length) + loop.length) % loop.length];
}

/** One finite walk towards the screen after turning around. No loop, restart
 * on tab return, or animation in the final eight seconds. */
export function premiereAudienceSeat(remainMs: number, index: number, lite = false) {
  if (!Number.isFinite(remainMs)) return { progress: 0, y: 0, depth: 1 };
  const delay = Math.max(0, Math.min(5, index)) * .07;
  // Leave clock-sample + CSS interpolation margin before the eight-second cut.
  const progress = passage(remainMs / 1000, 10.5 - delay, 8.8 - delay);
  const step = Math.sin(Math.PI * progress) * Math.sin(progress * Math.PI * 4) * (lite ? .5 : 1.25);
  return { progress, y: -progress * (lite ? 3 : 6) + step, depth: 1 - progress * .14 };
}
