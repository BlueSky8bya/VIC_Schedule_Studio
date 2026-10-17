import { describe, expect, it } from "vitest";
import { boundCompanionHangingPose, createCompanionMotion, nextCompanionPaint, sampleCompanionTravel, type CompanionMotionInput, type CompanionMotionPose } from "@/lib/ui/viewer-companion/motion";
import { boundCompanionHeldPose } from "@/lib/ui/viewer-companion/held-inertia";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { COMPANION_THROW_ROW } from "@/lib/ui/viewer-companion/timing";

const input = (patch: Partial<CompanionMotionInput> = {}): CompanionMotionInput => ({ row: 0, phase: 0, status: "idle", x: 100, y: 500, now: 0, ...patch });

describe("actual airborne phase selection", () => {
  it("enters at the current flight phase and follows changed phases even without elapsed sampling time", () => {
    const motion = createCompanionMotion({ rowCount: companionSpriteMetadata.rows.length });
    motion.sample(input({ row: 8, status: "held", now: 100 }));
    for (const [phase, column] of [[8 / 15, 8], [4 / 15, 4], [12 / 15, 12], [1, 15]] as const) {
      const pose = motion.sample(input({ row: COMPANION_THROW_ROW, status: "jump", now: 100, phase }));
      expect(pose).toMatchObject({ row: COMPANION_THROW_ROW, column });
      expect(selectCompanionSprite(companionSpriteMetadata.rows[pose.row][pose.column], pose.row, pose.column).physicalIndex).toBe(companionSpriteMetadata.rows[COMPANION_THROW_ROW][column]);
    }
  });
});

describe("authored recovery expression selection", () => {
  // Match the renderer: all16 held slots remain selectable, not four deduped keys.
  const createRuntime = () => createCompanionMotion({
    clips: Object.fromEntries(companionSpriteMetadata.rows.map((row, index) => [index, row.map((_, column) => column)])),
    rowCount: companionSpriteMetadata.rows.length, loopRows: [0, 2, 8, 9, 11, 20], maxFrameRate: 14,
  });
  const selected = (pose: CompanionMotionPose) => selectCompanionSprite(companionSpriteMetadata.rows[pose.row][pose.column], pose.row, pose.column);
  const expressions = [[0, 0], [.35, 5], [.65, 10], [1, 15]] as const;

  it.each(expressions)("enters from dizzy at phase%s on actual recovery column%s without an opening-key flash", (phase, column) => {
    const motion = createRuntime();
    motion.sample(input({ row: 22, status: "play", phase: .5, now: 100 }));
    const pose = motion.sample(input({ row: 23, status: "play", phase, now: 100 }));
    expect(pose).toMatchObject({ row: 23, column, bob: 0, tilt: 0, scaleX: 1, scaleY: 1 });
    expect(selected(pose)).toMatchObject({ index: column, physicalIndex: companionSpriteMetadata.rows[23][column] });
  });

  it("selects the calm terminal drawing on a fresh phase1 first sample", () => {
    const pose = createRuntime().sample(input({ row: 23, status: "play", phase: 1 }));
    expect(pose.column).toBe(15);
    expect(selected(pose).physicalIndex).toBe(companionSpriteMetadata.rows[23][15]);
  });

  it("honors changed authored expressions with no elapsed time on the same row", () => {
    const motion = createRuntime();
    for (const [phase, column] of [...expressions, expressions[1]]) {
      const pose = motion.sample(input({ row: 23, status: "play", phase, now: 100 }));
      expect(pose.column).toBe(column); expect(selected(pose).index).toBe(column);
    }
  });

  it.each(["fresh", "from-dizzy"] as const)("uses only the calm key for reduced/OFF %s sampling", entry => {
    const motion = createRuntime();
    if (entry === "from-dizzy") motion.sample(input({ row: 22, status: "play", phase: .5, now: 100 }));
    // Both graphics OFF and reduced motion reach the sampler through reduced.
    for (const [phase] of expressions) {
      const pose = motion.sample(input({ row: 23, status: "play", phase, now: 100, reduced: true }));
      expect(pose).toMatchObject({ row: 23, column: 15, bob: 0, tilt: 0, scaleX: 1, scaleY: 1 });
      expect(selected(pose).physicalIndex).toBe(companionSpriteMetadata.rows[23][15]);
    }
  });

  it("keeps curated expression slots authoritative instead of indexing a hard-coded16-frame list", () => {
    const clips = { 23: [0, 4, 8, 15] }, motion = createCompanionMotion({ clips, rowCount: 32 });
    for (const [phase, column] of [[0, 0], [.35, 4], [.65, 8], [1, 15]] as const) {
      expect(motion.sample(input({ row: 23, status: "play", phase })).column).toBe(column);
    }
    expect(motion.sample(input({ row: 23, status: "play", phase: 0, reduced: true })).column).toBe(15);
    expect(clips).toEqual({ 23: [0, 4, 8, 15] });
  });

  it("preserves facing and the existing100ms scalar mixer while the first recovery drawing is calm", () => {
    const motion = createRuntime();
    motion.sample(input({ row: 2, status: "walk", x: 100 }));
    motion.sample(input({ row: 2, status: "walk", x: 96, now: 40 }));
    const walking = motion.sample(input({ row: 2, status: "walk", x: 92, now: 80 }));
    expect(walking.facing).toBe(-1); expect(Math.abs(walking.bob)).toBeGreaterThan(.5);
    const recovery = motion.sample(input({ row: 23, status: "play", phase: 1, x: 92, now: 96 }));
    expect(recovery).toMatchObject({ row: 23, column: 15, facing: -1 });
    for (const key of ["bob", "scaleX", "scaleY", "tilt"] as const) expect(recovery[key]).toBe(walking[key]);
    expect(motion.sample(input({ row: 23, status: "play", phase: 1, x: 92, now: 196 }))).toMatchObject({ column: 15, facing: -1, bob: 0, scaleX: 1, scaleY: 1, tilt: 0 });
  });
});

describe("targeted companion observation", () => {
  it("turns a stationary look or sniff toward its actual target without scaling the body", () => {
    for (const row of [1, 26]) for (const status of ["look", "sniff"]) {
      const motion = createCompanionMotion({ rowCount: 32 });
      const target: CompanionMotionInput["attention"] = { direction: -1, elevation: -.5 };
      expect(motion.sample(input({ row, status, attention: target }))).toMatchObject({ facing: -1, bob: 0, tilt: 0, scaleX: 1, scaleY: 1 });
      expect(motion.sample(input({ row, status, attention: target, phase: .5, now: 200 }))).toMatchObject({ facing: -1, bob: -.5, tilt: 1.6, scaleX: 1, scaleY: 1 });
      expect(motion.sample(input({ row, status, attention: { ...target, direction: 1 }, phase: .5, now: 250 }))).toMatchObject({ facing: 1, bob: -.5, tilt: 1.6 });
      expect(target).toEqual({ direction: -1, elevation: -.5 });
    }
  });

  it("bounds the finite attention arc and returns to neutral at its endpoints", () => {
    for (const elevation of [-10, -1, 0, 1, 10]) {
      const motion = createCompanionMotion({ rowCount: 32 });
      for (let step = 0; step <= 100; step++) {
        const phase = step / 100, pose = motion.sample(input({ row: 26, status: "look", attention: { direction: 1, elevation }, phase, now: step * 6 }));
        expect(Math.abs(pose.bob)).toBeLessThanOrEqual(1);
        expect(pose.tilt).toBeGreaterThanOrEqual(0); expect(pose.tilt).toBeLessThanOrEqual(1.6);
        expect(pose.scaleX).toBe(1); expect(pose.scaleY).toBe(1);
        if (step === 0 || step === 100) expect(pose).toMatchObject({ bob: 0, tilt: 0 });
      }
    }
    const invalid = createCompanionMotion().sample(input({ row: 1, status: "look", phase: .5, attention: { direction: -1, elevation: NaN } }));
    expect(invalid).toMatchObject({ facing: 1, bob: 0, tilt: 0 });
    expect(Object.values(invalid).every(Number.isFinite)).toBe(true);
  });

  it("gives actual motion priority and never adds an observation during vertical travel", () => {
    const motion = createCompanionMotion({ rowCount: 32 });
    motion.sample(input({ row: 1, status: "look" }));
    expect(motion.sample(input({ row: 1, status: "look", x: 101, phase: .5, now: 200, attention: { direction: -1, elevation: 1 } }))).toMatchObject({ facing: 1, bob: 0, tilt: 0 });
    expect(motion.sample(input({ row: 1, status: "look", x: 100, phase: .5, now: 400, attention: { direction: 1, elevation: 1 } }))).toMatchObject({ facing: -1, bob: 0, tilt: 0 });
    expect(motion.sample(input({ row: 1, status: "look", y: 490, phase: .5, now: 600, attention: { direction: 1, elevation: 1 } }))).toMatchObject({ facing: -1, bob: 0, tilt: 0 });
  });

  it("ignores attention throughout captured, play, travel and unrelated poses", () => {
    for (const [row, status] of [[8, "held"], [26, "play"], [1, "walk"], [2, "walk"], [4, "jump"], [6, "land"], [0, "look"], [1, "idle"]] as const) {
      const ordinary = createCompanionMotion({ rowCount: 32 }), distracted = createCompanionMotion({ rowCount: 32 });
      for (let step = 0; step <= 30; step++) {
        const next = input({ row, status, phase: step / 30, now: step * 16, x: step < 15 ? 100 - step : 85 + step });
        expect(distracted.sample({ ...next, attention: { direction: -1, elevation: -1 } })).toEqual(ordinary.sample(next));
      }
    }
  });

  it("samples the same target attention at the same elapsed time at60 and120Hz", () => {
    const run = (hz: number, row: number) => {
      const motion = createCompanionMotion({ rowCount: 32 });
      let pose = motion.sample(input({ row, status: "look", attention: { direction: -1, elevation: .75 } }));
      for (let frame = 1; frame <= hz * .5; frame++) {
        const now = frame / hz * 1000;
        pose = motion.sample(input({ row, status: "look", attention: { direction: -1, elevation: .75 }, phase: now / 700, now }));
      }
      return pose;
    };
    for (const row of [1, 26]) expect(run(60, row)).toEqual(run(120, row));
  });

  it("keeps static orientation under reduced motion and carries the existing100ms release mixer", () => {
    const reduced = createCompanionMotion({ rowCount: 32 });
    for (const now of [0, 150, 300]) expect(reduced.sample(input({ row: 1, status: "look", attention: { direction: -1, elevation: -1 }, phase: .5, now, reduced: true }))).toMatchObject({ facing: -1, bob: 0, tilt: 0, scaleX: 1, scaleY: 1, column: 0 });
    const motion = createCompanionMotion({ rowCount: 32 });
    const looking = input({ row: 1, status: "look", attention: { direction: 1, elevation: -1 }, phase: .5 });
    motion.sample(looking); motion.sample({ ...looking, now: 150 });
    const observed = motion.sample({ ...looking, now: 200 });
    const released = motion.sample(input({ now: 216 }));
    for (const key of ["bob", "tilt", "scaleX", "scaleY"] as const) expect(released[key]).toBe(observed[key]);
    expect(motion.sample(input({ now: 316 }))).toMatchObject({ bob: 0, tilt: 0, scaleX: 1, scaleY: 1 });
  });
});

describe("held gravity viewport composition", () => {
  const size = 92, viewport = { width: 400, height: 300 }, grip = { x: 24, y: 28 };
  const pose: CompanionMotionPose = { row: 8, column: 7, facing: 1, bob: 0, scaleX: .95, scaleY: 1.315, tilt: 6.8 };
  // Independent CSS-order oracle: inner pose about the mirrored grip, facing
  // about the cell center, then outer inertia about the actual world grip.
  const project = (p: CompanionMotionPose, point: { x: number; y: number }, origin: { x: number; y: number }, outer: { tilt: number; stretch: number }) => {
    const gx = p.facing < 0 ? size - grip.x : grip.x, angle = p.tilt * Math.PI / 180;
    const dx = (point.x - gx) * p.scaleX, dy = (point.y - grip.y) * p.scaleY;
    const ix = gx + dx * Math.cos(angle) - dy * Math.sin(angle), iy = grip.y + dx * Math.sin(angle) + dy * Math.cos(angle) + p.bob;
    const fx = p.facing < 0 ? size - ix : ix, ex = (fx - grip.x) * (1 - outer.stretch * .35), ey = (iy - grip.y) * (1 + outer.stretch), oa = outer.tilt * Math.PI / 180;
    return { x: origin.x + grip.x + ex * Math.cos(oa) - ey * Math.sin(oa), y: origin.y + grip.y + ex * Math.sin(oa) + ey * Math.cos(oa) };
  };
  const corners = (p: CompanionMotionPose, origin: { x: number; y: number }, outer: { tilt: number; stretch: number }) => [0, size].flatMap(x => [0, size].map(y => project(p, { x, y }, origin, outer)));

  it("preserves the full center shape and the actual grip under asymmetric mirrored composition", () => {
    const origin = { x: 150, y: 100 }, outer = { tilt: 18, stretch: .06 };
    for (const facing of [-1, 1] as const) {
      const candidate = { ...pose, facing }, bounded = boundCompanionHangingPose(candidate, origin, grip, size, viewport, outer);
      expect(bounded).toBe(candidate);
      const fixed = project(bounded, { x: facing < 0 ? size - grip.x : grip.x, y: grip.y }, origin, outer);
      expect(fixed.x).toBeCloseTo(origin.x + grip.x, 10); expect(fixed.y).toBeCloseTo(origin.y + grip.y, 10);
    }
  });

  it("keeps every composed corner inside all four edges without reversing gravity or moving the grip", () => {
    const edges = [{ x: 4, y: 100 }, { x: 304, y: 100 }, { x: 150, y: 8 }, { x: 150, y: 196 }];
    let limited = 0;
    for (const origin of edges) for (const facing of [-1, 1] as const) for (const sign of [-1, 1]) for (const material of [pose, { ...pose, scaleX: .91, scaleY: 1.45, tilt: 30 }]) {
      const outer = boundCompanionHeldPose({ tilt: sign * 17, stretch: .08, active: true }, origin, grip, size, viewport);
      const candidate = { ...material, facing, tilt: sign * material.tilt }, bounded = boundCompanionHangingPose(candidate, origin, grip, size, viewport, outer);
      if (bounded.scaleY < candidate.scaleY) limited++;
      expect(bounded).toMatchObject({ row: candidate.row, column: candidate.column, facing, bob: 0 });
      expect(bounded.scaleY).toBeGreaterThanOrEqual(1); expect(bounded.scaleY).toBeLessThanOrEqual(candidate.scaleY);
      expect(bounded.scaleX).toBeGreaterThanOrEqual(candidate.scaleX); expect(bounded.scaleX).toBeLessThanOrEqual(1);
      expect(Math.abs(bounded.tilt)).toBeLessThanOrEqual(Math.abs(candidate.tilt));
      for (const corner of corners(bounded, origin, outer)) { expect(corner.x).toBeGreaterThanOrEqual(2 - 1e-7); expect(corner.x).toBeLessThanOrEqual(viewport.width - 2 + 1e-7); expect(corner.y).toBeGreaterThanOrEqual(2 - 1e-7); expect(corner.y).toBeLessThanOrEqual(viewport.height - 2 + 1e-7); }
      const fixed = project(bounded, { x: facing < 0 ? size - grip.x : grip.x, y: grip.y }, origin, outer);
      expect(fixed.x).toBeCloseTo(origin.x + grip.x, 10); expect(fixed.y).toBeCloseTo(origin.y + grip.y, 10);
    }
    expect(limited).toBeGreaterThanOrEqual(12);
  });

  it("limits the confirmed lower-edge extension while preserving every safe reduced-motion pose unchanged", () => {
    const origin = { x: 150, y: viewport.height - 12 - size }, outer = { tilt: 0, stretch: 0 };
    expect(Math.max(...corners(pose, origin, outer).map(point => point.y))).toBeGreaterThan(viewport.height);
    const bounded = boundCompanionHangingPose(pose, origin, grip, size, viewport, outer);
    expect(bounded.scaleY).toBeLessThan(pose.scaleY); expect(bounded.scaleY).toBeGreaterThan(1);
    expect(Math.max(...corners(bounded, origin, outer).map(point => point.y))).toBeLessThanOrEqual(viewport.height - 2);
    const reduced = { ...pose, tilt: 0, scaleX: 1, scaleY: 1 };
    expect(boundCompanionHangingPose(reduced, origin, grip, size, viewport, outer)).toBe(reduced);
  });

  it("returns neutral deformation for invalid geometry without inventing a new world position", () => {
    const outer = { tilt: 0, stretch: 0 };
    expect(boundCompanionHangingPose(pose, { x: NaN, y: 100 }, grip, size, viewport, outer)).toEqual({ ...pose, bob: 0, tilt: 0, scaleX: 1, scaleY: 1 });
    expect(boundCompanionHangingPose(pose, { x: 100, y: 100 }, grip, 0, viewport, outer)).toEqual({ ...pose, bob: 0, tilt: 0, scaleX: 1, scaleY: 1 });
  });

  it("keeps the bounded first release frame continuous when applied throughout the existing grip mixer", () => {
    const motion = createCompanionMotion({ loopRows: [8] }), origin = { x: 150, y: viewport.height - 12 - size }, outer = { tilt: 0, stretch: 0 };
    let held = motion.sample(input({ row: 8, status: "held" }));
    for (let now = 8; now <= 496; now += 8) held = motion.sample(input({ row: 8, status: "held", now }));
    const shown = boundCompanionHangingPose(held, origin, grip, size, viewport, outer);
    expect(shown.scaleY).toBeLessThan(held.scaleY);
    const release = boundCompanionHangingPose(motion.sample(input({ now: 504 })), origin, grip, size, viewport, outer);
    for (const key of ["bob", "tilt", "scaleX", "scaleY"] as const) expect(release[key]).toBe(shown[key]);
    for (let ms = 1; ms <= 100; ms++) {
      const next = boundCompanionHangingPose(motion.sample(input({ now: 504 + ms })), origin, grip, size, viewport, outer);
      for (const corner of corners(next, origin, outer)) expect(corner.y).toBeLessThanOrEqual(viewport.height - 2);
      expect(next.scaleY).toBeGreaterThanOrEqual(1);
    }
    expect(motion.sample(input({ now: 605 }))).toMatchObject({ bob: 0, scaleX: 1, scaleY: 1, tilt: 0 });
  });
});

describe("companion clip and facing continuity", () => {
  it("keeps a stationary held creature kicking while gravity always extends it below its fixed grip", () => {
    const motion = createCompanionMotion({ loopRows: [8] });
    const samples = Array.from({ length: 181 }, (_, frame) => motion.sample(input({ row: 8, status: "held", now: frame * 1000 / 120 })));
    expect(new Set(samples.map(p => p.column)).size).toBe(16);
    expect(Math.max(...samples.map(p => p.tilt)) - Math.min(...samples.map(p => p.tilt))).toBeGreaterThan(7);
    expect(samples.every(p => p.bob === 0)).toBe(true);
    expect(Math.max(...samples.map(p => p.scaleY))).toBeGreaterThan(1.29);
    expect(samples.every(p => p.facing === 1 && Math.abs(p.tilt) <= 7 && p.scaleX >= .9433 && p.scaleX <= 1 && p.scaleY >= 1 && p.scaleY <= 1.315)).toBe(true);
    expect(samples.filter((_, i) => i >= 24).every(p => p.scaleY >= 1.185 && p.scaleX < 1)).toBe(true);
  });

  it("sustains the gravity floor across full breathing and kick cycles without pinching the body", () => {
    const motion = createCompanionMotion({ loopRows: [8] });
    motion.sample(input({ row: 8, status: "held" }));
    const sustained = Array.from({ length: 1441 }, (_, frame) => motion.sample(input({ row: 8, status: "held", now: 200 + frame * 1000 / 120 })));
    expect(Math.min(...sustained.map(p => p.scaleY))).toBeGreaterThanOrEqual(1.185);
    expect(Math.max(...sustained.map(p => p.scaleY))).toBeLessThanOrEqual(1.315);
    expect(Math.min(...sustained.map(p => p.scaleY))).toBeLessThan(1.20);
    expect(Math.max(...sustained.map(p => p.scaleY))).toBeGreaterThan(1.30);
    expect(sustained.every(p => p.scaleX >= .9433 && p.scaleX < .967 && p.bob === 0)).toBe(true);
    // An upper grip leaves48.4px to this lower-body point. Even the outer
    // inertia's18deg tilt plus the authored kick keeps gravity pointing down.
    const downwardExtension = sustained.map(p => 48.4 * (p.scaleY - 1) * Math.cos((18 + Math.abs(p.tilt)) * Math.PI / 180));
    expect(Math.min(...downwardExtension)).toBeGreaterThan(8);
  });

  it("samples the same held pose at the same time across display rates, with at most12 drawing changes a second", () => {
    const run = (hz: number) => {
      const motion = createCompanionMotion({ loopRows: [8] }); let previous = -1, changes = 0;
      let pose = motion.sample(input({ row: 8, status: "held" }));
      for (let frame = 1; frame <= hz * 2; frame++) {
        pose = motion.sample(input({ row: 8, status: "held", now: frame * 1000 / hz }));
        if (pose.column !== previous) changes++; previous = pose.column;
      }
      return { pose, changes };
    };
    const full = run(60), fast = run(120);
    expect(full.pose).toEqual(fast.pose); expect(full.changes).toBeLessThanOrEqual(25); expect(fast.changes).toBeLessThanOrEqual(25);
  });

  it("carries a held pose smoothly into release and keeps reduced held poses static", () => {
    const motion = createCompanionMotion({ loopRows: [8] });
    let held = motion.sample(input({ row: 8, status: "held" }));
    for (let now = 16; now <= 1200; now += 16) held = motion.sample(input({ row: 8, status: "held", now }));
    const firstRelease = motion.sample(input({ now: 1216 }));
    for (const key of ["bob", "tilt", "scaleX", "scaleY"] as const) expect(firstRelease[key]).toBe(held[key]);
    expect(motion.sample(input({ now: 1320 }))).toMatchObject({ bob: 0, tilt: 0, scaleX: 1, scaleY: 1 });
    const quiet = createCompanionMotion({ loopRows: [8] });
    for (const now of [0, 50, 500, 1500]) expect(quiet.sample(input({ row: 8, status: "held", now, reduced: true }))).toMatchObject({ column: 0, bob: 0, tilt: 0, scaleX: 1, scaleY: 1 });
  });

  it("carries the stronger gravity load through the same-clock release and finishes its existing100ms mixer", () => {
    const motion = createCompanionMotion({ loopRows: [8] });
    motion.sample(input({ row: 8, status: "held" }));
    let held = motion.sample(input({ row: 8, status: "held", now: 200 }));
    for (let now = 208; now <= 496; now += 8) held = motion.sample(input({ row: 8, status: "held", now }));
    expect(held.scaleY).toBeGreaterThan(1.25);
    const released = motion.sample(input({ now: 504 }));
    for (const key of ["bob", "tilt", "scaleX", "scaleY"] as const) expect(released[key]).toBe(held[key]);
    expect(motion.sample(input({ now: 504 }))).toEqual(released);
    const tail = Array.from({ length: 101 }, (_, ms) => motion.sample(input({ now: 504 + ms })));
    expect(tail.every(p => p.scaleY >= 1 && p.scaleY < 1.34 && p.scaleX >= .94 && p.scaleX <= 1 && p.bob === 0)).toBe(true);
    expect(Math.max(...tail.slice(1).map((p, i) => Math.abs(p.scaleY - tail[i].scaleY)))).toBeLessThan(.006);
    expect(tail.at(-1)).toMatchObject({ scaleX: 1, scaleY: 1, tilt: 0, bob: 0 });
    expect(motion.sample(input({ now: 5000 }))).toMatchObject({ scaleX: 1, scaleY: 1, tilt: 0, bob: 0 });
  });

  it("keeps a captured translation out of gravity and cancels an active load immediately when motion is reduced", () => {
    const stationary = createCompanionMotion({ loopRows: [8] }), carried = createCompanionMotion({ loopRows: [8] });
    for (let frame = 0; frame <= 120; frame++) {
      const now = frame * 1000 / 120;
      const expected = stationary.sample(input({ row: 8, status: "held", now }));
      expect(carried.sample(input({ row: 8, status: "held", now, x: frame % 2 ? 40 : 300, y: 500 + frame }))).toEqual(expected);
    }
    expect(carried.sample(input({ row: 8, status: "held", now: 1001, reduced: true }))).toMatchObject({ column: 0, scaleX: 1, scaleY: 1, tilt: 0, bob: 0 });
  });

  it("keeps the lite30 cadence at60/120Hz, including fractional rAF origins", () => {
    for (const hz of [60, 120]) for (const offset of [0, .04, 7.7]) {
      let deadline = offset;
      const paints: number[] = [];
      for (let step = 1; step <= hz * 10; step++) {
        const now = offset + step * 1000 / hz;
        const next = nextCompanionPaint(now, deadline, 30);
        if (next !== null) { deadline = next; paints.push(now); }
      }
      expect(paints).toHaveLength(300);
      expect(Math.min(...paints.slice(1).map((now, i) => now - paints[i]))).toBeGreaterThan(33.2);
    }
    expect(nextCompanionPaint(1000, 0, 0)).toBe(1000);
    expect(nextCompanionPaint(32, 0, 30)).toBeNull();
    expect(nextCompanionPaint(1000, 0, 30)).toBeCloseTo(1000);
  });
  it("enters at a clip's first cell and does not reset its clock for a status label", () => {
    const motion = createCompanionMotion({ clips: { 0: [3, 4, 5], 9: [7, 8, 9] } });
    expect(motion.sample(input({ now: 900 })).column).toBe(3);
    expect(motion.sample(input({ now: 900 + 1000 / 6 })).column).toBe(4);
    expect(motion.sample(input({ now: 900 + 2000 / 6, status: "waiting" })).column).toBe(5);
    expect(motion.sample(input({ now: 1800, row: 9, phase: .8, status: "petted" })).column).toBe(7);
    expect(motion.sample(input({ now: 1925, row: 9, status: "happy" })).column).toBe(8);
  });

  it("ping-pongs unproven loops without a last-to-first hard cut", () => {
    const motion = createCompanionMotion({ clips: { 0: [3, 4, 5] } });
    const columns = Array.from({ length: 7 }, (_, step) => motion.sample(input({ now: step * 1000 / 8 })).column);
    expect(columns).toEqual([3, 4, 5, 4, 3, 4, 5]);
  });

  it("keeps a walking stride independent of sample splits, action labels or a stationary pause", () => {
    const whole = createCompanionMotion({ clips: { 2: [0, 1, 2, 3] } });
    const split = createCompanionMotion({ clips: { 2: [0, 1, 2, 3] } });
    whole.sample(input({ row: 2, status: "walk", x: 0 }));
    split.sample(input({ row: 2, status: "walk", x: 0 }));
    const expected = whole.sample(input({ row: 2, status: "walk", x: 24, now: 320 }));
    for (const x of [6, 12, 18]) split.sample(input({ row: 2, status: "approach", x, now: x / 24 * 320 }));
    expect(split.sample(input({ row: 2, status: "approach", x: 24, now: 320 }))).toEqual(expected);
    expect(split.sample(input({ row: 2, status: "paused", x: 24, now: 50000, phase: .95 }))).toEqual(expected);
  });

  it("faces horizontal travel and retains direction during vertical or negligible movement", () => {
    const motion = createCompanionMotion();
    expect(motion.sample(input()).facing).toBe(1);
    expect(motion.sample(input({ row: 2, x: 99, now: 16 })).facing).toBe(-1);
    expect(motion.sample(input({ row: 4, x: 99, y: 450, now: 32 })).facing).toBe(-1);
    expect(motion.sample(input({ row: 4, x: 99.01, y: 430, now: 48 })).facing).toBe(-1);
    expect(motion.sample(input({ row: 4, x: 100, y: 420, now: 64 })).facing).toBe(1);
    expect(motion.sample(input({ row: 5, x: 100, y: 440, now: 80 })).facing).toBe(1);
  });

  it("clamps a one-shot phase and holds its terminal cell", () => {
    const motion = createCompanionMotion({ clips: { 3: [2, 8, 12] } });
    expect(motion.sample(input({ row: 3, phase: .8 })).column).toBe(2);
    expect(motion.sample(input({ row: 3, phase: -4, now: 1 })).column).toBe(2);
    expect(motion.sample(input({ row: 3, phase: .5, now: 2 })).column).toBe(8);
    expect(motion.sample(input({ row: 3, phase: .99, now: 2.5 })).column).toBe(12);
    expect(motion.sample(input({ row: 3, phase: 4, now: 3 })).column).toBe(12);
    expect(motion.sample(input({ row: 3, phase: 1, now: 1000 })).column).toBe(12);
    expect(motion.sample(input({ row: 6, phase: 1, now: 1100 })).column).toBe(0);
  });

  it("shows every selected preparation and landing cell before the next stage", () => {
    const clips = { 3: [6, 4, 2, 1], 6: [1, 2, 4, 5] };
    for (const row of [3, 6] as const) {
      const motion = createCompanionMotion({ clips });
      const seen = [0, .25, .5, .75, .99].map((phase, index) => motion.sample(input({ row, phase, now: index * 40 })).column);
      expect([...new Set(seen)]).toEqual(clips[row]);
    }
  });

  it("samples equal elapsed time and distance identically at60Hz and120Hz", () => {
    const sampleAtRate = (hz: number, row: number) => {
      const motion = createCompanionMotion();
      let pose = motion.sample(input({ row }));
      for (let step = 1; step <= hz * 2; step++) {
        const now = step * 1000 / hz;
        pose = motion.sample(input({ row, now, x: row === 2 ? 100 + now * .07 : 100 }));
      }
      return pose;
    };
    expect(sampleAtRate(60, 0)).toEqual(sampleAtRate(120, 0));
    expect(sampleAtRate(60, 2)).toEqual(sampleAtRate(120, 2));
  });

  it("removes procedural movement and loop advancement under reduced motion", () => {
    const motion = createCompanionMotion({ clips: { 2: [4, 5, 6] } });
    motion.sample(input({ row: 2, x: 0 }));
    const pose = motion.sample(input({ row: 2, x: 10, now: 1000, reduced: true }));
    expect(pose).toMatchObject({ column: 4, bob: 0, tilt: 0, scaleX: 1, scaleY: 1 });
  });

  it("keeps a single curated frame valid and rejects invalid atlas indices", () => {
    const motion = createCompanionMotion({ clips: { 0: [-1, 20, NaN, 4], 9: [] } });
    expect(motion.sample(input()).column).toBe(4);
    expect(motion.sample(input({ now: 100000 })).column).toBe(4);
    const invalid = motion.sample(input({ row: NaN, phase: NaN, x: NaN, y: NaN, now: NaN }));
    expect(Object.values(invalid).every(Number.isFinite)).toBe(true);
  });

  it("eases travel monotonically with quiet velocity and acceleration at both ends", () => {
    expect(sampleCompanionTravel(-1)).toBe(0); expect(sampleCompanionTravel(2)).toBe(1);
    expect(sampleCompanionTravel(NaN)).toBe(0); expect(sampleCompanionTravel(.5)).toBe(.5);
    const samples = Array.from({ length: 101 }, (_, i) => sampleCompanionTravel(i / 100));
    expect(samples.every((value, index) => index === 0 || value >= samples[index - 1])).toBe(true);
    const e = 1e-5;
    expect(sampleCompanionTravel(e) / e).toBeLessThan(.00001);
    expect((1 - sampleCompanionTravel(1 - e)) / e).toBeLessThan(.00001);
    expect(Math.abs((sampleCompanionTravel(2 * e) - 2 * sampleCompanionTravel(e)) / e ** 2)).toBeLessThan(.001);
  });

  it("allows the two new logical clips only when the renderer supplies rowCount18", () => {
    const clips = { 16: [0, 1, 2, 3, 4, 5, 6, 7], 17: [0, 1, 2, 3, 4, 5, 6, 7] };
    const legacy = createCompanionMotion({ clips });
    expect(legacy.sample(input({ row: 16 })).row).toBe(15);
    const native = createCompanionMotion({ clips, rowCount: 18 });
    expect(native.sample(input({ row: 16 })).column).toBe(0);
    expect(native.sample(input({ row: 16, phase: .5, now: 200 }))).toMatchObject({ row: 16, column: 4, scaleX: .986, scaleY: 1.026 });
    expect(native.sample(input({ row: 17, phase: 0, now: 400 })).row).toBe(17);
    const shaking = native.sample(input({ row: 17, phase: .25, now: 600 }));
    expect(shaking.column).toBe(2); expect(Math.abs(shaking.tilt)).toBeGreaterThan(1);
    expect(Object.values(native.sample(input({ row: 999, phase: 1, now: 800 }))).every(Number.isFinite)).toBe(true);
  });

  it("cycles explicitly authored walking frames forward while legacy clips keep ping-pong", () => {
    const frames = Array.from({ length: 8 }, (_, index) => index);
    const motion = createCompanionMotion({ clips: { 2: frames }, loopRows: [2] });
    const seen = Array.from({ length: 9 }, (_, step) => motion.sample(input({ row: 2, x: step * 10, now: step * 100 })).column);
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 0]);
  });

  it("caps a16-frame native walk at14 authored changes per second without a catch-up dance", () => {
    const motion = createCompanionMotion({ clips: { 2: Array.from({ length: 16 }, (_, i) => i) }, loopRows: [2], maxFrameRate: 14 });
    let pose = motion.sample(input({ row: 2, x: 0 })), changes = 0;
    for (let frame = 1; frame <= 120; frame++) {
      const next = motion.sample(input({ row: 2, x: frame / 120 * 200, now: frame / 120 * 1000 }));
      if (next.column !== pose.column) changes++;
      pose = next;
    }
    expect(changes).toBe(14);
    expect(motion.sample(input({ row: 2, x: 200, now: 50000 }))).toEqual(pose);
  });

  it("carries a moving body's scalar pose across a clip change and settles within100ms", () => {
    const motion = createCompanionMotion();
    motion.sample(input({ row: 2, x: 0 }));
    motion.sample(input({ row: 2, x: 4, now: 40 }));
    const walking = motion.sample(input({ row: 2, x: 8, now: 80 }));
    expect(Math.abs(walking.bob)).toBeGreaterThan(.5);
    const resting = motion.sample(input({ row: 0, x: 8, now: 96 }));
    for (const key of ["bob", "scaleX", "scaleY", "tilt"] as const) expect(resting[key]).toBe(walking[key]);
    const next = motion.sample(input({ row: 0, x: 8, now: 97 }));
    expect(Math.abs(next.bob - resting.bob)).toBeLessThan(.05);
    expect(motion.sample(input({ row: 0, x: 8, now: 196 }))).toMatchObject({ bob: 0, scaleX: 1, scaleY: 1, tilt: 0 });
  });

  it("keeps a native capped walk identical at60Hz and120Hz", () => {
    const atRate = (hz: number) => {
      const motion = createCompanionMotion({ rowCount: 18, clips: { 2: Array.from({ length: 16 }, (_, i) => i) }, loopRows: [2] });
      let pose = motion.sample(input({ row: 2, x: 0 }));
      for (let frame = 1; frame <= hz * 2; frame++) pose = motion.sample(input({ row: 2, x: frame / hz * 70, now: frame / hz * 1000 }));
      return pose;
    };
    expect(atRate(60)).toEqual(atRate(120));
  });

  it("keeps facing while a hand reverses travel and resumes heading after release", () => {
    const motion = createCompanionMotion();
    motion.sample(input({ row: 2, x: 100 }));
    expect(motion.sample(input({ row: 2, x: 90, now: 50 })).facing).toBe(-1);
    expect(motion.sample(input({ row: 8, status: "held", x: 140, now: 100 })).facing).toBe(-1);
    expect(motion.sample(input({ row: 8, status: "held", x: 60, now: 150 })).facing).toBe(-1);
    expect(motion.sample(input({ row: 2, x: 70, now: 200 })).facing).toBe(1);
  });

  it("reduced motion cancels even an interrupted stretch or shake mixer immediately", () => {
    const motion = createCompanionMotion({ rowCount: 18 });
    motion.sample(input({ row: 17, phase: .25 }));
    motion.sample(input({ row: 17, phase: .25, now: 200 }));
    for (const row of [16, 17, 2, 0]) expect(motion.sample(input({ row, phase: .5, x: 200, now: 220 + row, reduced: true }))).toMatchObject({ column: 0, bob: 0, scaleX: 1, scaleY: 1, tilt: 0 });
  });
});
