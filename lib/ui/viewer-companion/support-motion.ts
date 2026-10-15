export type CompanionSupportPose = { lift: number; squash: number; active: boolean };

type Spring = { position: number; velocity: number };
const TAIL_MS = 900;
const FADE_MS = 600;
const MAX_LIFT = 14;
const MAX_SQUASH = .1;
const quiet = (): CompanionSupportPose => ({ lift: 0, squash: 0, active: false });
const still = (): Spring => ({ position: 0, velocity: 0 });
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Critically damped motion, evaluated from the last input rather than from
 * display-frame steps. Time is seconds; velocity is scalar units per second. */
function springAt(spring: Spring, seconds: number, frequency: number): Spring {
  const carried = spring.velocity + frequency * spring.position;
  const decay = Math.exp(-frequency * seconds);
  return {
    position: (spring.position + carried * seconds) * decay,
    velocity: (spring.velocity - frequency * carried * seconds) * decay,
  };
}

/** A finite, smooth tail gives parked callers an exact stopping point. Its
 * derivative is also carried into a new input, so interruption preserves the
 * currently displayed position and velocity, including during this fade. */
function envelope(age: number) {
  if (age <= FADE_MS) return { value: 1, velocity: 0 };
  const phase = clamp((age - FADE_MS) / (TAIL_MS - FADE_MS), 0, 1);
  const smooth = phase ** 3 * (phase * (phase * 6 - 15) + 10);
  return { value: 1 - smooth, velocity: -30 * phase ** 2 * (phase - 1) ** 2 / ((TAIL_MS - FADE_MS) / 1000) };
}

/** Decorative support response only. No world coordinates, DOM, timers or
 * frame scheduling live here. The caller supplies monotonic milliseconds and
 * resets this response for home/held/reduced/hidden states. */
export function createCompanionSupportMotion() {
  let lift = still(), squash = still();
  let pushedAt: number | undefined, observedAt: number | undefined;
  const clock = (now: number) => {
    if (!Number.isFinite(now)) return undefined;
    observedAt = Math.max(observedAt ?? 0, now, 0);
    return observedAt;
  };
  const read = (now: number) => {
    if (pushedAt === undefined || now - pushedAt >= TAIL_MS) return { lift: still(), squash: still() };
    const age = Math.max(0, now - pushedAt), fade = envelope(age);
    const project = (spring: Spring, frequency: number, sign: -1 | 1): Spring => {
      const next = springAt(spring, age / 1000, frequency);
      const position = next.position * fade.value;
      // A reaction stops at the support plane; it never pushes the body into
      // text or turns a compression into an outward stretch.
      return position * sign < 0 ? still() : { position, velocity: next.velocity * fade.value + next.position * fade.velocity };
    };
    return { lift: project(lift, 12, -1), squash: project(squash, 16, 1) };
  };
  return {
    push(deltaY: number, now: number): void {
      // A zero/invalid geometry delivery cannot start or extend a tail.
      if (!Number.isFinite(deltaY) || deltaY === 0 || !Number.isFinite(now)) return;
      const time = clock(now)!;
      const current = read(time);
      lift = current.lift; squash = current.squash;
      const delta = clamp(deltaY, -160, 160);
      if (delta < 0) lift.velocity = clamp(lift.velocity + delta * 10, -480, 480);
      else squash.velocity = clamp(squash.velocity + delta * .06, -4, 4);
      pushedAt = time;
    },
    sample(now: number): CompanionSupportPose {
      const time = clock(now);
      if (time === undefined) return quiet();
      const current = read(time);
      // Smooth saturation bounds even a burst of same-clock scroll deltas;
      // sampling never clamps/mutates spring state or changes its trajectory.
      return {
        lift: current.lift.position === 0 ? 0 : -MAX_LIFT * Math.tanh(-current.lift.position / MAX_LIFT),
        squash: current.squash.position === 0 ? 0 : MAX_SQUASH * Math.tanh(current.squash.position / MAX_SQUASH),
        active: current.lift.position !== 0 || current.lift.velocity !== 0 || current.squash.position !== 0 || current.squash.velocity !== 0,
      };
    },
    reset(now?: number): void {
      lift = still(); squash = still(); pushedAt = undefined;
      observedAt = now !== undefined && Number.isFinite(now) ? Math.max(0, now) : undefined;
    },
  };
}
