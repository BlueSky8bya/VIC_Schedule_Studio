import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { curiousTextureCellMatches, type CuriousTextureCellMeasurement } from "./companion-curious-completion-144";

/** Read-only native observations, never renderer goals or acknowledgement. */
export type SofaWorldFrame156 = {
  at: number; phase: string; native: boolean; state: string; platform: string;
  sameActor: boolean; sameInput: boolean; inputFocused: boolean; visible: boolean;
  positionAnchor: string; inlinePositionAnchor: string; position: string;
  homeScroll: number; pose: number; decoded: boolean;
  cell: CuriousTextureCellMeasurement | null;
  left: number; top: number; width: number; height: number;
  origin: number[]; matrix: number[] | null;
  rect: { x: number; y: number; width: number; height: number } | null;
};

/** DOMMatrix uses column-major entries. The portal is a fixed direct body
 * child with no transformed ancestor; callers must independently admit that
 * real condition. This is a coordinate-space invariant, not landing accuracy.
 * Perspective/3D inputs receive no invented estimate. */
export function sofaExpectedWorldRect156(frame: SofaWorldFrame156) {
  const m = frame.matrix, o = frame.origin;
  if (frame.position !== "fixed" || !m || m.length !== 16 || o.length < 2
    || ![...m, ...o, frame.left, frame.top, frame.width, frame.height].every(Number.isFinite)
    || frame.width <= 0 || frame.height <= 0
    || [2, 3, 6, 7, 8, 9, 11, 14].some(i => Math.abs(m[i]) > .000001)
    || Math.abs(m[10] - 1) > .000001 || Math.abs(m[15] - 1) > .000001) return null;
  const corners = [[0, 0], [frame.width, 0], [0, frame.height], [frame.width, frame.height]].map(([x, y]) => ({
    x: frame.left + m[12] + o[0] + m[0] * (x - o[0]) + m[4] * (y - o[1]),
    y: frame.top + m[13] + o[1] + m[1] * (x - o[0]) + m[5] * (y - o[1]),
  }));
  const x = Math.min(...corners.map(p => p.x)), y = Math.min(...corners.map(p => p.y));
  return { x, y, width: Math.max(...corners.map(p => p.x)) - x, height: Math.max(...corners.map(p => p.y)) - y };
}

export function sofaWorldRectError156(frame: SofaWorldFrame156) {
  const expected = sofaExpectedWorldRect156(frame), actual = frame.rect;
  if (!expected || !actual || !Object.values(actual).every(Number.isFinite) || actual.width <= 0 || actual.height <= 0) return Infinity;
  return Math.max(...(["x", "y", "width", "height"] as const).map(key => Math.abs(expected[key] - actual[key])));
}

const registered = (frame: SofaWorldFrame156, rows: readonly number[]) => frame.decoded
  && curiousTextureCellMatches(frame.pose, frame.cell)
  && rows.some(row => companionSpriteMetadata.rows[row]?.includes(frame.pose));

/** Audit every world sample from the FIRST actually observed anchor release,
 * including hidden/missing/stale/wrong-owner observations. Native scroll and
 * its prepaint candidates remain in raw; this does not adjudicate old143.
 * Grounding means subsequent physical continuity, no designated landing point.
 */
export function auditSofaWorldTransfer156(frames: readonly SofaWorldFrame156[]) {
  const issues: string[] = [];
  const transfer = frames.filter(frame => ["world-input", "world-release"].includes(frame.phase));
  const start = transfer.findIndex(frame => !frame.native);
  const world = start < 0 ? [] : transfer.slice(start);
  if (world.length < 8) issues.push("insufficient actual world transfer frames");
  if (!world.length || world.some(frame => !Number.isFinite(frame.homeScroll) || frame.homeScroll <= 5)) issues.push("actual nonzero room scroll not retained throughout world transfer");
  for (let i = 0; i < world.length; i++) {
    const frame = world[i];
    if (!Number.isFinite(frame.at) || i && (frame.at <= world[i - 1].at || frame.at - world[i - 1].at > 250)) issues.push(`observation continuity:${i}`);
    if (frame.native || frame.positionAnchor !== "auto" || frame.inlinePositionAnchor !== "") issues.push(`anchor association retained:${i}`);
    if (!frame.sameActor || !frame.sameInput || !frame.visible || !frame.rect) issues.push(`body/input ownership or visibility:${i}`);
    if (sofaWorldRectError156(frame) >= 1) issues.push(`world transform/BCR mismatch:${i}`);
    if (frame.phase === "world-input" && frame.state === "held" && !frame.inputFocused) issues.push(`native input focus lost:${i}`);
  }
  const held = world.filter(frame => frame.state === "held" && frame.rect);
  if (held.length < 2 || Math.max(0, ...held.map(frame => Math.hypot(frame.rect!.x - held[0].rect!.x, frame.rect!.y - held[0].rect!.y))) < 48) issues.push("actual held displacement not observed");
  const released = world.filter(frame => frame.phase === "world-release");
  const moving = released.filter(frame => frame.state === "jump" && registered(frame, [3, 4, 5, 6, 7]) && frame.rect);
  if (moving.length < 3 || new Set(moving.map(frame => frame.pose)).size < 2
    || Math.max(0, ...moving.map(frame => Math.hypot(frame.rect!.x - moving[0].rect!.x, frame.rect!.y - moving[0].rect!.y))) < 8) issues.push("decoded physical flight not observed");
  const lastMoving = moving.at(-1);
  const next = released.find(frame => lastMoving && frame.at > lastMoving.at && frame.state !== "jump" && frame.state !== "held"
    && frame.platform !== "" && registered(frame, [0, 1, 2, 16, 17, 20, 26]) && frame.rect);
  if (!next || !lastMoving || next.at - lastMoving.at > 1000) issues.push("next decoded grounded action not observed");
  return { issues, worldFrames: world.length, heldFrames: held.length, flightFrames: moving.length,
    nextActionAt: next?.at ?? null, maxWorldError: Math.max(0, ...world.map(sofaWorldRectError156)) };
}
