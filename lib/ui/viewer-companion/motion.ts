/** Pose sampling only. The renderer owns world position and its rAF cadence. */
export type CompanionMotionInput = {
  row: number;
  phase: number;
  status: string;
  x: number;
  y: number;
  now: number;
  reduced?: boolean;
};
export type CompanionMotionPose = {
  row: number;
  column: number;
  facing: -1 | 1;
  bob: number;
  scaleX: number;
  scaleY: number;
  tilt: number;
};
type Options = {
  clips?: Readonly<Record<number, readonly number[]>>;
  /** Logical clip rows; atlas cell indices remain renderer metadata. */
  rowCount?: number;
  /** Only explicitly authored seamless cycles advance forward. */
  loopRows?: readonly number[];
  maxFrameRate?: number;
};
const FRAME_COUNT = 16;
// Four curated cells form six ping-pong steps: at the fastest100px/s walk an
// 80px stride changes drawing7.5 times/s while world travel remains per-rAF.
const WALK_STRIDE_PX = 80;
const ALL_FRAMES = Object.freeze(Array.from({ length: FRAME_COUNT }, (_, index) => index));
const LOOP_FPS: Readonly<Record<number, number>> = { 0: 6, 8: 6, 9: 8, 11: 6 };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const rounded = (value: number) => Math.round(value * 1e6) / 1e6;

/** Zero velocity and acceleration at both ends. The renderer still owns the
 * collision/landing geometry; this only eases progress along that safe span. */
export function sampleCompanionTravel(progress: number): number {
  const p = Number.isFinite(progress) ? clamp(progress, 0, 1) : 0;
  return p * p * p * (p * (p * 6 - 15) + 10);
}

/** Consume complete display intervals, including the same tolerance used by
 * eligibility. Using raw `% interval` after an early epsilon match can leave
 * the old deadline intact and accidentally render again on the next rAF. */
export function nextCompanionPaint(now: number, previous: number, fps: number): number | null {
  if (fps <= 0) return now;
  const interval = 1000 / fps, elapsed = now - previous;
  const intervals = Math.floor((elapsed + .1) / interval);
  return intervals >= 1 ? previous + intervals * interval : null;
}

/** Bound the held local deformation after the renderer has bounded its outer
 * inertia plane. Origin is that plane's viewport top-left; grip is unmirrored
 * local pixels. Facing conjugates the inner rotation, while the outer scale
 * and rotation remain in world axes. Neither the hand nor world point moves.
 * The caller supplies a neutral outer plane that already fits the viewport;
 * an invalid/unsafe neutral plane cannot be repaired by a decorative pose. */
export function boundCompanionHangingPose(
  pose: CompanionMotionPose,
  origin: { x: number; y: number },
  grip: { x: number; y: number },
  size: number,
  viewport: { width: number; height: number },
  outer: { tilt: number; stretch: number },
): CompanionMotionPose {
  const neutral = (): CompanionMotionPose => ({ ...pose, bob: 0, scaleX: 1, scaleY: 1, tilt: 0 });
  if (![pose.scaleX, pose.scaleY, pose.tilt, origin.x, origin.y, grip.x, grip.y, size, viewport.width, viewport.height, outer.tilt, outer.stretch].every(Number.isFinite)
    || size <= 0 || viewport.width <= 0 || viewport.height <= 0 || ![1, -1].includes(pose.facing)) return neutral();
  const outerAngle = outer.tilt * Math.PI / 180, outerCos = Math.cos(outerAngle), outerSin = Math.sin(outerAngle);
  const outerX = 1 - outer.stretch * .35, outerY = 1 + outer.stretch;
  if (outerX <= 0 || outerY <= 0) return neutral();
  const fits = (gain: number) => {
    const angle = pose.tilt * pose.facing * gain * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    const sx = 1 + (pose.scaleX - 1) * gain, sy = 1 + (pose.scaleY - 1) * gain;
    for (const cx of [0, size]) for (const cy of [0, size]) {
      const dx = (cx - grip.x) * sx, dy = (cy - grip.y) * sy;
      const ix = (dx * cos - dy * sin) * outerX, iy = (dx * sin + dy * cos) * outerY;
      const x = origin.x + grip.x + ix * outerCos - iy * outerSin;
      const y = origin.y + grip.y + ix * outerSin + iy * outerCos;
      if (x < 2 || x > viewport.width - 2 || y < 2 || y > viewport.height - 2) return false;
    }
    return true;
  };
  if (fits(1)) return pose.bob === 0 ? pose : { ...pose, bob: 0 };
  if (!fits(0)) return neutral();
  let low = 0, high = 1;
  for (let step = 0; step < 9; step++) { const mid = (low + high) / 2; if (fits(mid)) low = mid; else high = mid; }
  return { ...pose, bob: 0, scaleX: 1 + (pose.scaleX - 1) * low, scaleY: 1 + (pose.scaleY - 1) * low, tilt: pose.tilt * low };
}
function pingPong(step: number, length: number): number {
  if (length <= 1) return 0;
  const end = length - 1, period = 2 * end;
  // Small numerical tolerance keeps equivalent 60/120Hz distance integrations
  // on the same cell when their result lies exactly on a frame boundary.
  const index = Math.floor(Math.max(0, step) + 1e-8) % period;
  return index <= end ? index : period - index;
}

/** Atlas row identifies a clip. A status label or a fresh walk target does not
 * reset the same clip. Native clips may later be curated without changing the
 * public runtime API; repeated frames deliberately preserve authored holds. */
export function createCompanionMotion({ clips = {}, rowCount = FRAME_COUNT, loopRows = [], maxFrameRate = 14 }: Options = {}) {
  const rows = Number.isFinite(rowCount) ? clamp(Math.floor(rowCount), 1, 64) : FRAME_COUNT;
  const frameRate = Number.isFinite(maxFrameRate) ? clamp(maxFrameRate, 1, 16) : 14;
  const loops = new Set(loopRows.filter(row => Number.isInteger(row) && row >= 0 && row < rows));
  const selected = new Map<number, readonly number[]>();
  for (const [key, frames] of Object.entries(clips)) {
    const row = Number(key);
    if (!Number.isInteger(row) || row < 0 || row >= rows || !Array.isArray(frames)) continue;
    const valid = frames.filter(frame => Number.isInteger(frame) && frame >= 0 && frame < FRAME_COUNT);
    if (valid.length) selected.set(row, valid);
  }
  let previousRow: number | undefined;
  let previousX = 0, previousY = 0, previousNow = 0;
  let enteredAt = 0, walkDistance = 0, walkSteps = 0, travelLean = 0;
  let facing: -1 | 1 = 1;
  type Scalars = Pick<CompanionMotionPose, "bob" | "scaleX" | "scaleY" | "tilt">;
  const neutral = (): Scalars => ({ bob: 0, scaleX: 1, scaleY: 1, tilt: 0 });
  let shown = neutral();
  const velocity = neutral(), offset = neutral(), momentum = neutral();
  velocity.scaleX = velocity.scaleY = 0;
  let mixing = false;
  return {
    sample(input: CompanionMotionInput): CompanionMotionPose {
      const row = Number.isFinite(input.row) ? clamp(Math.floor(input.row), 0, rows - 1) : 0;
      const now = Number.isFinite(input.now) ? Math.max(previousNow, input.now) : previousNow;
      const x = Number.isFinite(input.x) ? input.x : previousX;
      const y = Number.isFinite(input.y) ? input.y : previousY;
      const first = previousRow === undefined;
      const entered = first || previousRow !== row;
      const dx = first ? 0 : x - previousX;
      const seconds = first ? 0 : Math.max(0, now - previousNow) / 1000;
      // A hand moves the body in world space; it is not a walking intention.
      if (!(row === 8 && input.status === "held") && Math.abs(dx) >= .05) facing = dx < 0 ? -1 : 1;
      if (entered) { enteredAt = now; walkDistance = 0; walkSteps = 0; travelLean = 0; }
      else if (row === 2) walkDistance += Math.abs(dx);
      previousRow = row; previousX = x; previousY = y; previousNow = now;

      const frames = selected.get(row) ?? ALL_FRAMES;
      const end = frames.length - 1;
      const cyclicIndex = (step: number) => loops.has(row) ? Math.floor(Math.max(0, step) + 1e-8) % frames.length : pingPong(step, frames.length);
      let index = 0;
      if (!entered) {
        if (row === 2) {
          const steps = Math.abs(dx) / WALK_STRIDE_PX * (loops.has(row) ? frames.length : 2 * end);
          // Distance owns stride phase, with an authored-frame rate ceiling.
          // A stationary walk pose never advances just to catch up with time.
          walkSteps += Math.min(steps, seconds * frameRate);
          index = input.reduced ? 0 : cyclicIndex(walkSteps);
        }
        else if (LOOP_FPS[row]) {
          const fps = row === 8 && input.status === "held" ? 12 : LOOP_FPS[row];
          index = input.reduced ? 0 : cyclicIndex((now - enteredAt) / 1000 * Math.min(frameRate, fps));
        }
        else {
          const phase = Number.isFinite(input.phase) ? clamp(input.phase, 0, 1) : 0;
          // Every selected cell needs a positive interval: runtime changes to
          // the next jump stage before phase1, so multiplying by `end` made
          // the final crouch/ascent cell impossible to see.
          index = input.reduced ? 0 : Math.min(end, Math.floor(phase * frames.length + 1e-8));
        }
      }
      const stride = walkDistance / WALK_STRIDE_PX * 2 * Math.PI;
      const movingPose = row === 2 && !input.reduced;
      const stretch = movingPose ? Math.sin(stride * 2) : 0;
      if (movingPose && seconds > 0 && Math.abs(dx) > .001) travelLean = clamp(dx / seconds / 150, -1, 1) * .65;
      const phase = Number.isFinite(input.phase) ? clamp(input.phase, 0, 1) : 0;
      const extension = row === 16 ? Math.sin(phase * Math.PI) : 0;
      const shake = row === 17 ? Math.sin(phase * Math.PI * 6) * Math.sin(phase * Math.PI) : 0;
      // A held creature keeps kicking even under a stationary pointer. Only
      // local pose scalars move: the pointer, world support and collision path
      // remain owned by the renderer, with no extra timer or random clock.
      const heldTime = (now - enteredAt) / 1000;
      const held = row === 8 && input.status === "held" && !input.reduced
        ? sampleCompanionTravel(heldTime / .18) : 0;
      const wriggle = Math.sin(heldTime * Math.PI * 4.3), kick = Math.sin(heldTime * Math.PI * 7.2 + .7);
      // Gravity has a sustained18.5..31.5% extension after the180ms pickup
      // ramp. Kicks modulate that load instead of multiplying it toward zero.
      // Keep the silhouette broad; the renderer supplies the real grip pivot.
      const hanging = held * (.25 + Math.sin(heldTime * Math.PI * 1.16) * .035 + wriggle * .022 + kick * .008);
      const target: Scalars = {
        // A hanging grip must not translate with the rest of the body. Its
        // pivoted extension supplies the downward travel below the hand.
        bob: movingPose ? -Math.abs(Math.sin(stride)) * 1.2 : 0,
        scaleX: 1 + stretch * .012 - extension * .014 - hanging * .18,
        scaleY: 1 - stretch * .018 + extension * .026 + hanging,
        tilt: (movingPose ? Math.sin(stride) * .75 * facing + travelLean : shake * 2.1) + held * (Math.sin(heldTime * Math.PI * 3.6) * 5.2 + kick * 1.6),
      };
      // A100ms Hermite correction carries the last scalar pose and velocity
      // into a new clip. This is a small pose mixer, not alpha ghosting between
      // two drawings. World motion and collision coordinates stay untouched.
      if (entered && !first) {
        for (const key of Object.keys(target) as (keyof Scalars)[]) { offset[key] = shown[key] - target[key]; momentum[key] = velocity[key]; }
        mixing = true;
      }
      const t = clamp((now - enteredAt) / 100, 0, 1);
      const hold = 2 * t ** 3 - 3 * t ** 2 + 1, carry = t ** 3 - 2 * t ** 2 + t;
      const next = { ...target };
      for (const key of Object.keys(target) as (keyof Scalars)[]) {
        if (mixing && t < 1) next[key] += offset[key] * hold + momentum[key] * .1 * carry;
        if (input.reduced) next[key] = key === "scaleX" || key === "scaleY" ? 1 : 0;
        if (seconds > 0) velocity[key] = clamp((next[key] - shown[key]) / seconds, key === "scaleX" || key === "scaleY" ? -2 : -60, key === "scaleX" || key === "scaleY" ? 2 : 60);
      }
      if (t >= 1 || input.reduced) mixing = false;
      shown = next;
      return {
        row, column: frames[index], facing,
        bob: rounded(next.bob), scaleX: rounded(next.scaleX), scaleY: rounded(next.scaleY), tilt: rounded(next.tilt),
      };
    },
  };
}
