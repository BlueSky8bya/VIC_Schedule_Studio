import type { CompanionAccessoryId } from "./gifts";

export type CompanionAccessoryTransform = Readonly<{ lift: number; shift: number; roll: number; scale: number }>;
export type CompanionAccessoryMotion = Readonly<{ row: number; frame: number; bodyLift: number; bodyLean: number; squash: number; accessory: CompanionAccessoryTransform; phase: "prepare" | "show" | "settle" | "done"; done: boolean }>;
export const COMPANION_ACCESSORY_MOTION_MS = 2600;
export const isCompanionHat = (id: CompanionAccessoryId) => id === "beret" || id === "flower-crown" || id === "baseball-cap" || id === "party-hat";
const unit = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const pulse = (progress: number, from: number, to: number) => progress <= from || progress >= to ? 0 : Math.sin((progress - from) / (to - from) * Math.PI);

/** Finite source-preserving gestures. The existing pose clock is the only
 * clock; no timer, body drawing, human hand or persistent state lives here. */
export function sampleCompanionAccessoryMotion(id: CompanionAccessoryId, elapsedMs: number): CompanionAccessoryMotion {
  const p = unit(elapsedMs / COMPANION_ACCESSORY_MOTION_MS), show = pulse(p, .14, .88), settle = pulse(p, .72, 1);
  let row = 9, bodyLift = 0, bodyLean = 0, squash = 0, lift = 0, shift = 0, roll = 0, scale = 1;
  if (isCompanionHat(id)) {
    const airborne = p > .18 && p < .6, flight = unit((p - .18) / .42), hop = airborne ? 4 * flight * (1 - flight) : 0, floating = pulse(p, .24, .82);
    bodyLift = hop * 26; squash = pulse(p, .05, .18) * .045 + pulse(p, .6, .76) * .035;
    lift = floating * 9; roll = floating * (id === "party-hat" ? 7 : id === "flower-crown" ? -4 : id === "baseball-cap" ? -7 : 4);
    row = p < .18 ? 3 : p < .6 ? 4 : p < .76 ? 6 : 9;
  } else if (id === "sunglasses" || id === "pixel-sunglasses") {
    const raised = pulse(p, .3, .9), tilt = pulse(p, .12, .4);
    lift = raised * (id === "pixel-sunglasses" ? 7 : 9); roll = tilt * (id === "pixel-sunglasses" ? -16 : 12);
    bodyLean = show * (id === "pixel-sunglasses" ? -5 : 4); scale += show * .025;
  } else if (id === "bow") { roll = Math.sin(p * Math.PI * 6) * show * 12; scale += show * .08; bodyLean = show * 2; }
  else if (id === "star-pin") { roll = Math.sin(p * Math.PI * 4) * show * 19; scale += show * .16; bodyLean = -show * 3; }
  else if (id === "satchel") { roll = Math.sin(p * Math.PI * 4) * show * 15; shift = show * 2; bodyLean = show * 5; }
  else if (id === "scarf") { shift = Math.sin(p * Math.PI * 4) * show * 2.5; roll = show * -9; bodyLean = show * 3; }
  else if (id === "bell-pendant") { roll = Math.sin(p * Math.PI * 10) * show * 17; bodyLean = Math.sin(p * Math.PI * 4) * show * 2; }
  else if (id === "leaf-umbrella") { roll = show * -15; lift = show * 3; bodyLean = show * 4; }
  if (p <= 0 || p >= 1) { if (p >= 1) row = 9; bodyLift = bodyLean = squash = lift = shift = roll = 0; scale = 1; }
  return { row, frame: p >= 1 ? 15 : (show + settle * .1) * 15, bodyLift, bodyLean, squash, accessory: { lift, shift, roll, scale }, phase: p >= 1 ? "done" : p < .18 ? "prepare" : p < .78 ? "show" : "settle", done: p >= 1 };
}

/** Geometry is measured by the existing world scan. A hat hop gets enough
 * headroom for the whole92px body and the detached ornament, not just feet. */
export function canStartCompanionAccessoryMotion(input: { id: CompanionAccessoryId; roam: boolean; stable: boolean; safe: boolean; headroom: number; edgeClearance: number; energy: number }): boolean {
  return input.roam && input.safe && input.stable && [input.headroom, input.edgeClearance, input.energy].every(Number.isFinite) && input.energy >= .25 && input.edgeClearance >= 48 && input.headroom >= (isCompanionHat(input.id) ? 150 : 110);
}
