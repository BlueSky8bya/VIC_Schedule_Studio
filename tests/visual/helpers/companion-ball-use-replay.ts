import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";

/** Current149 ball use only. Other84-toy uses need their own measured witness;
 * a kind/use label alone never proves motion or a completed performance. */
export type NativeBallUseFrame = {
  at: number; state: string; pose: number; decoded: boolean; toyAction: string;
  actor: { x: number; y: number };
  toys: readonly {
    id: string; kind: string; use: string; carried: boolean; held: boolean;
    falling: boolean; visible: boolean; decoded: boolean;
    x: number; y: number; rotation: number;
  }[];
};
export type NativeBallUseWitness = {
  pickedAt: number; playedAt: number; releasedAt: number; settledAt: number;
  endedAt: number; paintedMs: number; poses: number; riseCssPx: number;
  returnCssPx: number; lateralCssPx: number; rotationDegrees: number;
};

const DURATION = 2600, ENDPOINT_TOLERANCE = 80, MAX_SAMPLE_GAP = 160;
const rows = [companionSpriteMetadata.rows[1], companionSpriteMetadata.rows[9]];
const finite = (...values: number[]) => values.every(Number.isFinite);
const turn = (value: number) => (value + 540) % 360 - 180;

/** Observe one NEW full ball-toss after first discovery. Unlike legacy142's
 *1100ms pounce,149 holds this same real ball for its2600ms throw-and-catch,
 *then releases it into ordinary finite physics. Both old and current helpers
 *remain separate; this one cannot turn a frozen/held/partial use into a PASS.
 *
 * The rAF probe supplies real BCR points. Ball movement is relative to the
 *same actor, so scrolling the whole room cannot manufacture an arc. Real
 *post-use release, motion, stable rest and an actual idle end remain required.
 * No product callback, clock, geometry, reward or collection state is changed. */
export function completedNativeBallUseReplay(frames: readonly NativeBallUseFrame[], toyId: string, after: number): NativeBallUseWitness | undefined {
  if (!toyId || !Number.isFinite(after)) return;
  type Point = { x: number; y: number };
  type Candidate = {
    pickedAt: number; firstUseAt?: number; playedAt?: number; lastPlayedAt?: number;
    releasedAt?: number; settledAt?: number; endedAt?: number;
    poses: Set<number>; rowTimes: { first: number; last: number; count: number; poses: Set<number> }[];
    lastRow: number; usePoints: Point[]; rotations: number[];
    fallingPoints: Point[]; rest?: Point; settledFrames: number;
  };
  let previous: NativeBallUseFrame | undefined, candidate: Candidate | undefined;
  for (const frame of frames) {
    if (!Number.isFinite(frame.at) || previous && frame.at <= previous.at) return;
    const matches = frame.toys.filter(item => item.id === toyId), previousMatches = previous?.toys.filter(item => item.id === toyId) ?? [];
    const toy = matches.length === 1 ? matches[0] : undefined, prior = previousMatches.length === 1 ? previousMatches[0] : undefined;
    if (frame.at <= after) { previous = frame; continue; }
    const usable = frame.decoded && toy?.kind === "ball" && toy.visible && toy.decoded && !toy.held
      && finite(toy.x, toy.y, toy.rotation, frame.actor?.x, frame.actor?.y) && Math.abs(toy.rotation) <= 180;
    if (!usable || previous && frame.at - previous.at > MAX_SAMPLE_GAP) candidate = undefined;
    else {
      if (!candidate && previous?.decoded && prior?.kind === "ball" && prior.visible && prior.decoded && !prior.carried && !prior.held && !prior.falling
        && toy.carried && !toy.falling && frame.toyAction === "play") {
        candidate = { pickedAt: frame.at, poses: new Set(), rowTimes: [], lastRow: -1, usePoints: [], rotations: [], fallingPoints: [], settledFrames: 0 };
      }
      if (candidate) {
        const using = toy.use === "ball-toss";
        if (using && candidate.releasedAt === undefined) {
          const mapped = rows.findIndex(row => row.includes(frame.pose));
          if (!toy.carried || toy.falling || frame.state !== "play" || frame.toyAction !== "play" || mapped < 0 || mapped < candidate.lastRow) candidate = undefined;
          else {
            const firstUseAt = candidate.firstUseAt ??= frame.at;
            if (candidate.playedAt === undefined) {
              // p=0 can paint the neutralrow9 once before the first positive
              // progress frame. It earns no playback; require row1 promptly.
              if (mapped === 0) candidate.playedAt = frame.at;
              else if (frame.at - firstUseAt > ENDPOINT_TOLERANCE) candidate = undefined;
            }
            if (candidate && frame.at - firstUseAt > DURATION + ENDPOINT_TOLERANCE) candidate = undefined;
            if (candidate?.playedAt !== undefined) {
              candidate.lastRow = mapped; candidate.lastPlayedAt = frame.at; candidate.poses.add(frame.pose);
              const row = candidate.rowTimes[mapped] ?? { first: frame.at, last: frame.at, count: 0, poses: new Set<number>() };
              row.last = frame.at; row.count++; row.poses.add(frame.pose); candidate.rowTimes[mapped] = row;
              candidate.usePoints.push({ x: toy.x - frame.actor.x, y: toy.y - frame.actor.y });
              const last = candidate.rotations.at(-1), unwrapped = last === undefined ? toy.rotation : last + turn(toy.rotation - last);
              candidate.rotations.push(unwrapped);
            }
          }
        } else if (candidate.playedAt !== undefined && candidate.releasedAt === undefined) {
          // Use ending while still carried, a different use, or an early
          // release is an interruption; do not borrow a later valid ending.
          const painted = (candidate.lastPlayedAt ?? -Infinity) - candidate.playedAt;
          const rowDurations = [.13, .87].every((fraction, index) => {
            const row = candidate!.rowTimes[index];
            return row && row.count >= 2 && row.poses.size >= 2 && row.last - row.first >= DURATION * fraction - ENDPOINT_TOLERANCE;
          });
          if (toy.use || toy.carried || !toy.falling || !prior?.carried || painted < DURATION - ENDPOINT_TOLERANCE || !rowDurations
            || candidate.poses.size < 4 || !["play", "idle"].includes(frame.state)) candidate = undefined;
          else candidate.releasedAt = frame.at;
        } else if (candidate.playedAt === undefined && (toy.use || !toy.carried || toy.falling || frame.toyAction !== "play")) candidate = undefined;

        if (candidate?.releasedAt !== undefined) {
          if (toy.carried || toy.use) candidate = undefined;
          else {
            if (frame.state === "idle") candidate.endedAt ??= frame.at;
            if (toy.falling) { candidate.fallingPoints.push({ x: toy.x, y: toy.y }); candidate.settledAt = undefined; candidate.settledFrames = 0; candidate.rest = undefined; }
            else {
              if (candidate.rest && Math.hypot(toy.x - candidate.rest.x, toy.y - candidate.rest.y) > 1) { candidate.settledAt = undefined; candidate.settledFrames = 0; }
              candidate.rest = { x: toy.x, y: toy.y }; candidate.settledAt ??= frame.at; candidate.settledFrames++;
            }
          }
        }
        if (candidate?.playedAt !== undefined && candidate.lastPlayedAt !== undefined && candidate.releasedAt !== undefined && candidate.settledAt !== undefined
          && candidate.endedAt !== undefined && candidate.settledFrames >= 2 && candidate.fallingPoints.length >= 2
          && candidate.fallingPoints.some(point => Math.hypot(point.x - candidate!.fallingPoints[0].x, point.y - candidate!.fallingPoints[0].y) >= 2)) {
          const points = candidate.usePoints, peak = points.reduce((best, point, index) => point.y < points[best].y ? index : best, 0);
          const rise = points[0].y - points[peak].y, recovery = points.at(-1)!.y - points[peak].y;
          const lateral = Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x));
          const rotation = Math.max(...candidate.rotations) - Math.min(...candidate.rotations);
          if (peak > 0 && peak < points.length - 1 && rise >= 12 && recovery >= 12 && lateral >= 8 && rotation >= 40) {
            return { pickedAt: candidate.pickedAt, playedAt: candidate.playedAt, releasedAt: candidate.releasedAt, settledAt: candidate.settledAt, endedAt: candidate.endedAt,
              paintedMs: candidate.lastPlayedAt - candidate.playedAt, poses: candidate.poses.size, riseCssPx: rise, returnCssPx: recovery, lateralCssPx: lateral, rotationDegrees: rotation };
          }
          candidate = undefined;
        }
      }
    }
    previous = frame;
  }
}
