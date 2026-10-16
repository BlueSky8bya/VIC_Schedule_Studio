import type { CompanionPlay } from "./brain";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import type { CompanionPreferences } from "./preferences";

export type CompanionArrivalPlayInput = {
  kind: "walk" | "jump";
  pace?: "amble" | "scoot";
  distanceCSS: number;
  /** Normal completed locomotion only: never a held drop, food route, home
   * transfer, paused scene, editing gesture or interrupted/recovered action. */
  natural: boolean;
  ordinaryCard: boolean;
  width: number;
  /** Horizontal distance from the arrived feet to the nearest physical edge. */
  edgeClearance: number;
  energy: number;
  cooldownReady: boolean;
  stable: boolean;
};

/** One draw after one proved arrival, never from the frame sampler. The caller
 * owns contact geometry and normal action completion; this pure policy chooses
 * only the creature's finite response. cardPrank gates the separate card tilt. */
export function getCompanionArrivalPlay(input: CompanionArrivalPlayInput, preferences: CompanionPreferences, rng: () => number = Math.random): CompanionPlay | null {
  if (!preferences.enabled || !preferences.roam || !input.natural || !input.ordinaryCard || !input.stable || !input.cooldownReady
    || ![input.distanceCSS, input.width, input.edgeClearance, input.energy].every(Number.isFinite)
    || input.distanceCSS < 0 || input.width < (input.kind === "jump" ? 1 : 64) || input.edgeClearance < 0 || input.energy < .28
    || input.kind === "walk" && (input.pace !== "scoot" || input.distanceCSS < 48)
    || input.kind === "jump" && !preferences.jump) return null;
  const chance = getCompanionBehaviorProfile(preferences).accidentChance;
  const draw = rng();
  if (!Number.isFinite(draw) || draw < 0 || draw >= chance) return null;
  if (input.kind === "jump") return "slip";
  return input.edgeClearance <= 24 || !preferences.jump ? "bump" : "tumble";
}
