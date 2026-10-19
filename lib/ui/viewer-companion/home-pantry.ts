import { findPlatformRoute, platformLandingX, type CompanionBrain, type CompanionFood, type Platform } from "./brain";
import { COMPANION_FULL_THRESHOLD } from "./care";
import { MAX_COMPANION_FOOD } from "./food-capacity";
import { rankCompanionItemLandings, type CompanionItemPoint } from "./item-landing";
import type { CompanionPreferences } from "./preferences";

export type CompanionHomeItemPoint = { x: number; y: number; platformId?: string };
type PantryInput = { pantry?: CompanionHomeItemPoint; platforms: readonly Platform[]; visibleFoods: readonly CompanionFood[]; occupied?: readonly CompanionItemPoint[]; allowJump: boolean };
const isRoomFloor = (p: Platform) => !p.bodyOnly && p.kind === "floor" && p.manualOnly === true && /^companion-home-floor(?:-\d+)?$/.test(p.id);

/** A measured room span excludes complete controls at the body tier. Only
 * this deliberate item errand traverses it; other manual tops stay terminal. */
export function findCompanionHomeItemRoute(origin: CompanionHomeItemPoint, target: CompanionHomeItemPoint, platforms: readonly Platform[], allowJump: boolean) {
  const targetFloor = platforms.find(p => p.id === target.platformId);
  if (!targetFloor || targetFloor.bodyOnly || ![target.x, target.y, targetFloor.x, targetFloor.y, targetFloor.width].every(Number.isFinite)
    || targetFloor.width <= 0 || ["control", "hide"].includes(targetFloor.kind) || target.x < targetFloor.x || target.x > targetFloor.x + targetFloor.width || Math.abs(target.y - targetFloor.y) > 2) return null;
  const plane = platforms.find(p => p.id === origin.platformId && p.id === target.platformId);
  if (plane && isRoomFloor(plane) && [plane.x, plane.y, plane.width, plane.x + plane.width].every(Number.isFinite) && plane.width > 0
    && Math.abs(origin.y - plane.y) < 2 && Math.abs(target.y - plane.y) < 2
    && [origin.x, target.x].every(x => Number.isFinite(x) && x >= plane.x && x <= plane.x + plane.width)) {
    return Math.abs(origin.x - target.x) > 1 ? [{ kind: "walk" as const, target: { ...target, platformId: plane.id } }] : [];
  }
  const traversable = platforms.map(p => isRoomFloor(p) ? { ...p, manualOnly: false } : p);
  return findPlatformRoute(origin, target, traversable, allowJump, target.platformId);
}

/** Existing eight food/four toy footprints share one44px packing policy.
 * An inaccessible snack still occupies space, but never becomes a route. */
export function selectCompanionHomePantryPoint(input: PantryInput, from: CompanionHomeItemPoint, food: Pick<CompanionFood, "id">): CompanionHomeItemPoint | undefined {
  const pantry = input.pantry, support = input.platforms.find(p => p.id === pantry?.platformId);
  if (!pantry || !support || !isRoomFloor(support) || ![support.x, support.y, support.width, pantry.x, pantry.y].every(Number.isFinite) || support.width <= 0
    || Math.abs(support.y - pantry.y) > .5 || pantry.x < support.x || pantry.x > support.x + support.width) return;
  const occupied = [...input.visibleFoods.slice(0, MAX_COMPANION_FOOD).filter(item => item.id !== food.id), ...(input.occupied ?? []).slice(0, 4)];
  const left = platformLandingX(support, support.x), right = platformLandingX(support, support.x + support.width);
  if (right < left) return;
  for (const candidate of rankCompanionItemLandings([{ id: support.id, x: left, y: support.y, width: right - left }], pantry.x, occupied)) {
    if (candidate.overlap > 0) continue;
    const point = { x: candidate.x, y: candidate.y, platformId: support.id };
    if (findCompanionHomeItemRoute(from, point, input.platforms, input.allowJump)) return point;
  }
}

/** Re-evaluate the present fullness, taste and actual bin on every delivery.
 * Missing/blocked furniture falls back only to real indoor storage. */
export function selectCompanionHomeFoodDestination(input: PantryInput & { bin?: CompanionHomeItemPoint; brain: CompanionBrain; preferences: CompanionPreferences }, from: CompanionHomeItemPoint, food: Pick<CompanionFood, "id" | "kind">) {
  const favorite = input.brain.life?.favoriteFood === food.kind || input.preferences.learnFromYou !== false && (input.brain.life?.foodScores[food.kind] ?? 0) >= .7;
  const bin = input.bin, support = input.platforms.find(p => p.id === bin?.platformId);
  if (input.brain.hunger < COMPANION_FULL_THRESHOLD && !favorite && bin && support && isRoomFloor(support) && findCompanionHomeItemRoute(from, bin, input.platforms, input.allowJump)) return { destination: bin, discard: true };
  const pantry = selectCompanionHomePantryPoint(input, from, food);
  return pantry ? { destination: pantry, discard: false } : undefined;
}
