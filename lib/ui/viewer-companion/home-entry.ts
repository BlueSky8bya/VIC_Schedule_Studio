import { platformLandingX, type Platform } from "./brain";

/** Only current measured body supports may receive a newly mounted resident.
 * One retained draw chooses both the real surface and a safe point on it. */
export function companionInitialHomePoint(platforms: readonly Platform[], landings: readonly Platform[], roll: number) {
  const seen = new Set<string>();
  const homes = [...platforms, ...landings].filter(p => {
    const valid = (p.id === "companion-home" && p.kind === "date" || /^companion-home-floor(?:-\d+)?$/.test(p.id) && p.kind === "floor")
      && [p.x, p.y, p.width, p.x + p.width].every(Number.isFinite) && p.width > 0 && !seen.has(p.id);
    if (valid) seen.add(p.id);
    return valid;
  });
  const total = homes.reduce((sum, p) => sum + p.width, 0);
  if (!homes.length || !Number.isFinite(total)) return null;
  let offset = (Number.isFinite(roll) ? Math.max(0, Math.min(1 - Number.EPSILON, roll)) : .5) * total;
  for (const p of homes) {
    if (offset < p.width) return { x: platformLandingX(p, p.x + offset), y: p.y, platformId: p.id };
    offset -= p.width;
  }
  return null;
}
