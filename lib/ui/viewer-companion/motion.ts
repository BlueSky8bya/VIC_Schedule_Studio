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
type Options = { clips?: Readonly<Record<number, readonly number[]>> };
const FRAME_COUNT = 16;
// Four curated cells form six ping-pong steps: at the fastest100px/s walk an
// 80px stride changes drawing7.5 times/s while world travel remains per-rAF.
const WALK_STRIDE_PX = 80;
const ALL_FRAMES = Object.freeze(Array.from({ length: FRAME_COUNT }, (_, index) => index));
const LOOP_FPS: Readonly<Record<number, number>> = { 0: 6, 8: 6, 9: 8, 11: 6 };
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Consume complete display intervals, including the same tolerance used by
 * eligibility. Using raw `% interval` after an early epsilon match can leave
 * the old deadline intact and accidentally render again on the next rAF. */
export function nextCompanionPaint(now: number, previous: number, fps: number): number | null {
  if (fps <= 0) return now;
  const interval = 1000 / fps, elapsed = now - previous;
  const intervals = Math.floor((elapsed + .1) / interval);
  return intervals >= 1 ? previous + intervals * interval : null;
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
export function createCompanionMotion({ clips = {} }: Options = {}) {
  const selected = new Map<number, readonly number[]>();
  for (const [key, frames] of Object.entries(clips)) {
    const row = Number(key);
    if (!Number.isInteger(row) || row < 0 || row >= FRAME_COUNT || !Array.isArray(frames)) continue;
    const valid = frames.filter(frame => Number.isInteger(frame) && frame >= 0 && frame < FRAME_COUNT);
    if (valid.length) selected.set(row, valid);
  }
  let previousRow: number | undefined;
  let previousX = 0, previousY = 0, previousNow = 0;
  let enteredAt = 0, walkDistance = 0;
  let facing: -1 | 1 = 1;
  return {
    sample(input: CompanionMotionInput): CompanionMotionPose {
      const row = Number.isFinite(input.row) ? clamp(Math.floor(input.row), 0, FRAME_COUNT - 1) : 0;
      const now = Number.isFinite(input.now) ? Math.max(previousNow, input.now) : previousNow;
      const x = Number.isFinite(input.x) ? input.x : previousX;
      const y = Number.isFinite(input.y) ? input.y : previousY;
      const first = previousRow === undefined;
      const entered = first || previousRow !== row;
      const dx = first ? 0 : x - previousX;
      if (Math.abs(dx) >= .05) facing = dx < 0 ? -1 : 1;
      if (entered) { enteredAt = now; walkDistance = 0; }
      else if (row === 2) walkDistance += Math.abs(dx);
      previousRow = row; previousX = x; previousY = y; previousNow = now;

      const frames = selected.get(row) ?? ALL_FRAMES;
      const end = frames.length - 1;
      let index = 0;
      if (!entered) {
        if (row === 2) index = input.reduced ? 0 : pingPong(walkDistance / WALK_STRIDE_PX * 2 * end, frames.length);
        else if (LOOP_FPS[row]) index = input.reduced ? 0 : pingPong((now - enteredAt) / 1000 * LOOP_FPS[row], frames.length);
        else {
          const phase = Number.isFinite(input.phase) ? clamp(input.phase, 0, 1) : 0;
          // Every selected cell needs a positive interval: runtime changes to
          // the next jump stage before phase1, so multiplying by `end` made
          // the final crouch/ascent cell impossible to see.
          index = Math.min(end, Math.floor(phase * frames.length + 1e-8));
        }
      }
      const stride = walkDistance / WALK_STRIDE_PX * 2 * Math.PI;
      const movingPose = row === 2 && !input.reduced;
      const stretch = movingPose ? Math.sin(stride * 2) : 0;
      return {
        row,
        column: frames[index],
        facing,
        bob: movingPose ? -Math.abs(Math.sin(stride)) * 1.2 : 0,
        scaleX: 1 + stretch * .012,
        scaleY: 1 - stretch * .018,
        tilt: movingPose ? Math.sin(stride) * .75 * facing : 0,
      };
    },
  };
}
