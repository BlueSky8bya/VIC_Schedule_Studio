import type { CompanionPreferences } from "./preferences";

/** Three independent authored axes, not a learned model of an animal. Species
 * supplies habits, personality supplies motivation, gait supplies rhythm.
 * The renderer still proves every route and owns the one world/pose clock. */
export function getCompanionBehaviorProfile(prefs: Pick<CompanionPreferences, "animalMode" | "personality" | "speed">) {
  const cat = prefs.animalMode === "cat", dog = prefs.animalMode === "dog";
  const affectionate = prefs.personality === "affectionate", sleepy = prefs.personality === "sleepy";
  const gait = prefs.speed === "relaxed"
    ? { speed: 45, step: 28, range: 52, pause: 1.4, scoot: .12, hop: 22, activity: .8 }
    : prefs.speed === "lively"
      ? { speed: 100, step: 64, range: 100, pause: .72, scoot: .82, hop: 44, activity: 1.12 }
      : { speed: 70, step: 40, range: 80, pause: 1, scoot: .55, hop: 28, activity: 1 };
  return {
    walkSpeed: gait.speed,
    stepMin: gait.step,
    stepRange: gait.range + (dog ? 20 : 0),
    pauseScale: gait.pause * (sleepy ? 1.4 : 1),
    lookScale: (cat ? .85 : dog ? .8 : 1) * gait.pause,
    walkScale: cat ? 1.25 : dog ? 1 : 1.1,
    scootChance: cat ? 0 : gait.scoot * (sleepy ? .35 : 1),
    hopHeight: gait.hop,
    movementWeight: (cat ? .82 : dog ? 1.12 : 1.25) * (sleepy ? .42 : affectionate ? .85 : 1) * gait.activity,
    lookWeight: cat ? 1.85 : dog ? .85 : 1,
    socialPull: (dog ? 1.25 : cat ? .2 : 0) + (affectionate ? 1.1 : 0),
    pointerGap: (cat ? 75 : dog ? 28 : 44) * (affectionate ? .65 : 1),
    pointerStep: Math.min(180, (cat ? 100 : dog ? 140 : 110) * (prefs.speed === "relaxed" ? .8 : 1)),
    highPlaceWeight: cat ? .85 : .05,
    noveltyWeight: prefs.personality === "curious" ? 2.4 : affectionate ? 1.15 : .85,
    exploreEnergy: sleepy ? .62 : .4,
    exploreCuriosity: sleepy ? .65 : affectionate ? .5 : .35,
    restEnergy: sleepy ? .7 : .4,
    restedEnergy: sleepy ? .86 : .62,
    sleepEnergy: sleepy ? .86 : .62,
    playWeight: (cat ? .5 : dog ? .7 : .32) * (sleepy ? .45 : affectionate ? 1.5 : 1),
    // Cartoon clumsiness belongs mostly to the fictional pompom mascot.
    // These are per-eligible-burst chances, never per-frame probabilities.
    accidentChance: Math.min(.24, (cat ? .015 : dog ? .055 : .18) * (prefs.speed === "lively" ? 1.3 : prefs.speed === "relaxed" ? .5 : 1)),
  };
}
