import type { Platform } from "./brain";

export const VISIBILITY_RECOVERY_DELAY_MS = 1200;
export const VISIBILITY_RECOVERY_COOLDOWN_MS = 30000;
type Reason = "bounds" | "support" | "vertical" | null;
type Observation = Readonly<{ now: number; reason: Reason; eligible: boolean; hasFreshGeometry: boolean; hasSafeFloor?: boolean }>;

/** One finite validation per missing episode. This policy owns no timer,
 * coordinates or DOM; only a fresh measured delivery may grant one landing.
 * Normal/owned states revoke the episode but never the recovery cooldown. */
export function createCompanionVisibilityRecovery({ delayMs = VISIBILITY_RECOVERY_DELAY_MS }: { delayMs?: number } = {}) {
  const delay = Number.isFinite(delayMs) && delayMs >= VISIBILITY_RECOVERY_DELAY_MS ? delayMs : VISIBILITY_RECOVERY_DELAY_MS;
  let since: number | undefined, attempted = false, unavailable = false, lastRecovery = -Infinity;
  return {
    observe(input: Observation): "arm" | "cancel" | "recover" | "unavailable" | "none" {
      if (!Number.isFinite(input.now) || !input.eligible || !input.reason) {
        const pending = since !== undefined;
        since = undefined; attempted = unavailable = false;
        return pending ? "cancel" : "none";
      }
      if (since === undefined || input.now < since) { since = input.now; attempted = unavailable = false; return "arm"; }
      if (attempted || !input.hasFreshGeometry || input.now - since < delay) return "none";
      if (!input.hasSafeFloor || input.now - lastRecovery < VISIBILITY_RECOVERY_COOLDOWN_MS) {
        if (unavailable) return "none";
        unavailable = true; return "unavailable";
      }
      attempted = true; lastRecovery = input.now;
      return "recover";
    },
    reset() { since = undefined; attempted = unavailable = false; },
  };
}

/** Escalation can use only an existing safe viewport-floor fragment. No
 * date/card/control/home destination and no fabricated floor. Geometry has
 * already subtracted obstacles; retain its actual centre-safe x interval. */
export function recoverCompanionVisibilityFloor(
  context: Readonly<{ point: Readonly<{ x: number; y: number }>; viewport: Readonly<{ width: number; height: number }>; size: number }>,
  platforms: readonly Platform[],
): { platformId: string; x: number; y: number } | undefined {
  const { point, viewport, size } = context;
  if (![point.x, point.y, viewport.width, viewport.height, size].every(Number.isFinite) || size <= 0 || viewport.width < size + 8 || viewport.height < size + 20) return;
  const choices = platforms.filter(p => p.kind === "floor" && /^viewport-floor(?:-\d+)?$/.test(p.id) && !p.manualOnly && !p.bodyOnly
    && [p.x, p.y, p.width].every(Number.isFinite) && p.width > 0
    && p.x >= size / 2 + 4 && p.x + p.width <= viewport.width - size / 2 - 4
    && p.y >= size + 8 && p.y <= viewport.height - 12)
    .map(p => ({ platformId: p.id, x: Math.min(p.x + p.width, Math.max(p.x, point.x)), y: p.y }))
    .sort((a, b) => Math.hypot(a.x - point.x, a.y - point.y) - Math.hypot(b.x - point.x, b.y - point.y));
  return choices[0];
}
