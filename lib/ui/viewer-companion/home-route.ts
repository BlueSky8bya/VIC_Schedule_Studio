import { findPlatformRoute, platformLandingX, type CompanionAction, type CompanionBrain, type CompanionWorld, type Platform } from "./brain";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import type { CompanionPreferences } from "./preferences";
import type { CompanionSurface, CompanionTextRect } from "./geometry";

export const isCompanionHomeStep = (id: string) => id.startsWith("companion-home-step-");

/** A finite, visible staircase below the room, only for a return journey.
 * The geometry owner supplies its existing ink/control/viewport safety test.
 * These are never food landing surfaces or ordinary wandering destinations. */
export function createCompanionHomeSteps(
  room: CompanionTextRect, centre: number, floorY: number, size: number,
  safe: (surface: CompanionSurface) => CompanionSurface[],
): Platform[] {
  if (![room.left, room.right, room.top, room.bottom, centre, floorY, size].every(Number.isFinite)
    || size <= 0 || room.right <= room.left || room.bottom <= room.top) return [];
  const steps: Platform[] = [];
  const top = room.bottom + size * .76 + 6;
  // 96px rises stay comfortably inside the existing140px ballistic limit.
  for (let level = 0, y = top; level < 12 && y < floorY - 35; level++, y += 96) {
    const spans = safe({ x: room.left - 60, y, width: room.right - room.left + 120 })
      .sort((a, b) => Math.abs(a.x + a.width / 2 - centre) - Math.abs(b.x + b.width / 2 - centre)).slice(0, 2);
    for (const [index, span] of spans.entries()) {
      const x = Math.max(span.x, Math.min(centre - 24, span.x + span.width - 48));
      steps.push({ id: `companion-home-step-${level}-${index}`, x, y, width: Math.min(48, span.width), kind: "date" });
    }
  }
  return steps;
}

export type CompanionHomePlan = { state: "travel"; action: CompanionAction; steps: Platform[] } | { state: "arrived" | "blocked" | "missing"; steps: Platform[] };

/** Manual recall bypasses random utility, never reach limits. Replan only at
 * action boundaries; walking is split into finite segments for live reflow.
 * Room-floor spans are already measured safe, but stay manual everywhere else. */
export function planCompanionHomeReturn(brain: CompanionBrain, world: CompanionWorld, prefs: CompanionPreferences): CompanionHomePlan {
  if (!prefs.enabled || world.paused) return { state: "blocked", steps: [] };
  const home = world.platforms.find(p => p.id === "companion-home");
  if (!home) return { state: "missing", steps: [] };
  const real = world.platforms.filter(p => !isCompanionHomeStep(p.id)).map(p => /^companion-home-floor(?:-\d+)?$/.test(p.id) ? { ...p, manualOnly: false } : p);
  const target = { x: platformLandingX(home, home.x + home.width / 2), y: home.y, platformId: home.id };
  const ordinary = findPlatformRoute(world, target, real, prefs.jump);
  const candidates = world.platforms.filter(p => isCompanionHomeStep(p.id));
  const essential = real.filter(p => p.id === world.platformId || p.id === home.id || /^companion-home-floor(?:-\d+)?$/.test(p.id));
  const rest = real.filter(p => !essential.includes(p));
  const assisted = ordinary ?? (prefs.jump ? findPlatformRoute(world, target, [...essential, ...rest.slice(0, Math.max(0, 176 - essential.length)), ...candidates], true) : null);
  if (!assisted || assisted.length > 26) return { state: "blocked", steps: [] };
  const used = new Set(assisted.map(step => step.target.platformId));
  if (world.platformId) used.add(world.platformId);
  const steps = candidates.filter(p => used.has(p.id));
  if (!assisted.length) return { state: "arrived", steps: [] };
  const first = assisted[0], profile = getCompanionBehaviorProfile(prefs, brain.habits);
  const point = first.kind === "walk" ? { ...first.target, x: world.x + Math.max(-180, Math.min(180, first.target.x - world.x)) } : first.target;
  return { state: "travel", steps, action: {
    kind: first.kind, target: point, duration: first.kind === "walk" ? Math.max(400, Math.abs(point.x - world.x) / profile.walkSpeed * 850) : 950,
    ...(first.kind === "walk" ? { pace: "amble" as const } : {}), direction: point.x < world.x ? -1 : 1,
  } };
}
