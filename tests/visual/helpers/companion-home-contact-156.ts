import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";

/** Read-only evidence for the full-motion149 cases, not a runtime setter or
 * a reduced-motion contract. Rectangles are actual viewport BCRs. The handle
 * is registered geometry; the155 artwork/cord feedback supplies its pixels. */
export type ContactRect = { x: number; y: number; width: number; height: number };
export type ContactPaint = { rect: ContactRect | null; visible: boolean };
export type NativeHomeControlFrame = {
  at: number;
  control: {
    actor: ContactPaint & { decoded: boolean; pose: number; src: string; platform: string; reach: string };
    tool: ContactPaint;
    lamp: {
      button: ContactPaint; paint: ContactPaint; handle: ContactPaint;
      touch: boolean; state: string; requestedPull: number; cssWidth: number;
      art: ContactPaint & { source: string };
      feedback: ContactPaint & { source: string; opacity: number; clip: string };
    };
    tv: ContactPaint & { decoded: boolean; src: string };
  };
};
export type NativeHomeControlWitness = { at: number; kind: "light" | "tv"; pose: number; actor: ContactRect; target: { x: number; y: number }; measuredPull?: number; neutralAt?: number };
export const NATIVE_HOME_CONTACT_WINDOW_MS = 650;
const finite = (...values: number[]) => values.every(Number.isFinite);
const validRect = (rect: ContactRect | null | undefined): rect is ContactRect => Boolean(rect && finite(rect.x, rect.y, rect.width, rect.height) && rect.width > 0 && rect.height > 0);
const painted = (paint: ContactPaint | null | undefined): paint is ContactPaint & { rect: ContactRect } => Boolean(paint?.visible && validRect(paint.rect));
const center = (rect: ContactRect) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
function path(value: string) {
  const source = value.startsWith("url(") ? value.replace(/^url\(["']?/, "").replace(/["']?\)$/, "") : value;
  try { return new URL(source, "https://read-only.invalid").pathname; } catch { return ""; }
}
function sameRect(a: ContactRect, b: ContactRect, tolerance = .75) {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance && Math.abs(a.width - b.width) <= tolerance && Math.abs(a.height - b.height) <= tolerance;
}
function genuineActor(frame: NativeHomeControlFrame) {
  const actor = frame.control?.actor;
  if (!actor || !painted(actor) || !actor.decoded || !Number.isInteger(actor.pose) || actor.pose < 0 || actor.pose >= companionSpriteMetadata.frames.length) return false;
  const pose = companionSpriteMetadata.frames[actor.pose];
  return path(actor.src) === companionSpriteMetadata.atlases[pose.atlas].src
    && /^companion-home-floor(?:-\d+)?$/.test(actor.platform) && actor.platform !== "companion-home-floor-400";
}
function nearActor(target: { x: number; y: number }, actor: ContactRect) {
  const point = center(actor), dx = Math.max(actor.x - target.x, 0, target.x - actor.x - actor.width), dy = Math.max(actor.y - target.y, 0, target.y - actor.y - actor.height);
  return Math.hypot(target.x - point.x, target.y - point.y) <= actor.height * 1.5 && Math.hypot(dx, dy) <= actor.height * .5;
}
function cssPaintHeight(frame: NativeHomeControlFrame) {
  const lamp = frame.control.lamp;
  return painted(lamp.paint) && finite(lamp.cssWidth) && lamp.cssWidth > 0 ? lamp.paint.rect.height * lamp.cssWidth / lamp.paint.rect.width : Number.NaN;
}
function measuredTug(frames: readonly NativeHomeControlFrame[], index: number) {
  const current = frames[index], lamp = current.control.lamp, height = cssPaintHeight(current);
  if (!finite(height) || !painted(lamp.button)) return;
  // A neutral pair measures the actual untugged paint, including shell zoom.
  // Neither a hover's1.5px request nor a label alone can provide this baseline.
  for (let i = index - 1; i > 0; i--) {
    const a = frames[i - 1], b = frames[i], first = a.control?.lamp, second = b.control?.lamp;
    if (!first || !second) continue;
    if (a.at >= current.at || b.at >= current.at || b.at - a.at < 8 || b.at - a.at > 250 || first.touch || second.touch || first.requestedPull !== 0 || second.requestedPull !== 0) continue;
    if (!painted(first.paint) || !painted(second.paint) || !painted(first.button) || !painted(second.button) || Math.abs(first.cssWidth - lamp.cssWidth) > .05 || Math.abs(second.cssWidth - lamp.cssWidth) > .05) continue;
    // The two paints and button must have stable dimensions, not a resizing
    // house or a still-relaxing previous tug. Translation/scroll is immaterial.
    const scale = lamp.paint.rect!.width / lamp.cssWidth, firstScale = first.paint.rect.width / first.cssWidth, secondScale = second.paint.rect.width / second.cssWidth;
    if (!finite(scale, firstScale, secondScale) || Math.min(scale, firstScale, secondScale) <= 0 || Math.abs(first.button.rect.height / firstScale - lamp.button.rect.height / scale) > .05 || Math.abs(second.button.rect.height / secondScale - lamp.button.rect.height / scale) > .05) continue;
    const firstHeight = cssPaintHeight(a), secondHeight = cssPaintHeight(b);
    if (!finite(firstHeight, secondHeight) || Math.abs(firstHeight - secondHeight) > .05) continue;
    const pull = height - secondHeight;
    if (pull >= 1 && pull <= 3.25) return { measuredPull: pull, neutralAt: b.at };
  }
}

/** The caller separately requires the actual lamp/TV mutation and resumed
 * meaningful activity. This helper proves the matching prior physical reach,
 * inside the unchanged650ms window; it does not certify old incomplete raw. */
export function nativeHomeControlContactBefore(frames: readonly NativeHomeControlFrame[], at: number, kind: "light" | "tv"): NativeHomeControlWitness | undefined {
  if (!Number.isFinite(at) || !["light", "tv"].includes(kind) || frames.some((frame, index) => !Number.isFinite(frame.at) || index > 0 && frame.at <= frames[index - 1].at)) return;
  for (let index = frames.length - 1; index >= 0; index--) {
    const frame = frames[index];
    if (frame.at > at || frame.at < at - NATIVE_HOME_CONTACT_WINDOW_MS || !frame.control || !genuineActor(frame)) continue;
    const { actor, lamp, tool, tv } = frame.control;
    if (!actor || !lamp || !tool || !tv || actor.reach !== kind || !actor.rect) continue;
    if (kind === "tv") {
      if (!painted(tool) || !painted(tv) || !tv.decoded || path(tv.src) !== "/companion/home/136/tv-body.webp") continue;
      const target = { x: tv.rect.x + tv.rect.width * .36, y: tv.rect.y + tv.rect.height * .5 }, touch = center(tool.rect);
      // Runtime places the18px sparkle at the registered CRT contact(.36,.5),
      // with a1px vertical offset and a small rotation. It must touch that TV.
      if (Math.hypot(touch.x - target.x, touch.y - target.y) > 4 || !nearActor(target, actor.rect)) continue;
      return { at: frame.at, kind, pose: actor.pose, actor: actor.rect, target };
    }
    if (!lamp.touch || !finite(lamp.requestedPull) || Math.abs(lamp.requestedPull - 3) > .01 || tool.visible || !["on", "off"].includes(lamp.state)) continue;
    if (!painted(lamp.button) || !painted(lamp.paint) || !painted(lamp.handle) || !painted(lamp.art) || !painted(lamp.feedback) || !finite(lamp.feedback.opacity) || lamp.feedback.opacity <= .05 || !lamp.feedback.clip.startsWith("polygon(")) continue;
    const source = `/companion/home/155/lamp-${lamp.state}.webp`;
    if (path(lamp.art.source) !== source || path(lamp.feedback.source) !== source || !sameRect(lamp.art.rect, lamp.paint.rect) || !sameRect(lamp.feedback.rect, lamp.paint.rect)) continue;
    // The155 handle is the actual artwork's registered lower cord knob;
    // an arbitrary invisible rectangle elsewhere cannot satisfy contact.
    const expected = { x: lamp.paint.rect.x + lamp.paint.rect.width * (.5 + 334 / 1024), y: lamp.paint.rect.y + lamp.paint.rect.height - lamp.paint.rect.width * (18 + 132) / 1024, width: lamp.paint.rect.width * 80 / 1024, height: lamp.paint.rect.width * 132 / 1024 };
    if (!sameRect(lamp.handle.rect, expected)) continue;
    const target = center(lamp.handle.rect), tug = measuredTug(frames, index);
    if (!tug || !nearActor(target, actor.rect)) continue;
    return { at: frame.at, kind, pose: actor.pose, actor: actor.rect, target, ...tug };
  }
}
