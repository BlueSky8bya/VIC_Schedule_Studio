import type { RefObject } from "react";
import type { Platform } from "./brain";

type Point = Readonly<{ x: number; y: number }>;
type Viewport = Readonly<{ width: number; height: number }>;
type Range = Readonly<{ x: number; width: number }>;
export type CompanionPositionSnapshot = {
  point: { x: number; y: number };
  viewport: { width: number; height: number };
  monthKey: string;
  seeded: boolean;
  anchor?: { kind: "home" | "home-floor"; u: number } | { kind: "public-card"; eventId: string; u: number; manualTop: boolean };
};
/** Shell-owned transient memory only. No module store, browser storage, DTO,
 * DOM reference, title or account identity belongs to this handoff. */
export type CompanionPositionMemory = RefObject<CompanionPositionSnapshot | null>;
export type CompanionPositionContext = {
  monthKey: string;
  platforms: readonly Platform[];
  landings: readonly Platform[];
  viewport: Viewport;
  size: number;
  /** Actual measured DOM horizontal ranges, before safe-span clipping. */
  homeRange?: Range;
  homeFloorRange?: Range;
  /** Caller proves this currently visible ordinary public card by its actual
   * DOM anchor. Temporary geometry IDs never establish card identity. */
  publicCard?: {
    eventId: string;
    range?: Range;
    platforms: readonly Platform[];
    landings: readonly Platform[];
  };
};
export type CompanionPositionTarget = { point: { x: number; y: number }; platformId: string; kind: NonNullable<CompanionPositionSnapshot["anchor"]>["kind"] };
const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, value));
function limits(viewport: Viewport, size: number) {
  if (![viewport.width, viewport.height, size].every(Number.isFinite) || size <= 0) return null;
  const result = { left: size / 2 + 4, right: viewport.width - size / 2 - 4, top: size + 8, bottom: viewport.height - 12 };
  return result.right >= result.left && result.bottom >= result.top ? result : null;
}

/** A coarse viewport-relative point is only a search origin, never a ledge.
 * The renderer must still resolve a real measured support before painting. */
export function companionPositionPoint(snapshot: CompanionPositionSnapshot | null | undefined, viewport: Viewport, size: number): Point | null {
  const bounds = limits(viewport, size);
  if (!snapshot || !bounds || ![snapshot.point.x, snapshot.point.y, snapshot.viewport.width, snapshot.viewport.height].every(Number.isFinite)
    || snapshot.viewport.width <= 0 || snapshot.viewport.height <= 0) return null;
  const x = snapshot.point.x / snapshot.viewport.width * viewport.width, y = snapshot.point.y / snapshot.viewport.height * viewport.height;
  return Number.isFinite(x) && Number.isFinite(y) ? { x: clamp(x, bounds.left, bounds.right), y: clamp(y, bounds.top, bounds.bottom) } : null;
}

/** Resolve only a matching live anchor family. Missing/deleted/occluded cards
 * return null; callers may search real geometry near companionPositionPoint.
 * An obsolete card-N ID or the coarse point can never create a fake support. */
export function resolveCompanionPosition(snapshot: CompanionPositionSnapshot | null | undefined, context: CompanionPositionContext): CompanionPositionTarget | null {
  const point = companionPositionPoint(snapshot, context.viewport, context.size), bounds = limits(context.viewport, context.size);
  if (!point || !bounds || !snapshot?.seeded || !snapshot.anchor || !snapshot.monthKey || snapshot.monthKey !== context.monthKey || !Number.isFinite(snapshot.anchor.u)) return null;
  const anchor = snapshot.anchor;
  let candidates: readonly Platform[], range: Range | undefined;
  if (anchor.kind === "home") {
    candidates = [...context.platforms, ...context.landings].filter(platform => platform.id === "companion-home");
    range = context.homeRange;
  } else if (anchor.kind === "home-floor") {
    candidates = [...context.platforms, ...context.landings].filter(platform => /^companion-home-floor(?:-\d+)?$/.test(platform.id));
    range = context.homeFloorRange;
  } else if (anchor.kind === "public-card") {
    const card = context.publicCard;
    if (!anchor.eventId || !card || card.eventId !== anchor.eventId) return null;
    candidates = (anchor.manualTop ? card.landings : card.platforms).filter(platform => platform.kind === "card" && (anchor.manualTop || !platform.manualOnly));
    range = card.range;
  } else return null;
  const visible = candidates.flatMap(platform => {
    if (!platform.id || ![platform.x, platform.y, platform.width, platform.x + platform.width].every(Number.isFinite) || platform.width <= 0 || platform.y < bounds.top || platform.y > bounds.bottom) return [];
    const left = Math.max(platform.x, bounds.left), right = Math.min(platform.x + platform.width, bounds.right);
    return right >= left ? [{ platform, left, right }] : [];
  });
  if (!visible.length || range && (![range.x, range.width, range.x + range.width].every(Number.isFinite) || range.width <= 0)) return null;
  // Omitted source ranges use the union of actual current safe fragments.
  // Explicit invalid ranges fail closed instead of inventing a replacement.
  const start = range?.x ?? Math.min(...visible.map(candidate => candidate.left));
  const width = range?.width ?? Math.max(...visible.map(candidate => candidate.right)) - start;
  const desiredX = start + clamp(anchor.u, 0, 1) * width;
  let chosen: { point: { x: number; y: number }; platform: Platform } | null = null, best = Infinity;
  for (const candidate of visible) {
    const x = clamp(desiredX, candidate.left, candidate.right), y = candidate.platform.y;
    const distance = Math.hypot(x - desiredX, y - point.y);
    if (distance < best || distance === best && chosen && (y < chosen.point.y || y === chosen.point.y && (x < chosen.point.x || x === chosen.point.x && candidate.platform.id < chosen.platform.id))) {
      chosen = { point: { x, y }, platform: candidate.platform }; best = distance;
    }
  }
  return chosen ? { point: chosen.point, platformId: chosen.platform.id, kind: anchor.kind } : null;
}
