import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";

type Frame = { at: number; state: string; scene: string; serial: string; beat: string; pose: number; x: number; y: number };
const rows: Readonly<Record<string, readonly number[]>> = { walk: [2, 20], jump: [3, 4, 5, 6, 7], stretch: [16], sniff: [1], shake: [17] };
/** Input is already filtered by the native decoded/visible/current-cell pixel
 * source predicate. A state label/first adopted drawing alone proves no motion.
 * Keep one contiguous same-action bout inside the original next10s window. */
export function nextActionProgress157<T extends Frame>(trusted: readonly T[], endedAt: number, previous: { scene: string; serial: string }): T | undefined {
  if (!Number.isFinite(endedAt) || trusted.some((frame, index) => ![frame.at, frame.x, frame.y].every(Number.isFinite)
    || index > 0 && frame.at <= trusted[index - 1].at)) return;
  let first: T | undefined, last: T | undefined;
  for (const frame of trusted) {
    const clip = rows[frame.state];
    if (![frame.at, frame.x, frame.y].every(Number.isFinite) || frame.at <= endedAt + 100 || frame.at > endedAt + 10_000
      || frame.scene === previous.scene && frame.serial === previous.serial || !clip?.some(row => companionSpriteMetadata.rows[row].includes(frame.pose))) {
      first = last = undefined; continue;
    }
    if (!last || frame.at <= last.at || frame.at - last.at > 180 || frame.state !== last.state
      || frame.scene !== last.scene || frame.serial !== last.serial || frame.beat !== last.beat) first = frame;
    if (first && frame.at - first.at >= 100 && (["walk", "jump"].includes(frame.state)
      ? Math.hypot(frame.x - first.x, frame.y - first.y) >= 24 : frame.pose !== first.pose)) return frame;
    last = frame;
  }
}
