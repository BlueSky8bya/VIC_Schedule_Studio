/** Every companion sound, one per situation a listener can tell apart.
 *
 * Owner 2026-11-20: each sound can be switched off by itself (a streamer asked
 * for the jump-landing thud alone). A sound shared by different situations was
 * split so a switch never silences something the listener did not mean:
 * landing = the companion's own jump only (food dropping and a hat settling
 * have their own), play = toys and play only (a trick or a reunion, and the
 * scattering prank, have their own).
 *
 * Kept apart from companion-sound.ts so the preference record can name the
 * sounds without importing the sound engine. */
export const COMPANION_SOUND_MOMENTS = ["feed", "land", "food-land", "hat-land", "eat", "pet", "lift", "dizzy", "tumble", "sleep", "play", "trick", "scatter", "discover", "gift", "equip", "unequip", "cushion"] as const;
export type CompanionSoundMoment = typeof COMPANION_SOUND_MOMENTS[number];

export function isCompanionSoundMoment(value: unknown): value is CompanionSoundMoment {
  return COMPANION_SOUND_MOMENTS.some(moment => moment === value);
}

/** A stored list of switched-off sounds, made safe: known names only, each
 * once, in the fixed order above (so equal choices serialize equally). */
export function normalizeCompanionSoundMuted(value: unknown): CompanionSoundMoment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return COMPANION_SOUND_MOMENTS.filter(moment => value.includes(moment));
}
