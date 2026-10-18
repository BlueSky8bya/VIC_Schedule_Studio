import { companionGripProfile, type CompanionGrip } from "./contact-grip";
import { companionMaterialScale } from "./material-scale";

export type CompanionHeldPose = { tilt: number; stretch: number; active: boolean };
type Spring = { position: number; velocity: number };
type Point = { x: number; y: number };
const TAIL_MS = 1500, FADE_MS = 1000;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const still = (): Spring => ({ position: 0, velocity: 0 });
const quiet = (): CompanionHeldPose => ({ tilt: 0, stretch: 0, active: false });

/** Unlike a one-shot FLIP, captured input can reverse before the previous
 * response ends. An analytic underdamped spring carries that velocity without
 * depending on display cadence or adding a second animation loop. */
function springAt(spring: Spring, seconds: number, frequency = 13, decay = 5.6): Spring {
  const carried = (spring.velocity + decay * spring.position) / frequency;
  const cos = Math.cos(frequency * seconds), sin = Math.sin(frequency * seconds);
  const value = spring.position * cos + carried * sin, envelope = Math.exp(-decay * seconds);
  return {
    position: envelope * value,
    velocity: envelope * (-decay * value - spring.position * frequency * sin + carried * frequency * cos),
  };
}

export function createCompanionHeldInertia() {
  let angle = still(), stretch = still(), pushedAt: number | undefined, observedAt = 0;
  const clock = (now: number) => observedAt = Math.max(observedAt, now, 0);
  const read = (now: number) => {
    if (pushedAt === undefined || now - pushedAt >= TAIL_MS) return { angle: still(), stretch: still() };
    const age = Math.max(0, now - pushedAt), p = clamp((age - FADE_MS) / (TAIL_MS - FADE_MS), 0, 1);
    const fade = 1 - p ** 3 * (p * (p * 6 - 15) + 10);
    const fadeVelocity = -30 * p ** 2 * (p - 1) ** 2 / ((TAIL_MS - FADE_MS) / 1000);
    const project = (spring: Spring, vertical = false): Spring => {
      const next = springAt(spring, age / 1000, vertical ? 17.5 : 13, vertical ? 6.5 : 5.6);
      return { position: next.position * fade, velocity: next.velocity * fade + next.position * fadeVelocity };
    };
    return { angle: project(angle), stretch: project(stretch, true) };
  };
  return {
    /** Actual clamped pointer-owned world travel only; scroll/geometry never
     * calls this. Zero input neither excites nor extends the finite tail. */
    push(dx: number, dy: number, now: number, grip?: CompanionGrip): void {
      if (![dx, dy, now].every(Number.isFinite) || dx === 0 && dy === 0) return;
      const time = clock(now), current = read(time);
      angle = current.angle; stretch = current.stretch;
      const material = companionGripProfile(grip);
      // CSS y grows downward: positive rotation leaves the body below an
      // upper grip to the left when the hand travels right, rather than ahead.
      angle.velocity = clamp(angle.velocity + clamp(dx, -160, 160) * 5 * material.impulse - clamp(dy, -160, 160) * material.side * 2.2, -700, 700);
      stretch.velocity = clamp(stretch.velocity - clamp(dy, -160, 160) * .012 * material.impulse + clamp(dx, -160, 160) * material.side * .002, -2.4, 2.4);
      pushedAt = time;
    },
    sample(now: number): CompanionHeldPose {
      if (!Number.isFinite(now)) return quiet();
      const current = read(clock(now));
      return {
        tilt: 18 * Math.tanh(current.angle.position / 18),
        stretch: .085 * Math.tanh(current.stretch.position / .085),
        active: current.angle.position !== 0 || current.angle.velocity !== 0 || current.stretch.position !== 0 || current.stretch.velocity !== 0,
      };
    },
    reset(): void { angle = still(); stretch = still(); pushedAt = undefined; observedAt = 0; },
  };
}

/** Rotation/scale around the actual grip keeps its world point fixed. Reduce
 * only this decorative response near edges; never move the captured body or
 * change its support. Four numeric corners need no layout read. */
export function boundCompanionHeldPose(pose: CompanionHeldPose, origin: Point, grip: Point, size: number, viewport: { width: number; height: number }): CompanionHeldPose {
  if (![pose.tilt, pose.stretch, origin.x, origin.y, grip.x, grip.y, size, viewport.width, viewport.height].every(Number.isFinite) || size <= 0 || 1 + pose.stretch <= 0) return quiet();
  const fits = (gain: number) => {
    const angle = pose.tilt * gain * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    const { scaleX: sx, scaleY: sy } = companionMaterialScale(1 + pose.stretch * gain);
    for (const cx of [0, size]) for (const cy of [0, size]) {
      const dx = (cx - grip.x) * sx, dy = (cy - grip.y) * sy;
      const x = origin.x + grip.x + dx * cos - dy * sin, y = origin.y + grip.y + dx * sin + dy * cos;
      if (x < 2 || x > viewport.width - 2 || y < 2 || y > viewport.height - 2) return false;
    }
    return true;
  };
  if (fits(1)) return pose;
  let low = 0, high = 1;
  for (let step = 0; step < 9; step++) { const mid = (low + high) / 2; if (fits(mid)) low = mid; else high = mid; }
  return { tilt: pose.tilt * low, stretch: pose.stretch * low, active: pose.active };
}
