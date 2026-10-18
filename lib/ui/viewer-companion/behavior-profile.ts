import type { CompanionPreferences } from "./preferences";
import { normalizeCompanionHabits, type CompanionHabits } from "./habits";

/** Three independent authored axes, not a learned model of an animal. Species
 * supplies habits, personality supplies motivation, gait supplies rhythm.
 * The renderer still proves every route and owns the one world/pose clock. */
export function getCompanionBehaviorProfile(prefs: Pick<CompanionPreferences, "animalMode" | "personality" | "speed"> & Partial<Pick<CompanionPreferences, "learnFromYou">>, habits?: CompanionHabits) {
  const cat = prefs.animalMode === "cat", dog = prefs.animalMode === "dog";
  const affectionate = prefs.personality === "affectionate", sleepy = prefs.personality === "sleepy";
  const tidy = prefs.personality === "tidy", mischievous = prefs.personality === "mischievous";
  const gait = prefs.speed === "relaxed"
    ? { speed: 45, step: 28, range: 52, pause: 1.4, scoot: .12, hop: 22, activity: .8 }
    : prefs.speed === "lively"
      ? { speed: 100, step: 64, range: 100, pause: .72, scoot: .82, hop: 44, activity: 1.12 }
      : { speed: 70, step: 40, range: 80, pause: 1, scoot: .55, hop: 28, activity: 1 };
  const base = {
    walkSpeed: gait.speed,
    stepMin: gait.step,
    stepRange: gait.range + (dog ? 20 : 0),
    pauseScale: gait.pause * (sleepy ? 1.4 : 1),
    lookScale: (cat ? .85 : dog ? .8 : 1) * gait.pause,
    walkScale: cat ? 1.25 : dog ? 1 : 1.1,
    scootChance: cat ? 0 : gait.scoot * (sleepy ? .35 : 1),
    hopHeight: gait.hop,
    movementWeight: (cat ? .82 : dog ? 1.12 : 1.25) * (sleepy ? .42 : affectionate ? .85 : mischievous ? 1.35 : 1) * gait.activity,
    lookWeight: cat ? 1.85 : dog ? .85 : 1,
    socialPull: (dog ? 1.25 : cat ? .2 : 0) + (affectionate ? 1.1 : 0),
    pointerGap: (cat ? 75 : dog ? 28 : 44) * (affectionate ? .65 : 1),
    pointerStep: Math.min(180, (cat ? 100 : dog ? 140 : 110) * (prefs.speed === "relaxed" ? .8 : 1)),
    highPlaceWeight: cat ? .85 : .05,
    noveltyWeight: prefs.personality === "curious" ? 2.4 : mischievous ? 2 : affectionate ? 1.15 : tidy ? .7 : .85,
    exploreEnergy: sleepy ? .62 : .4,
    exploreCuriosity: sleepy ? .65 : affectionate ? .5 : .35,
    restEnergy: sleepy ? .7 : .4,
    restedEnergy: sleepy ? .86 : .62,
    sleepEnergy: sleepy ? .86 : .62,
    playWeight: (cat ? .5 : dog ? .7 : .32) * (sleepy ? .45 : affectionate ? 1.5 : mischievous ? 2.4 : tidy ? .65 : 1),
    tidyWeight: tidy ? 1 : sleepy ? .18 : .08,
    mischiefWeight: mischievous ? 1 : prefs.animalMode === "default" && prefs.personality === "curious" ? .24 : .06,
    // Cartoon clumsiness belongs mostly to the fictional pompom mascot.
    // These are per-eligible-burst chances, never per-frame probabilities.
    accidentChance: Math.min(.24, (cat ? .015 : dog ? .055 : .18) * (tidy ? .4 : mischievous ? 1.3 : 1) * (prefs.speed === "lively" ? 1.3 : prefs.speed === "relaxed" ? .5 : 1)),
  };
  if (prefs.learnFromYou === false || !habits) return base;
  const { sociability, playfulness, confidence } = normalizeCompanionHabits(habits);
  if (!sociability && !playfulness && !confidence) return base;
  const bound = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
  const social = sociability * .9 + confidence * .2;
  // A neutral mascot can acquire a modest social interest. Already-social
  // species/personalities retain their larger baseline and bounded25% shift.
  // Chosen gait speed, species habits, fatigue thresholds and permission
  // switches stay authoritative; experience changes motivation, not abilities.
  return {
    ...base,
    socialPull: bound(base.socialPull + social * (base.socialPull > .5 ? base.socialPull * .25 : 1), 0, 3),
    pointerGap: base.pointerGap * bound(1 - sociability * .18 - confidence * .08, .74, 1.26),
    pointerStep: Math.min(180, base.pointerStep * bound(1 + confidence * .15 + sociability * .1, .75, 1.25)),
    movementWeight: base.movementWeight * bound(1 + playfulness * .2 + confidence * .1, .7, 1.3),
    playWeight: base.playWeight * bound(1 + playfulness * .25 + sociability * .1, .65, 1.35),
    noveltyWeight: base.noveltyWeight * bound(1 + confidence * .2 + playfulness * .1, .7, 1.3),
    lookWeight: base.lookWeight * bound(1 - confidence * .2 - playfulness * .1, .7, 1.3),
    lookScale: base.lookScale * (1 - confidence * .15),
    pauseScale: base.pauseScale * bound(1 - playfulness * .15 - confidence * .05, .8, 1.2),
    scootChance: bound(base.scootChance * (1 + playfulness * .2), 0, .98),
    tidyWeight: bound(base.tidyWeight * (1 - playfulness * .2 + confidence * .08), 0, 1.2),
    mischiefWeight: bound(base.mischiefWeight * (1 + playfulness * .35 + confidence * .15), 0, 1.5),
  };
}

/** Exact qualitative differences displayed by the shared learned-effects UI. */
export function getCompanionLearnedEffectDirections(prefs: Parameters<typeof getCompanionBehaviorProfile>[0], habits?: CompanionHabits) {
  const base = getCompanionBehaviorProfile({ ...prefs, learnFromYou: false });
  const learned = getCompanionBehaviorProfile({ ...prefs, learnFromYou: true }, habits);
  const direction = (difference: number, threshold: number): -1 | 0 | 1 => Math.abs(difference) <= threshold ? 0 : difference < 0 ? -1 : 1;
  return { pointerGap: direction(learned.pointerGap - base.pointerGap, .01), playWeight: direction(learned.playWeight - base.playWeight, .001), lookScale: direction(learned.lookScale - base.lookScale, .001) };
}
