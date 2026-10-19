import type { PersonalitySceneInput } from "./personality-director";
import type { PersonalitySceneRecipe, SceneBeat } from "./personality-scene-catalog";
import type { CompanionPersonality } from "./preferences";
import { COMPANION_FULL_THRESHOLD } from "./care";

export type CompanionRoutineKind = "meal" | "wash" | "sleep" | "nap" | "outing" | "music";
export type CompanionRoutineEffect = "ate" | "washed" | "slept" | "went-out" | "played" | "music-started";
export type CompanionRoutineInput = PersonalitySceneInput & {
  /** Existing visible/foreground policy and the native entry completion ACK. */
  active: boolean; entryReady: boolean; owned?: boolean;
  /** Current authored real work/short closure; urgent care may supersede it
   * at this checkpoint. Hard physical/manual owners above remain absolute. */
  authoredReserved?: boolean;
  /** A real existing meal route, or a real usable dispenser. Never raw count. */
  meal?: { foodId?: string; canSupply?: boolean };
  /** A measured outside route may be unavailable in a cramped room. */
  canOuting?: boolean;
};
export type CompanionRoutineRequest = { kind: CompanionRoutineKind; recipe: PersonalitySceneRecipe; itemId?: string; reason: "hunger" | "hygiene" | "energy" | "wake" | "movement" | "music" };

const profiles: Readonly<Record<CompanionPersonality, { washMs: number; outingMs: number; napEnergy: number; sleepMs: number; inspect: boolean }>> = {
  performer: { washMs: 150000, outingMs: 50000, napEnergy: .3, sleepMs: 3000, inspect: false },
  curious: { washMs: 150000, outingMs: 28000, napEnergy: .28, sleepMs: 2800, inspect: true },
  affectionate: { washMs: 140000, outingMs: 42000, napEnergy: .32, sleepMs: 3200, inspect: true },
  sleepy: { washMs: 160000, outingMs: 85000, napEnergy: .52, sleepMs: 5500, inspect: false },
  tidy: { washMs: 75000, outingMs: 55000, napEnergy: .32, sleepMs: 3200, inspect: true },
  mischievous: { washMs: 170000, outingMs: 24000, napEnergy: .28, sleepMs: 2800, inspect: true },
  gourmet: { washMs: 120000, outingMs: 60000, napEnergy: .36, sleepMs: 3800, inspect: true },
  homebody: { washMs: 140000, outingMs: 100000, napEnergy: .38, sleepMs: 4500, inspect: false },
  balanced: { washMs: 130000, outingMs: 45000, napEnergy: .34, sleepMs: 3500, inspect: true },
};
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const homeId = (id?: string) => /^companion-home(?:-floor)?(?:-\d+)?$/.test(id ?? "");
const pose = (name: "bow" | "groom" | "stretch" | "shake"): SceneBeat => ({ kind: "pose", pose: name });

function recipe(kind: CompanionRoutineKind, input: CompanionRoutineInput): PersonalitySceneRecipe {
  const personality = input.preferences.personality, profile = profiles[personality];
  let steps: SceneBeat[];
  if (kind === "meal") steps = [
    ...(!input.meal?.foodId ? [{ kind: "food", mode: "spawn" } as const] : []),
    ...(profile.inspect ? [{ kind: "food", mode: "inspect" } as const] : []),
    { kind: "food", mode: "eat" }, pose(personality === "tidy" ? "groom" : "bow"),
  ];
  else if (kind === "wash") steps = [
    { kind: "go", target: "pad" }, { kind: "wash", ms: personality === "tidy" ? 3000 : personality === "mischievous" ? 1900 : 2400 },
    // The narrow body-only pad is a washing stance, not a stage for the next
    // performance. Finish the actual care, then leave through a proved route
    // before the finite personality gesture. Never fake a floor or wash ACK.
    { kind: "go", target: "floor" },
    pose(personality === "mischievous" ? "shake" : personality === "sleepy" ? "stretch" : "bow"),
  ];
  else if (kind === "sleep" || kind === "nap") steps = [
    { kind: "radio", playing: false, optional: true },
    { kind: "curtain", phase: "closed" }, { kind: "light", lit: false }, { kind: "go", target: "sofa" },
    { kind: "sleep", ms: profile.sleepMs }, pose("stretch"),
  ];
  else if (kind === "music") steps = [
    { kind: "radio", playing: true }, { kind: "go", target: "sofa" }, { kind: "watch", ms: 1800 },
  ];
  else steps = [
    { kind: "curtain", phase: "open", optional: true },
    ...((input.environment?.night ?? false) ? [{ kind: "light", lit: true, optional: true } as const] : []),
    { kind: "go", target: "novel-place" }, pose(personality === "tidy" ? "groom" : "bow"),
  ];
  return { id: `routine-${kind}`, label: { meal: "배고프면 냠냠", wash: "패드에서 씻기", sleep: "불 끄고 잠든 뒤 기지개", nap: "짧은 낮잠과 기지개", outing: "기지개 뒤 바깥 산책", music: "라디오 켜고 소파에서 쉬기" }[kind], personality, major: true, triggers: ["free"], steps };
}

/** Needs select a common routine; personality changes how it is performed.
 * One existing active clock,6 bounded choices and actual effect ACKs only.
 * This is local ephemeral state, not an extra saved preference/care schema. */
export function createCompanionRoutineArbiter() {
  let began: number | undefined, previous = 0, dirt = .2, wakePending = false;
  let pending: { kind: CompanionRoutineKind; at: number } | undefined;
  const completed = new Map<CompanionRoutineEffect, number>(), failedUntil = new Map<CompanionRoutineKind, number>();
  const validAt = (at: number) => Number.isFinite(at) && at >= previous;
  const stamp = (effect: CompanionRoutineEffect) => completed.get(effect) ?? began ?? previous;
  const blocked = (input: CompanionRoutineInput) => !input.active || !input.entryReady || input.owned || input.busy
    || !input.preferences.enabled || !input.preferences.roam || !input.world.animated || input.world.paused
    || Boolean(input.carriedToyId) || !input.world.platformId;
  return {
    next(input: CompanionRoutineInput): CompanionRoutineRequest | undefined {
      if (!validAt(input.now)) return;
      began ??= input.now;
      const delta = clamp(input.now - previous, 0, 5000); previous = input.now;
      if (input.active && input.preferences.enabled && input.world.animated && !input.world.paused) dirt = clamp(dirt + delta / 600000, 0, 1);
      if (blocked(input)) return;
      // A route can be long. An in-progress routine is owned by its existing
      // director, never restarted by this selector on every decision/frame.
      if (pending && input.now - pending.at <= 60000) return;
      if (pending) { failedUntil.set(pending.kind, input.now + 8000); pending = undefined; }
      const { preferences: p, brain, home, environment } = input, profile = profiles[p.personality], at = input.now;
      const urgentHunger = brain.hunger >= .78, exhausted = brain.energy <= .18;
      const candidates: { kind: CompanionRoutineKind; score: number; overdue: number; reason: CompanionRoutineRequest["reason"] }[] = [];
      const add = (kind: CompanionRoutineKind, possible: boolean, score: number, overdue: number, reason: CompanionRoutineRequest["reason"]) => {
        if (input.authoredReserved && !(kind === "meal" && urgentHunger || (kind === "sleep" || kind === "nap") && exhausted)) return;
        if (possible && at >= (failedUntil.get(kind) ?? -Infinity)) candidates.push({ kind, score, overdue, reason });
      };
      const hungry = brain.hunger >= COMPANION_FULL_THRESHOLD;
      const actualFoodId = input.world.foods?.some(food => food.id === input.meal?.foodId) ? input.meal?.foodId : undefined;
      const realMeal = Boolean(p.feeding && (actualFoodId || !input.meal?.foodId && input.meal?.canSupply && home.dispenser));
      const firstTidyPickup = p.personality === "tidy" && !actualFoodId && !urgentHunger && at - (began ?? at) < 8000
        && input.toys.slice(0, 4).some(toy => {
          if (toy.held || toy.carried || toy.hidden || !toy.platformId) return false;
          const point = toy.stance ?? toy, support = input.world.platforms.find(plane => plane.id === point.platformId);
          return Boolean(support && [point.x, point.y].every(Number.isFinite) && Math.abs(point.y - support.y) <= 2
            && point.x >= support.x && point.x <= support.x + support.width);
        });
      const mealRest = p.personality === "gourmet" ? 7000 : 11000;
      // One short first-visit pickup opportunity, not an indefinite mess gate.
      // Existing meals, urgent care and concrete job ownership remain intact.
      add("meal", realMeal && hungry && !firstTidyPickup && (urgentHunger || !completed.has("ate") || at - stamp("ate") >= mealRest),
        urgentHunger ? 3 : .65 + clamp(brain.hunger, 0, 1) * .3, urgentHunger ? 3 : 0, "hunger");
      const pad = home.pad, actualPad = pad && input.world.platforms.find(plane => plane.id === pad.platformId);
      const washAge = (at - stamp("washed")) / profile.washMs;
      add("wash", Boolean(pad?.platformId === "companion-home-floor-400" && actualPad?.bodyOnly && (dirt >= .5 || washAge >= 1)),
        .55 + dirt * .35, Math.min(2, washAge), "hygiene");
      const night = environment?.band === "night" || environment?.band === "evening";
      const maySleep = p.sleep && Boolean(home.sofa)
        && (exhausted || !completed.has("slept") || at - stamp("slept") > 90000);
      add(night ? "sleep" : "nap", maySleep && (exhausted || brain.energy <= (night ? Math.max(.48, profile.napEnergy) : profile.napEnergy)),
        exhausted ? 2.9 : .62 + (1 - clamp(brain.energy, 0, 1)) * .3, exhausted ? 2.9 : 0, "energy");
      const outingAge = (at - stamp("went-out")) / profile.outingMs;
      const outsideExists = input.world.platforms.some(plane => !homeId(plane.id) && !plane.manualOnly && !plane.bodyOnly && !["control", "hide"].includes(plane.kind));
      add("outing", input.canOuting !== false && outsideExists && brain.energy >= .32 && !night
        && (wakePending || (at - (began ?? at) >= 8000 && (!completed.has("went-out") || outingAge >= 1))),
        wakePending ? .98 : .55 + Math.min(.3, outingAge * .2), wakePending ? 2 : Math.min(2, outingAge), wakePending ? "wake" : "movement");
      const radio = home.radio, radioContact = home.contacts?.radio;
      const radioSupport = radio && input.world.platforms.find(plane => plane.id === radio.platformId);
      const actualRadio = Boolean(radio && radioContact && radioSupport && [radio.x, radio.y, radioContact.x, radioContact.y].every(Number.isFinite)
        && Math.abs(radio.y - radioSupport.y) <= 2 && radio.x >= radioSupport.x && radio.x <= radioSupport.x + radioSupport.width);
      const musicRest = p.personality === "homebody" || p.personality === "performer" ? 75000 : 90000;
      // Leisure never competes with an eligible care or movement routine. The
      // cadence starts only after an actual player ON acknowledgement.
      add("music", !candidates.length && actualRadio && Boolean(home.sofa) && p.sound && input.radioAllowed === true && input.radioPlaying === false
        && brain.hunger < COMPANION_FULL_THRESHOLD && brain.energy >= .55 && at - (began ?? at) >= 35000
        && (!completed.has("music-started") || at - stamp("music-started") >= musicRest), .35, 0, "music");
      // Overdue real care eventually outranks optional entertainment. The
      // personality's cadence cannot erase a need with an enormous play weight.
      candidates.sort((a, b) => Number(b.overdue >= 1.5) - Number(a.overdue >= 1.5) || b.score - a.score || b.overdue - a.overdue);
      const chosen = candidates[0]; if (!chosen) return;
      pending = { kind: chosen.kind, at };
      return { kind: chosen.kind, recipe: recipe(chosen.kind, input), reason: chosen.reason, ...(chosen.kind === "meal" && input.meal?.foodId ? { itemId: input.meal.foodId } : {}) };
    },
    /** Call from real eat/wash/sleep/outside completion, never a smiling pose. */
    observe(effect: CompanionRoutineEffect, at: number) {
      if (!Number.isFinite(at) || !["ate", "washed", "slept", "went-out", "played", "music-started"].includes(effect)) return;
      const old = completed.get(effect); if (old !== undefined && at <= old) return;
      completed.set(effect, at);
      if (effect === "ate") dirt = clamp(dirt + .32, 0, 1);
      if (effect === "played") dirt = clamp(dirt + .08, 0, 1);
      if (effect === "washed") dirt = 0;
      if (effect === "slept") wakePending = true;
      if (effect === "went-out") wakePending = false;
      if (pending && ({ meal: "ate", wash: "washed", sleep: "slept", nap: "slept", outing: "went-out", music: "music-started" } as const)[pending.kind] === effect) pending = undefined;
    },
    cancel(at: number) { if (pending && Number.isFinite(at)) failedUntil.set(pending.kind, at + 8000); pending = undefined; },
    current: () => pending?.kind,
  };
}
