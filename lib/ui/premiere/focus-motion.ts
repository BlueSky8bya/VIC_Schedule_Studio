import { hypeCalm, hypeChannels, hypeIntensity } from "@/lib/ui/hype-curve";
import { passage } from "./choreography";

// One existing clock/curve: aperiodic positional texture, then a deliberate
// 10→2s retreat. No random timers, luminance oscillation or release authority.
export function premiereFocusMotion(remainMs: number) {
  const seconds = remainMs / 1000;
  const channels = hypeChannels(hypeIntensity(remainMs), hypeCalm(remainMs));
  const amplitude = (channels.shakePx + .35) * passage(seconds, 60, 55) * (1 - channels.calm);
  const elapsed = Math.max(0, 60 - seconds);
  return {
    x: amplitude ? amplitude * (Math.sin(elapsed * 5.7) + .35 * Math.sin(elapsed * 9.13)) / 1.35 : 0,
    y: amplitude ? amplitude * (Math.sin(elapsed * 6.31 + .7) + .28 * Math.sin(elapsed * 10.7)) / 1.28 : 0,
    tilt: amplitude ? amplitude * Math.sin(elapsed * 4.37) * .12 : 0,
    retreat: passage(seconds, 10, 2)
  };
}

export const PREMIERE_EASE = "cubic-bezier(0.22, 0.72, 0.18, 1)";
