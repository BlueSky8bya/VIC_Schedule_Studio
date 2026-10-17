import type { CompanionPlay } from "./brain";
import { COMPANION_PLAY_TIMING, type CompanionPlayBeat } from "./timing";

/** Authored finite beats, sampled by the existing display clock. Native art
 * supplies the changed silhouette; these small scalars only connect contact. */
export const COMPANION_PLAY_ROWS = Object.freeze({ sprint: 20, tumble: 21, dizzy: 22, recover: 23, slip: 24, bump: 25, glance: 26, tears: 27, sulk: 28, bow: 29, groom: 30, pounce: 31 });
export type CompanionPlayPose = { row: number; phase: number; beat: CompanionPlayBeat; lift: number; lean: number; shift: number; compression: number };
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
export function sampleCompanionPlay(kind: CompanionPlay, progress: number, reduced = false): CompanionPlayPose {
  const p = clamp(progress), rows = COMPANION_PLAY_ROWS;
  const result = (row: number, phase: number, beat: CompanionPlayPose["beat"], lift = 0, lean = 0, shift = 0, compression = 0): CompanionPlayPose => ({ row, phase: clamp(phase), beat, lift: reduced ? 0 : lift, lean: reduced ? 0 : lean, shift: reduced ? 0 : shift, compression: reduced ? 0 : compression });
  if (p >= 1) return result(rows.recover, 1, "recover");
  if (reduced) return result(kind === "bonk-tears" ? rows.tears : kind === "bonk-sad" ? rows.sulk : rows.recover, kind === "bonk-tears" || kind === "bonk-sad" ? .6 : 1, "recover");
  const timing = COMPANION_PLAY_TIMING[kind], age = p * timing.duration;
  let entered = 0;
  for (const stage of timing.beats) {
    if (age + 1e-7 >= entered + stage.duration) { entered += stage.duration; continue; }
    const elapsed = Math.max(0, age - entered), local = clamp(elapsed / stage.duration);
    const phase = stage.cycles ? local * stage.cycles % 1 : local;
    if (stage.beat === "recover") {
      if (kind === "dizzy" || kind === "tumble" || kind === "slip-tumble") {
        // Three brisk head shakes fit inside the first520ms. A smooth envelope
        // starts and ends at rest; the eyes open afterward on the same support.
        const shake = clamp(elapsed / 520), envelope = Math.sin(shake * Math.PI) ** 2;
        const lean = Math.sin(shake * Math.PI * 6) * 8 * envelope;
        const compression = .026 * envelope;
        // Closed strained eyes and a wavy mouth follow each authored left/right
        // key. Only after the final shake does the calm neutral face return.
        const expression = elapsed >= 560 ? 1 : lean < -.6 ? .35 : lean > .6 ? .65 : 0;
        return result(stage.row, expression, stage.beat, 0, lean, 0, compression);
      }
      // Other gestures already own their emotion in the checking/play beat.
      // Their finite outro rests in the calm key rather than playing distress.
      return result(stage.row, 1, stage.beat);
    }
    if (stage.beat === "impact") {
      const rolling = stage.row === rows.tumble;
      return result(stage.row, phase, stage.beat, -Math.sin(local * Math.PI) * (rolling ? 5 : 3), 0, rolling ? Math.sin(local * Math.PI) ** 2 * 22 : 0);
    }
    if (stage.beat === "dizzy") return result(stage.row, phase, stage.beat, 0, Math.sin(local * Math.PI * 2) * 3 * (kind === "dizzy" ? (1 - local) ** 2 : 1));
    if (stage.row === rows.tears || stage.row === rows.sulk) {
      // Reach the readable expression in180ms; keep its terminal key while a
      // tiny finite sniffle supplies life. Do not slowly morph through a cry.
      const onset = Math.min(180, stage.duration * .35);
      const expression = elapsed < onset ? elapsed / onset * .84 : .84 + (elapsed - onset) / (stage.duration - onset) * .16;
      const sniffle = stage.row === rows.tears ? -(Math.sin(elapsed / 230 * Math.PI) ** 2) * Math.sin(local * Math.PI) * .8 : 0;
      return result(stage.row, expression, stage.beat, sniffle);
    }
    if (stage.beat === "play") {
      // These are authored crouch→jump / bow / grooming keys. A sine phase
      // used to rewind their drawings halfway through each gesture.
      const forward = kind === "bow" ? Math.min(1, elapsed / 280) : phase;
      return result(stage.row, forward, stage.beat, kind === "groom" || kind === "bow" ? 0 : -Math.sin(phase * Math.PI) * 9);
    }
    return result(stage.row, phase, stage.beat);
  }
  return result(rows.recover, 1, "recover");
}

/** A short actual pointer click is different from hover stroking and capture
 * dragging. Cancellation, long holds and moved pointers cannot become bonks. */
export function companionTapReaction(input: { elapsed: number; moved: number; cancelled: boolean; recentMishap: boolean }): "bonk-sad" | "bonk-tears" | null {
  return !input.cancelled && Number.isFinite(input.elapsed) && input.elapsed >= 0 && input.elapsed <= 350 && Number.isFinite(input.moved) && input.moved <= 6 ? input.recentMishap ? "bonk-sad" : "bonk-tears" : null;
}
