import type { CompanionPreferences } from "./preferences";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import { sampleCompanionTravel } from "./motion";

type Point = { u: number; v: number };
type Viewport = { width: number; height: number };
type Gait = "walk" | "run" | "hop";
type Leg = { from: Point; to: Point; gait: Gait; duration: number; elapsed: number };
export type CompanionMeadowSample = {
  x: number; y: number; groundY: number; scale: number; row: number; phase: number;
  status: "idle" | "look" | "walk" | "jump"; purpose: "stroll" | "look-around";
  direction: -1 | 1; leg: number;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** A temporary foreground walk, not a calendar platform or a second care
 * brain. Only normalized grass coordinates live here. Food/toy ownership,
 * house state, learning and the resident's world position are never read or
 * written. The caller advances this clock only while its drawing is ready. */
export function createCompanionMeadowWalk(random: () => number = Math.random) {
  let point: Point = { u: .52, v: .73 }, leg: Leg | undefined, wait = 450;
  let direction: -1 | 1 = 1, serial = 0, previousGait: Gait = "walk";
  let arrival: { from: { x: number; y: number }; elapsed: number } | undefined;
  const draw = () => { const value = random(); return Number.isFinite(value) ? clamp(value, 0, .999999) : .5; };
  const project = (p: Point, viewport: Viewport) => ({
    x: Math.max(60, viewport.width * .16) + p.u * Math.max(1, viewport.width * .72 - 60),
    // The meadow horizon is .35h. All feet remain well below its distant
    // ridge, above the bottom controls, in the same grassy foreground.
    y: viewport.height * (.35 + p.v * .65),
  });
  return {
    /** Direct seasonal input starts one finite jump from the actual resident.
     * Autonomous roam/jump settings do not cancel this requested departure. */
    enter(location: { x: number; y: number }, viewport: Viewport) {
      if (![location.x, location.y, viewport.width, viewport.height].every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0) return;
      const groundY = Math.max(location.y, viewport.height * .35 + 24);
      point = { u: (location.x - Math.max(60, viewport.width * .16)) / Math.max(1, viewport.width * .72 - 60), v: (groundY / viewport.height - .35) / .65 };
      leg = undefined; wait = 650;
      arrival = { from: { ...location }, elapsed: 0 };
    },
    /** A real outdoor placement owns its exact foot, including a drag across
     * the future calendar cover. Future legs depart from that foot smoothly. */
    place(location: { x: number; y: number }, viewport: Viewport) {
      if (![location.x, location.y, viewport.width, viewport.height].every(Number.isFinite) || viewport.width <= 0 || viewport.height <= 0) return;
      point = { u: (location.x - Math.max(60, viewport.width * .16)) / Math.max(1, viewport.width * .72 - 60), v: (location.y / viewport.height - .35) / .65 };
      arrival = undefined; leg = undefined; wait = 450;
    },
    /** Roaming can stop between feet, but an already airborne hop owns its
     * finite landing. No further leg starts while roam is OFF. */
    settling: () => Boolean(arrival) || leg?.gait === "hop" && leg.elapsed >= leg.duration * .13,
    sample(delta: number, viewport: Viewport, preferences: CompanionPreferences, animate = true): CompanionMeadowSample | null {
      if (![viewport.width, viewport.height].every(Number.isFinite) || viewport.width < 240 || viewport.height < 240) return null;
      if (arrival) {
        arrival.elapsed = animate ? Math.min(700, arrival.elapsed + clamp(Number.isFinite(delta) ? delta : 0, 0, 80)) : 700;
        const p = arrival.elapsed / 700, to = project(point, viewport), from = arrival.from;
        const progress = sampleCompanionTravel(p), groundY = from.y + (to.y - from.y) * progress;
        const lift = Math.sin(Math.PI * p) * Math.max(0, Math.min(140, Math.min(from.y, to.y) - 100));
        direction = to.x < from.x ? -1 : 1;
        const sample: CompanionMeadowSample = { x: from.x + (to.x - from.x) * progress, y: groundY - lift, groundY, scale: 1 + (.80 + point.v * .20 - 1) * progress,
          row: p < .12 ? 3 : p < .5 ? 4 : p < .84 ? 5 : 6, phase: p < .12 ? p / .12 : p < .5 ? (p - .12) / .38 : p < .84 ? (p - .5) / .34 : (p - .84) / .16,
          status: p < 1 ? "jump" : "idle", purpose: "stroll", direction, leg: serial };
        if (p >= 1) { arrival = undefined; sample.row = 0; sample.phase = 0; }
        return sample;
      }
      if (leg?.gait === "hop" && (!animate || (!preferences.jump || !preferences.roam) && leg.elapsed < leg.duration * .13)) {
        // Before takeoff, a newly disabled jump never launches. A quiet/RM
        // presentation grounds at the current grass foot without a new arc;
        // its remaining destination survives as an ordinary walking leg.
        const distance = Math.hypot(project(leg.to, viewport).x - project(point, viewport).x, project(leg.to, viewport).y - project(point, viewport).y);
        leg = { from: { ...point }, to: leg.to, gait: "walk", elapsed: 0, duration: clamp(distance / getCompanionBehaviorProfile(preferences).walkSpeed * 1000, 350, 5000) };
      }
      const finishingHop = leg?.gait === "hop" && leg.elapsed >= leg.duration * .13;
      const moving = animate && (preferences.roam || finishingHop);
      const dt = moving && Number.isFinite(delta) ? clamp(delta, 0, 80) : 0;
      let row = 1, phase = 0, lift = 0, status: CompanionMeadowSample["status"] = "look";
      if (!leg && moving && preferences.roam) {
        wait -= dt;
        if (wait <= 0) {
          const profile = getCompanionBehaviorProfile(preferences);
          const desired = 95 + draw() * (preferences.personality === "curious" ? 235 : 155);
          const span = Math.max(1, viewport.width * .72 - 60);
          const proposed = point.u + direction * desired / span;
          if (proposed < .08 || proposed > .92 || draw() < .17) direction = direction === 1 ? -1 : 1;
          const to = { u: clamp(point.u + direction * desired / span, .05, .95), v: clamp(point.v + (draw() - .5) * .18, .58, .83) };
          const sporty = preferences.personality === "mischievous" || preferences.personality === "performer" || preferences.personality === "curious";
          const pick = draw();
          let gait: Gait = preferences.jump && pick < (sporty ? .22 : .11) ? "hop" : pick < (sporty ? .60 : .30) ? "run" : "walk";
          // Bursts are occasional parts of a walk, never the same repeated
          // jump at a fixed point. The next leg always owns a new destination.
          if (gait === previousGait && gait !== "walk") gait = "walk";
          const fromPx = project(point, viewport), toPx = project(to, viewport);
          const distance = Math.hypot(toPx.x - fromPx.x, toPx.y - fromPx.y);
          if (distance >= 18) {
            const speed = profile.walkSpeed * (gait === "run" ? 1.65 : gait === "hop" ? 1.35 : 1);
            leg = { from: { ...point }, to, gait, duration: gait === "hop" ? clamp(distance / speed * 1000, 850, 1600) : clamp(distance / speed * 1000, 1100, 5000), elapsed: 0 };
            previousGait = gait; serial++;
          } else wait = 500;
        }
      }
      if (leg && moving) {
        leg.elapsed = Math.min(leg.duration, leg.elapsed + dt);
        const p = leg.elapsed / leg.duration;
        const progress = sampleCompanionTravel(p);
        point = { u: leg.from.u + (leg.to.u - leg.from.u) * progress, v: leg.from.v + (leg.to.v - leg.from.v) * progress };
        direction = leg.to.u < leg.from.u ? -1 : 1;
        status = leg.gait === "hop" ? "jump" : "walk";
        row = leg.gait === "run" ? 20 : 2;
        phase = p;
        if (leg.gait === "hop") {
          if (p < .13) { row = 3; phase = p / .13; }
          else if (p > .84) { row = 6; phase = (p - .84) / .16; }
          else { const flight = (p - .13) / .71; row = flight < .5 ? 4 : 5; phase = flight < .5 ? flight * 2 : (flight - .5) * 2; lift = Math.sin(flight * Math.PI) ** 2 * 34; }
        }
        if (p >= 1) {
          leg = undefined; wait = 650 + draw() * (preferences.personality === "sleepy" || preferences.personality === "homebody" ? 1650 : 950);
          if (!preferences.roam) { row = 0; phase = 0; status = "idle"; }
        }
      } else if (!moving) { row = 0; status = "idle"; }
      const location = project(point, viewport);
      return { x: location.x, y: location.y - lift, groundY: location.y, scale: .80 + point.v * .20, row, phase, status, purpose: status === "walk" || status === "jump" ? "stroll" : "look-around", direction, leg: serial };
    },
  };
}
