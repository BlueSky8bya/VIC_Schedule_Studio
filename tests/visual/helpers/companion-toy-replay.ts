import type { CompanionPlay } from "@/lib/ui/viewer-companion/brain";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";

export type NativeToyReplayFrame = {
  at: number; state: string; pose: number; decoded: boolean; toyAction: string;
  toys: readonly { id: string; kind: string; carried: boolean; held: boolean; falling: boolean; visible: boolean; decoded: boolean; x: number; y: number }[];
};
export type NativeToyReplayWitness = { pickedAt: number; playedAt: number; releasedAt: number; settledAt: number; endedAt: number; paintedMs: number; poses: number };

/** Read-only evidence for one NEW toss after the first discovery. The real
 * toy planner's playfulCarry lasts1100ms; allow80ms for observed endpoints,
 * and also require every shared semantic row,
 * changing actual poses, visible continuous playback, real flight and rest.
 * Release occurs at the renderer's halfway effect, during that same play.
 * `decoded` is the probe's existing visible+decoded condition, not decode alone.
 * This observes native frames; it neither rewards nor directs the companion. */
export function completedNativeToyReplay(frames: readonly NativeToyReplayFrame[], toyId: string, after: number, play: CompanionPlay): NativeToyReplayWitness | undefined {
  if (!toyId || !Number.isFinite(after)) return;
  const rows = COMPANION_PLAY_TIMING[play].beats.map(beat => companionSpriteMetadata.rows[beat.row]);
  type Candidate = { pickedAt: number; playedAt?: number; lastPlayedAt?: number; releasedAt?: number; settledAt?: number; endedAt?: number;
    poses: Set<number>; rows: Set<number>; rowTimes: Map<number, { first: number; last: number; count: number }>;
    lastRow: number; fallingPoints: { x: number; y: number }[]; settledFrames: number };
  let previous: NativeToyReplayFrame | undefined, candidate: Candidate | undefined;
  for (const frame of frames) {
    if (!Number.isFinite(frame.at) || previous && frame.at <= previous.at) return;
    const toy = frame.toys.find(item => item.id === toyId), prior = previous?.toys.find(item => item.id === toyId);
    if (frame.at <= after) { previous = frame; continue; }
    const usable = frame.decoded && toy?.visible && toy.decoded && !toy.held && Number.isFinite(toy.x) && Number.isFinite(toy.y);
    if (!usable || previous && frame.at - previous.at > 160 || frame.toyAction !== "play") candidate = undefined;
    else {
      if (!candidate && previous?.decoded && prior?.visible && prior.decoded && prior.kind === toy.kind && !prior.carried && !prior.held && !prior.falling && toy.carried && !toy.falling) {
        candidate = { pickedAt: frame.at, poses: new Set(), rows: new Set(), rowTimes: new Map(), lastRow: -1, fallingPoints: [], settledFrames: 0 };
      }
      if (candidate) {
        const mapped = rows.flatMap((row, index) => row.includes(frame.pose) ? [index] : []);
        if (frame.state === "play" && mapped.length && candidate.endedAt === undefined) {
          if (candidate.playedAt === undefined && toy.carried && mapped.includes(0)) candidate.playedAt = frame.at;
          if (candidate.playedAt !== undefined) {
            const semanticRow = mapped.find(row => row >= candidate!.lastRow);
            if (semanticRow === undefined) candidate = undefined;
            else {
              candidate.lastRow = semanticRow; candidate.lastPlayedAt = frame.at; candidate.poses.add(frame.pose); candidate.rows.add(semanticRow);
              const old = candidate.rowTimes.get(semanticRow); candidate.rowTimes.set(semanticRow, { first: old?.first ?? frame.at, last: frame.at, count: (old?.count ?? 0) + 1 });
            }
          }
        } else if (candidate.playedAt !== undefined) {
          if (frame.state === "idle" && candidate.lastPlayedAt !== undefined && candidate.lastPlayedAt - candidate.playedAt >= 1100 - 80
            && candidate.poses.size >= 2 && candidate.rows.size === rows.length && COMPANION_PLAY_TIMING[play].beats.every((beat, index) => {
              const painted = candidate!.rowTimes.get(index);
              return painted && painted.count >= 2 && painted.last - painted.first >= 1100 * beat.duration / COMPANION_PLAY_TIMING[play].duration - 80;
            })) candidate.endedAt ??= frame.at;
          else candidate = undefined;
        }
        if (candidate && prior?.carried && !toy.carried) {
          if (candidate.playedAt !== undefined && frame.state === "play" && toy.falling) candidate.releasedAt = frame.at;
          else candidate = undefined;
        }
        if (candidate?.releasedAt !== undefined) {
          if (toy.carried) candidate = undefined;
          else if (toy.falling) { candidate.fallingPoints.push({ x: toy.x, y: toy.y }); candidate.settledFrames = 0; candidate.settledAt = undefined; }
          else { candidate.settledAt ??= frame.at; candidate.settledFrames++; }
        }
        if (candidate?.playedAt !== undefined && candidate.lastPlayedAt !== undefined && candidate.releasedAt !== undefined
          && candidate.settledAt !== undefined && candidate.endedAt !== undefined && candidate.settledFrames >= 2
          && candidate.fallingPoints.length >= 2 && candidate.fallingPoints.some(point => Math.hypot(point.x - candidate!.fallingPoints[0].x, point.y - candidate!.fallingPoints[0].y) >= 2)) {
          return { pickedAt: candidate.pickedAt, playedAt: candidate.playedAt, releasedAt: candidate.releasedAt, settledAt: candidate.settledAt,
            endedAt: candidate.endedAt, paintedMs: candidate.lastPlayedAt - candidate.playedAt, poses: candidate.poses.size };
        }
      }
    }
    previous = frame;
  }
}
