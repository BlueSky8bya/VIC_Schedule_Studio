import type { CompanionPlay } from "./brain";

/** Authored finite beats, sampled by the existing display clock. Native art
 * supplies the changed silhouette; these small scalars only connect contact. */
export const COMPANION_PLAY_ROWS = Object.freeze({ sprint: 20, tumble: 21, dizzy: 22, recover: 23, slip: 24, bump: 25, glance: 26, tears: 27, sulk: 28, bow: 29, groom: 30, pounce: 31 });
export type CompanionPlayPose = { row: number; phase: number; beat: "impact" | "dizzy" | "checking" | "recover" | "play"; lift: number; lean: number; shift: number };
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
export function sampleCompanionPlay(kind: CompanionPlay, progress: number, reduced = false): CompanionPlayPose {
  const p = clamp(progress), rows = COMPANION_PLAY_ROWS;
  const result = (row: number, phase: number, beat: CompanionPlayPose["beat"], lift = 0, lean = 0, shift = 0): CompanionPlayPose => ({ row, phase: clamp(phase), beat, lift: reduced ? 0 : lift, lean: reduced ? 0 : lean, shift: reduced ? 0 : shift });
  if (p >= 1) return result(rows.recover, 1, "recover");
  if (reduced) return result(kind === "bonk-tears" ? rows.tears : kind === "bonk-sad" ? rows.sulk : rows.recover, .6, "recover");
  if (kind === "bonk-tears" || kind === "bonk-sad") {
    if (p < .18) return result(rows.bump, p / .18, "impact", -Math.sin(p / .18 * Math.PI) * 3);
    if (p < .78) return result(kind === "bonk-tears" ? rows.tears : rows.sulk, (p - .18) / .6, "checking");
    return result(rows.recover, (p - .78) / .22, "recover");
  }
  if (kind === "groom" || kind === "bow" || kind === "pounce" || kind === "celebrate") {
    const row = kind === "groom" ? rows.groom : kind === "bow" ? rows.bow : rows.pounce;
    if (p > .82) return result(rows.recover, (p - .82) / .18, "recover");
    const phase = Math.sin(p / .82 * Math.PI);
    return result(row, phase, "play", kind === "groom" || kind === "bow" ? 0 : -phase * 9);
  }
  if (p < .42) return result(kind === "tumble" ? rows.tumble : kind === "slip" ? rows.slip : rows.bump, kind === "tumble" ? (p / .42 * 2) % 1 : p / .42, "impact", -Math.sin(p / .42 * Math.PI) * (kind === "tumble" ? 5 : 3), 0, kind === "tumble" ? Math.sin(p / .42 * Math.PI) ** 2 * 22 : 0);
  if (p < .6) return result(kind === "slip" ? rows.tears : rows.dizzy, (p - .42) / .18, kind === "slip" ? "checking" : "dizzy", 0, kind === "slip" ? 0 : Math.sin((p - .42) / .18 * Math.PI * 2) * 3);
  if (p < .82) return result(rows.glance, (p - .6) / .22, "checking");
  return result(rows.recover, (p - .82) / .18, "recover");
}

/** A short actual pointer click is different from hover stroking and capture
 * dragging. Cancellation, long holds and moved pointers cannot become bonks. */
export function companionTapReaction(input: { elapsed: number; moved: number; cancelled: boolean; recentMishap: boolean }): "bonk-sad" | "bonk-tears" | null {
  return !input.cancelled && Number.isFinite(input.elapsed) && input.elapsed >= 0 && input.elapsed <= 350 && Number.isFinite(input.moved) && input.moved <= 6 ? input.recentMishap ? "bonk-sad" : "bonk-tears" : null;
}
