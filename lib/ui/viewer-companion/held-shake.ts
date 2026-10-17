type Point = { x: number; y: number; at: number };
type Stroke = { began: number };
type Axis = { x: number; y: number };
type Run = { fixed?: Axis; from?: Point; peak?: Point; axis?: Axis; extent: number; credited: boolean; strokes: Stroke[]; began?: number };
export type CompanionHeldShakeSample = { active: boolean; phase: number };

const GRID_MS = 16, MAX_GAP_MS = 160, WINDOW_MS = 1200, LATCH_MS = 1000;
const MIN_STROKE = 30, MIN_SPEED = .3, TURN_DISTANCE = 12, MIN_SPAN_MS = 280, REQUIRED_REVERSALS = 2;
const quiet = (): CompanionHeldShakeSample => ({ active: false, phase: 0 });
const valid = (x: number, y: number, at: number) => [x, y, at].every(Number.isFinite) && at >= 0;

/** Captured, clamped world points only. Resampling the actual timed path keeps
 * reversals independent of pointer-event/display frequency. A direction change
 * needs travel, speed and elapsed time; a fling or event burst is never a shake.
 * No clock owner, DOM, persistent data or unbounded input history lives here. */
export function createCompanionHeldShake() {
  let previous: Point | undefined, grid: Point | undefined, nextGridAt = 0;
  // The original free axis still handles straight/diagonal shakes. Fixed
  // projections retain real reversals through circular or changing headings;
  // perpendicular travel contributes neither distance nor speed to that axis.
  const runs: Run[] = [undefined, { x: 1, y: 0 }, { x: 0, y: 1 }].map(fixed => ({ fixed, extent: 0, credited: false, strokes: [] }));
  let latchedAt: number | undefined, expiresAt = 0, consumed = false;
  const clearRun = () => {
    for (const run of runs) { run.from = run.peak = run.axis = undefined; run.extent = 0; run.credited = false; run.strokes = []; run.began = undefined; }
  };
  const clearEvidence = () => { clearRun(); latchedAt = undefined; expiresAt = 0; };
  const seed = (point: Point) => {
    previous = grid = point; nextGridAt = point.at + GRID_MS;
    for (const run of runs) run.from = run.peak = point;
  };
  const qualifies = (run: Run) => Boolean(run.from && run.peak && run.extent >= MIN_STROKE
    && run.peak.at > run.from.at && run.extent / (run.peak.at - run.from.at) >= MIN_SPEED);
  const observe = (run: Run, point: Point) => {
    const { from, peak, axis, fixed } = run;
    if (!from || !peak || !grid) return;
    run.strokes = run.strokes.filter(stroke => point.at - stroke.began <= WINDOW_MS);
    if (!run.strokes.length) run.began = undefined;
    // Keep the duration of the continuous valid run separately from its last
    // two reversals. Fast strokes can all fit inside280ms; their short ring
    // must not erase the real time already spent shaking. History stays bounded.
    if (run.began !== undefined) run.began = Math.max(run.began, point.at - WINDOW_MS);
    if (!axis) {
      const dx = point.x - from.x, dy = point.y - from.y;
      const projection = fixed ? dx * fixed.x + dy * fixed.y : 0, length = fixed ? Math.abs(projection) : Math.hypot(dx, dy);
      if (length < TURN_DISTANCE) return;
      run.axis = fixed ? { x: fixed.x * Math.sign(projection), y: fixed.y * Math.sign(projection) } : { x: dx / length, y: dy / length };
      run.peak = point; run.extent = length;
    } else {
      const dx = point.x - grid.x, dy = point.y - grid.y, length = Math.hypot(dx, dy);
      const backX = point.x - peak.x, backY = point.y - peak.y, back = Math.hypot(backX, backY);
      // Hysteresis collects a real turn instead of crediting pixel jitter.
      // The free axis still rejects a perpendicular detour. A fixed channel
      // instead waits for12px of actual opposite projected travel, including
      // any sideways/still time when checking the next stroke's speed.
      const retreat = backX * axis.x + backY * axis.y;
      if (fixed ? retreat <= -TURN_DISTANCE : length > 0 && (dx * axis.x + dy * axis.y) / length < .5 && back >= TURN_DISTANCE) {
        const reversing = fixed || retreat / back <= -.5;
        if (reversing && qualifies(run)) {
          run.began ??= from.at;
          run.strokes.push({ began: from.at });
          if (run.strokes.length > REQUIRED_REVERSALS) run.strokes.shift();
        } else { run.strokes = []; run.began = undefined; }
        run.from = peak; run.axis = fixed ? { x: -axis.x, y: -axis.y } : { x: backX / back, y: backY / back };
        run.peak = point; run.extent = fixed ? -retreat : back; run.credited = false;
      } else {
        const projection = (point.x - from.x) * axis.x + (point.y - from.y) * axis.y;
        if (projection > run.extent) { run.extent = projection; run.peak = point; }
      }
    }
    if (!run.credited && run.strokes.length === REQUIRED_REVERSALS && qualifies(run)
      && run.began !== undefined && run.peak!.at - run.began >= MIN_SPAN_MS) {
      // Only a newly qualified third/opposite stroke can refresh the latch.
      // Holding still or merely reading a pose never prolongs the reaction.
      latchedAt ??= point.at; expiresAt = point.at + LATCH_MS; run.credited = true;
    }
  };
  const sample = (now: number): CompanionHeldShakeSample => {
    if (!Number.isFinite(now) || consumed || latchedAt === undefined || now < (previous?.at ?? 0)
      || now < latchedAt || now >= expiresAt) return quiet();
    return { active: true, phase: ((now - latchedAt) % 520) / 520 };
  };
  return {
    begin(x: number, y: number, now: number): void {
      clearEvidence(); previous = grid = undefined; nextGridAt = 0; consumed = false;
      if (valid(x, y, now)) seed({ x, y, at: now });
    },
    push(x: number, y: number, now: number): void {
      if (consumed || !valid(x, y, now)) return;
      if (!previous) { seed({ x, y, at: now }); return; }
      // Same/retrograde timestamps cannot manufacture either speed or turns.
      if (now <= previous.at) return;
      // A release can follow a brief still hold. Stop interpolating across the
      // gap, but keep an already earned reaction until its original deadline.
      if (now - previous.at > MAX_GAP_MS) { clearRun(); seed({ x, y, at: now }); return; }
      const incoming = { x, y, at: now }, elapsed = now - previous.at;
      // A valid interval spans at most10 grid cells. Missing input never earns
      // a catch-up loop or interpolated motion across an absence.
      for (let cells = 0; cells < 10 && nextGridAt <= now; cells++, nextGridAt += GRID_MS) {
        const progress = (nextGridAt - previous.at) / elapsed;
        const point = { x: previous.x + (x - previous.x) * progress, y: previous.y + (y - previous.y) * progress, at: nextGridAt };
        for (const run of runs) observe(run, point);
        grid = point;
      }
      previous = incoming;
    },
    sample,
    consume(now: number): boolean {
      if (!sample(now).active) return false;
      consumed = true; clearEvidence(); return true;
    },
    reset(): void {
      clearEvidence(); previous = grid = undefined; nextGridAt = 0; consumed = false;
    },
  };
}
