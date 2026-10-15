export type CompanionGrip = Readonly<{ x: number; y: number }>;
export type CompanionGripKind = "left-ear" | "right-ear" | "head" | "body" | "lower-body";
const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Physical, unmirrored coordinates in the captured92px cell. This changes
 * local material response, never the pointer, support or character artwork. */
export function companionGripProfile(grip?: CompanionGrip) {
  if (!grip || !Number.isFinite(grip.x) || !Number.isFinite(grip.y)) {
    return { kind: "head" as CompanionGripKind, extension: 1, width: .18, lean: 0, phase: 0, impulse: 1, side: 0 };
  }
  const x = clamp(grip.x), y = clamp(grip.y);
  const kind: CompanionGripKind = y < .35 ? x < .44 ? "left-ear" : x > .56 ? "right-ear" : "head" : y > .78 ? "lower-body" : "body";
  // Continuous spatial weights avoid a discontinuity beside an ear boundary.
  const high = 1 - Math.min(1, y / .44), low = Math.max(0, (y - .72) / .28);
  const side = (.5 - x) * 2;
  return {
    kind,
    extension: 1 + high * .42 - low * .15,
    width: .28 - high * .10,
    lean: side * (4 + high * 19),
    phase: x * 4.7 + y * 2.3,
    impulse: 1 + high * .3 - low * .18,
    side: side * (.45 + high * .55),
  };
}
