import { companionAudiencePlay, companionMayAddressAudience, companionOutsidePlatforms } from "./life-space";
import { findCompanionToyRoute } from "./toys";
import { findPlatformRoute, platformLandingX, type CompanionAction, type CompanionBrain, type CompanionFood, type CompanionPlay, type CompanionWorld, type Platform } from "./brain";
import { COMPANION_TIMING, companionPlayDuration } from "./timing";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import { companionConsumedFoodExperience } from "./food-family";
import { COMPANION_FULL_THRESHOLD } from "./care";
import { withinCompanionFoodReach } from "./food-reach";
import { findCompanionHomeItemRoute, selectCompanionHomeFoodDestination, selectCompanionHomePantryPoint } from "./home-pantry";
import type { CompanionItemPoint } from "./item-landing";
import { kstHour } from "@/lib/calendar/month";
import type { CompanionPreferences } from "./preferences";
import type { CompanionAccessoryId } from "./accessory-catalog";
import type { CompanionFoodKind } from "./snacks";
import type { CompanionRadioMood } from "./radio-reaction";
import type { CompanionSceneSignal } from "./scene-signals";
import { beginCompanionEncounter, normalizeCompanionSceneMemory, preferredCompanionSceneAccessory, type CompanionSceneMemory, type CompanionScenePlace, type CompanionUnfinished } from "./scene-memory";
import { isCompanionInstrumentScoreKey } from "./instrument-score";
import type { CompanionBehaviorId } from "./collection";

export const COMPANION_SCENE_IDS = Object.freeze(Array.from({ length: 36 }, (_, i) => i + 1));
type Point = { x: number; y: number; platformId?: string };
type Quality = "steady" | "uneven" | "unknown";
type Score = { id: string; segment: number };
export type CompanionSceneEffect = { kind: "pick" | "put" | "discard"; foodId: string; point: Point };
export type CompanionSceneAction = CompanionAction & { scene: { id: number; serial: number; beat: number; travel?: true; effect?: CompanionSceneEffect; instrumentQuality?: Quality } };
export type CompanionSceneInput = {
  brain: CompanionBrain; world: CompanionWorld; preferences: CompanionPreferences; now: number;
  knownFoods: readonly CompanionFoodKind[]; owned: readonly CompanionAccessoryId[]; equipped: CompanionAccessoryId | null;
  radio?: { playing: boolean; mood: CompanionRadioMood | null };
  environment?: { season: string; weather: string };
  home?: { x: number; y: number; platformId: string };
  pantry?: Point;
  bin?: Point;
  visibleFoods?: readonly CompanionFood[];
  occupied?: readonly CompanionItemPoint[];
  toyCount?: number;
  carriedFoodId?: string;
  knownBehaviors?: readonly CompanionBehaviorId[];
};
export type CompanionSceneEvent =
  | { kind: "encounter"; wallTime: number }
  | { kind: "petted"; place: CompanionScenePlace; greeting?: CompanionSceneMemory["greeting"]; equipped?: CompanionAccessoryId | null }
  | { kind: "rough" }
  | { kind: "manual-land"; place: CompanionScenePlace; recovered: boolean; point?: Point }
  | { kind: "home-called"; wallTime: number }
  | { kind: "meal"; food: CompanionFoodKind; favoriteChanged: boolean; first: boolean; foodId?: string }
  | { kind: "food-mishap"; food: CompanionFoodKind }
  | { kind: "user-discard"; foodId?: string }
  | { kind: "household"; effect: "put" | "discard" | "spawn" | "scatter"; foodId?: string; from?: Point; to?: Point }
  | { kind: "cleanup-interrupted"; foodId: string; point?: Point; discard?: boolean }
  | { kind: "radio"; mood: CompanionRadioMood; listenedMs?: number }
  | { kind: "instrument"; phrase: number; finished: boolean; quality: Quality; score?: Score; phraseEnd?: boolean; mood?: CompanionRadioMood }
  | { kind: "accessory"; id: CompanionAccessoryId | null }
  | { kind: "rested"; equipped?: CompanionAccessoryId | null; place?: CompanionScenePlace }
  | { kind: "played"; equipped?: CompanionAccessoryId | null }
  | { kind: "month"; empty: boolean }
  | { kind: "layout" }
  | { kind: "premiere-return" }
  | { kind: "signal"; signal: CompanionSceneSignal }
  | { kind: "depart"; wallTime: number; unfinished?: CompanionUnfinished; score?: Score };

type Command = { kind: "look" | "sniff" | "stretch" | "shake"; direction?: -1 | 1; duration?: number }
  | { kind: "play"; play: CompanionPlay; audience?: boolean }
  | { kind: "accessory"; id: CompanionAccessoryId }
  | { kind: "go"; target: "food" | "other" | "home" | "pointer" | "reserved" | "helped" | "preferred" | "cleanup"; foodId?: string }
  | { kind: "pick" | "put" | "discard" | "eat"; foodId: string }
  | { kind: "wait-phrase" | "phrase-response" };
type Cleanup = { foodId: string; point?: Point; discard?: boolean };
type Scene = { id: number; serial: number; beat: number; commands: Command[]; deadline: number; budget: number; foodId?: string; foodKind?: CompanionFoodKind; otherId?: string; failed?: boolean; responded?: boolean; quality?: Quality; resolvedBeat?: number; destination?: Point; cleanup?: Cleanup; goal?: { beat: number; platformId: string; ratio: number }; phrase?: number; score?: Score };
type Offer = { id: number; priority: number; expires: number; foodId?: string; otherId?: string; signal?: CompanionSceneSignal; returning?: boolean; quality?: Quality; cleanup?: Cleanup; phrase?: number; score?: Score };
const placeOf = (input: CompanionSceneInput): CompanionScenePlace => input.world.platformId?.startsWith("companion-home") ? "home" : input.world.platforms.find(p => p.id === input.world.platformId)?.kind === "card" ? "card" : "floor";
const cap = (value: number) => Math.min(12, value + 1);
const ordinary = (p: Platform) => !p.manualOnly && !["control", "hide"].includes(p.kind);
const validPoint = (point: Point | undefined): point is Point => Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
const validScore = (score: Score | undefined): score is Score => Boolean(score && isCompanionInstrumentScoreKey(score.id) && Number.isSafeInteger(score.segment) && score.segment >= 0 && score.segment <= 4096);

/** One scene owns one real intention. The caller supplies the existing active
 * decision clock, proves supports and acknowledges real completion/effects.
 * No timer, RNG draw, DOM read, discovery or audio side effect lives here. */
export function createCompanionScenes(initial: CompanionSceneMemory) {
  let memory = normalizeCompanionSceneMemory(initial), serial = 0, active: Scene | undefined, now = 0;
  const pending: Offer[] = [], cooldowns = new Map<number, number>();
  let greeted = false, manualCleanupAt = -Infinity, interruptedCleanup: Cleanup | undefined, rough = false, lastGreeting: CompanionSceneMemory["greeting"] | undefined;
  let mealSinceMishap = false, lastMealFirst = false, lastMealAt = -Infinity, currentOutfit: CompanionAccessoryId | null = null;
  let reservedFood: { id: string; expires: number } | undefined, lastMonth = "", lastFoods = "", lastScore: Score | undefined, melodyRemembered = false, firstRecall = false;
  let lastHousehold: { effect: "put" | "discard" | "spawn" | "scatter"; foodId?: string } | undefined;
  let helpedLanding: { place: CompanionScenePlace; point?: Point } | undefined, scattered: { foodId: string; from: Point; expires: number } | undefined, spawned: { foodId: string; expires: number } | undefined;
  let manualCleanupFood: string | undefined;
  let returned = false, householdAt = -Infinity, greetingInvitation = true;
  const offer = (id: number, priority = 30, foodId?: string, otherId?: string, signal?: CompanionSceneSignal, detail: Partial<Offer> = {}) => {
    if (!detail.returning && (cooldowns.get(id) ?? -Infinity) > now || pending.some(item => item.id === id) || active?.id === id) return;
    pending.push({ id, priority, expires: now + 20_000, foodId, otherId, signal, ...detail });
    pending.sort((a, b) => b.priority - a.priority); if (pending.length > 8) pending.length = 8;
  };
  const preferenceOutfit = (id: CompanionAccessoryId | null | undefined) => { if (id) memory.outfits[id] = cap(memory.outfits[id] ?? 0); };
  const event = (value: CompanionSceneEvent, at: number, learn = true) => {
    now = Number.isFinite(at) ? Math.max(now, at) : now;
    if (value.kind === "encounter") {
      if (greeted) return; greeted = true;
      const visit = beginCompanionEncounter(memory, value.wallTime);
      if (learn) memory = visit.memory;
      if (learn && visit.fresh) {
        if (visit.gapMinutes >= 4320) offer(1, 100);
        else if (visit.familiar) offer(2, 90);
        else if (visit.early) offer(3, 85);
        if (memory.homeHours[kstHour(value.wallTime)] >= 3) offer(4, 40);
        if (memory.first) { firstRecall = true; offer(30, 10); }
      }
      if (learn) {
        if (memory.unfinished === "performance") offer(5, 80);
        if (memory.unfinished === "hide") offer(6, 80);
        melodyRemembered = memory.unfinished === "melody" && Boolean(memory.melody);
      }
    } else if (value.kind === "petted") {
      if (learn) {
        memory.places[value.place] = cap(memory.places[value.place]); memory.first ??= "touch";
        if (rough || memory.reassurance > 0) memory.reassurance = cap(memory.reassurance);
        const greeting = value.greeting ?? lastGreeting;
        if (greeting) { memory.greetingCount = memory.greeting === greeting ? cap(memory.greetingCount) : 1; memory.greeting = greeting; }
        preferenceOutfit(value.equipped);
      }
      if (rough && memory.reassurance >= 3) offer(8, 70);
      if (memory.places[value.place] >= 3) offer(9, 35);
      if (mealSinceMishap) { offer(15, 65); mealSinceMishap = false; if (learn) memory.mishapFood = undefined; }
      if (active?.id === 10) active.responded = true;
    } else if (value.kind === "rough") { rough = true; if (learn) memory.reassurance = 0; cancel(); }
    else if (value.kind === "manual-land") { if (value.recovered) { helpedLanding = { place: value.place, point: validPoint(value.point) ? { ...value.point } : undefined }; offer(7, 75); } if (learn && memory.places[value.place] >= 3) offer(9, 35); }
    else if (value.kind === "home-called") {
      const hour = kstHour(value.wallTime);
      if (learn && Number.isFinite(hour)) memory.homeHours[hour] = cap(memory.homeHours[hour]);
      cancel();
    } else if (value.kind === "meal") {
      lastMealFirst = value.first; lastMealAt = now; if (learn) memory.first ??= "meal";
      mealSinceMishap = learn && memory.mishapFood === value.food;
      if (value.favoriteChanged) offer(14, 65);
      if (interruptedCleanup) offer(19, 55, interruptedCleanup.foodId, undefined, undefined, { cleanup: { ...interruptedCleanup } });
      if (currentOutfit === "magic-pocket" && value.first) offer(27, 45);
      if (currentOutfit === "party-hat" && value.first) offer(36, 50);
      if (reservedFood?.id === value.foodId) reservedFood = undefined;
    } else if (value.kind === "food-mishap") { if (learn) memory.mishapFood = value.food; }
    else if (value.kind === "user-discard") { manualCleanupAt = now; manualCleanupFood = value.foodId; if (value.foodId && lastHousehold?.foodId && now - householdAt <= 15_000 && value.foodId !== lastHousehold.foodId && (lastHousehold.effect === "discard" || lastHousehold.effect === "put")) offer(18, 60); }
    else if (value.kind === "household") {
      lastHousehold = value; householdAt = now;
      if ((value.effect === "put" || value.effect === "discard") && value.foodId && manualCleanupFood && now - manualCleanupAt <= 15_000 && value.foodId !== manualCleanupFood) offer(18, 60);
      if (value.effect === "scatter" && value.foodId && validPoint(value.from)) scattered = { foodId: value.foodId, from: { ...value.from }, expires: now + 12_000 };
      if (value.effect === "spawn" && value.foodId) spawned = { foodId: value.foodId, expires: now + 20_000 };
    } else if (value.kind === "cleanup-interrupted") {
      if (value.foodId) interruptedCleanup = { foodId: value.foodId, point: validPoint(value.point) ? { ...value.point } : undefined, discard: value.discard };
    } else if (value.kind === "radio") {
      if (learn && (value.listenedMs ?? 0) >= 3000) memory.music[value.mood] = cap(memory.music[value.mood]);
      if (learn && memory.music[value.mood] >= 3) offer(21, 50);
      if (value.listenedMs === undefined) offer(16, 40);
      if (currentOutfit === "party-hat" && value.mood === "lively" && lastMealFirst) offer(36, 60);
    } else if (value.kind === "instrument") {
      if (validScore(value.score)) {
        if (active?.id === 22 && value.phraseEnd && active.score?.id === value.score.id && value.phrase !== active.phrase) { active.responded = true; active.quality = value.quality; }
        if (melodyRemembered && memory.melody?.score === value.score.id && memory.melody.segment === value.score.segment) { melodyRemembered = false; offer(23, 70); }
        if (value.phraseEnd && !value.finished && active?.id !== 22) offer(22, 60, undefined, undefined, undefined, { quality: value.quality, phrase: value.phrase, score: { ...value.score } });
        lastScore = { ...value.score };
        if (value.finished && value.mood === "lively") offer(24, 45);
      }
    } else if (value.kind === "accessory") { currentOutfit = value.id; if (value.id === "detective-hat") offer(25, 30); }
    else if (value.kind === "rested" || value.kind === "played") {
      if (learn) { memory.first ??= value.kind === "rested" ? "rest" : "play"; preferenceOutfit(value.equipped); if (value.kind === "rested" && value.place) memory.places[value.place] = cap(memory.places[value.place]); }
      if (value.kind === "rested" && value.equipped === "propeller-hat") offer(28, 30);
    } else if (value.kind === "month") { offer(31, 55); offer(32, 35); if (value.empty) offer(33, 30); }
    else if (value.kind === "layout") offer(35, 25);
    else if (value.kind === "premiere-return") { returned = true; offer(34, 80); }
    else if (value.kind === "signal") {
      if (value.signal.kind === "memory-inspected") offer(29, 65, undefined, undefined, value.signal);
      else offer(26, 30);
    } else if (value.kind === "depart" && learn) {
      if (Number.isFinite(value.wallTime)) memory.lastMinute = Math.max(memory.lastMinute, Math.floor(value.wallTime / 60_000));
      memory.unfinished = value.unfinished;
      if (value.unfinished === "melody" && validScore(value.score ?? lastScore)) { const score = (value.score ?? lastScore)!; memory.melody = { score: score.id, segment: score.segment }; }
      else memory.melody = undefined;
    }
  };
  function cancel() { if (active) cooldowns.set(active.id, now + 12_000); active = undefined; }
  const play = (kind: CompanionPlay, audience=false): Command => ({ kind: "play", play: kind, ...(audience?{audience:true}:{}) });
  const greeting = (input: CompanionSceneInput) => input.preferences.personality === "sleepy" ? { kind: "stretch" } as Command
    : play(input.preferences.animalMode === "cat" ? "groom" : input.preferences.personality === "mischievous" || input.preferences.personality === "performer" ? "celebrate" : "bow", true);
  const cuddle = (input: CompanionSceneInput): Command => play(input.preferences.personality === "affectionate" || input.preferences.animalMode === "dog" ? "ask-petting" : "bow", true);
  const inspect = (): Command[] => [{ kind: "look" }, { kind: "sniff" }];
  const commandsFor = (offer: Offer, input: CompanionSceneInput): Command[] => {
    const { preferences: p } = input;
    const go = (target: Extract<Command, { kind: "go" }>["target"], foodId?: string): Command => ({ kind: "go", target, foodId });
    const reserve = (id: string): Command[] => [go("food", id), { kind: "pick", foodId: id }, go("reserved", id), { kind: "put", foodId: id }];
    const nearby = input.world.foods?.find(food => food.id === offer.foodId) ?? input.world.foods?.[0];
    switch (offer.id) {
      case 1: return [greeting(input), go("pointer"), cuddle(input)];
      case 2: return [greeting(input), play(memory.greeting === "stretch" ? "ask-petting" : memory.greeting, true), { kind: "look" }];
      case 3: return [{ kind: "stretch" }, { kind: "look" }, greeting(input)];
      case 4: return [{ kind: "look" }, go("home"), play("cozy-nest"), p.sleep && p.personality === "sleepy" ? play("doze-curl") : { kind: "stretch" }];
      case 5: return [{ kind: "look" }, play(p.personality === "mischievous" ? "slip" : "cheer-rehearsal"), { kind: "shake" }, greeting(input)];
      case 6: return [{ kind: "look" }, { kind: "shake" }, greeting(input)];
      case 7: return helpedLanding ? [{ kind: "look" }, { kind: "shake" }, go("helped"), greeting(input)] : [];
      case 8: return [go("pointer"), play(memory.reassurance >= 5 ? "lean-nuzzle" : "ask-petting")];
      case 9: return [go("preferred"), { kind: "look" }, play("cozy-nest")];
      case 10: return [play(memory.greeting === "stretch" ? "ask-petting" : memory.greeting, true), { kind: "look", duration: 900 }, cuddle(input)];
      case 11: return offer.foodId && offer.otherId && input.world.foods?.some(food => food.id === offer.foodId) && input.world.foods.some(food => food.id === offer.otherId) ? [{ kind: "look", direction: -1 }, { kind: "look", direction: 1 }, go("food", offer.foodId), { kind: "sniff" }, { kind: "eat", foodId: offer.foodId }] : [];
      case 12: return offer.foodId ? [go("food", offer.foodId), { kind: "sniff", duration: 260 }, greeting(input)] : [];
      case 13: return offer.returning && offer.foodId ? [{ kind: "look" }, go("food", offer.foodId), { kind: "sniff" }, { kind: "eat", foodId: offer.foodId }] : nearby ? [...reserve(nearby.id), play("pounce")] : [];
      case 14: return [{ kind: "look" }, greeting(input), cuddle(input)];
      case 15: return [{ kind: "look" }, { kind: "shake" }, cuddle(input)];
      case 16: return !input.radio?.playing ? [] : p.personality === "tidy" && nearby ? [...reserve(nearby.id), { kind: "look" }, greeting(input)] : [{ kind: "look" }, greeting(input)];
      case 17: return nearby && input.world.pointer && Math.hypot(input.world.pointer.x - input.world.x, input.world.pointer.y - input.world.y) <= 180 ? [{ kind: "look" }, ...reserve(nearby.id), play("bow")] : [];
      case 18: return [{ kind: "look", direction: -1 }, { kind: "look", direction: 1 }, play("bow")];
      case 19: return offer.cleanup && input.world.foods?.some(food => food.id === offer.cleanup!.foodId) ? [go("food", offer.cleanup.foodId), { kind: "pick", foodId: offer.cleanup.foodId }, go("cleanup"), { kind: offer.cleanup.discard ? "discard" : "put", foodId: offer.cleanup.foodId }, { kind: "look" }] : [];
      case 20: return offer.foodId && input.world.foods?.some(food => food.id === offer.foodId) ? [{ kind: "look" }, go("food", offer.foodId), { kind: "sniff" }, { kind: "look" }] : [];
      case 21: return input.radio?.playing && input.radio.mood && memory.music[input.radio.mood] >= 3 ? [{ kind: "look" }, play(input.radio.mood === "lively" ? "celebrate" : "bow"), { kind: "stretch" }] : [];
      case 22: return [play("bow"), { kind: "wait-phrase" }, { kind: "phrase-response" }];
      case 23: return [{ kind: "look" }, play("bow"), greeting(input)];
      case 24: return [p.jump ? play("pounce") : play("bow"), { kind: "look", duration: 700 }, { kind: "stretch" }];
      case 25: return input.equipped === "detective-hat" && input.owned.includes("detective-hat") && nearby ? [{ kind: "accessory", id: "detective-hat" }, go("food", nearby.id), ...inspect()] : [];
      case 26: {
        const preferred = preferredCompanionSceneAccessory(memory, input.owned);
        // A different owned preference is shown in the fitting portrait by
        // the request/reply bridge, never equipped on the real resident.
        return preferred ? [...(preferred === input.equipped ? [{ kind: "accessory", id: preferred } as Command] : [{ kind: "look" } as Command]), greeting(input)] : [];
      }
      case 27: return input.equipped === "magic-pocket" && input.owned.includes("magic-pocket") && p.rarePrank ? [{ kind: "accessory", id: "magic-pocket" }, { kind: "look" }, play("bow")] : [];
      case 28: return input.equipped === "propeller-hat" && input.owned.includes("propeller-hat") && p.sleep && p.rarePrank ? [{ kind: "accessory", id: "propeller-hat" }, { kind: "stretch" }, play("cozy-nest")] : [];
      case 29: {
        const signal = offer.signal;
        const safe: Partial<Record<string, CompanionPlay>> = { "ask-petting": "ask-petting", "lean-nuzzle": "lean-nuzzle", "paper-knead": "cozy-nest", "paper-nest": "cozy-nest", "cheer-rehearsal": "cheer-rehearsal", groom: "groom", bow: "bow", pounce: "pounce" };
        const recalled = signal?.kind === "memory-inspected" && signal.behavior && input.knownBehaviors?.includes(signal.behavior) ? safe[signal.behavior] : undefined;
        return [recalled ? play(recalled) : { kind: "look" }, { kind: "look" }, play("bow")];
      }
      case 30: return firstRecall ? [memory.first === "touch" ? cuddle(input) : memory.first === "rest" ? { kind: "stretch" } : greeting(input), { kind: "look" }] : [];
      case 31: {
        const environment = input.environment;
        if (!environment) return [];
        const gaze: Command = { kind: "look", direction: input.home && input.home.x < input.world.x ? -1 : 1, duration: 600 };
        const indoor = p.personality === "homebody" || p.personality === "sleepy" ? play("cozy-nest") : p.personality === "mischievous" || p.personality === "performer" ? play(p.jump ? "pounce" : "bow") : p.personality === "affectionate" ? cuddle(input) : p.personality === "tidy" || p.animalMode === "cat" ? play("groom") : { kind: "stretch" } as Command;
        if (["rain", "snow", "fog"].includes(environment.weather)) return [gaze, ...(input.home && (p.personality === "homebody" || p.personality === "sleepy") ? [go("home")] : []), indoor, { kind: "look" }];
        if (environment.weather === "wind") return [gaze, { kind: "look", direction: gaze.direction === 1 ? -1 : 1 }, p.personality === "tidy" ? play("groom") : { kind: "sniff" }];
        if (environment.season === "winter") return [gaze, { kind: "stretch" }, ...(input.home ? [go("home"), play("cozy-nest")] : [play("cozy-nest")])];
        if (environment.season === "spring") return [gaze, { kind: "sniff" }, ...(p.personality === "curious" ? [go("other")] : [{ kind: "look" } as Command]), greeting(input)];
        if (environment.season === "summer") return [{ kind: "stretch" }, gaze, ...(p.personality === "homebody" && input.home ? [go("home")] : []), play("groom")];
        if (environment.season === "autumn") return [gaze, { kind: "shake" }, ...(p.personality === "sleepy" || p.personality === "homebody" ? [{ kind: "sniff" } as Command] : [go("other")]), greeting(input)];
        return [];
      }
      case 32: return [{ kind: "look" }, ...(p.personality === "sleepy" || p.personality === "homebody" ? [] : [go("other")]), greeting(input)];
      case 33: return [{ kind: "stretch" }, p.personality === "affectionate" ? cuddle(input) : go("other"), greeting(input)];
      case 34: return returned ? [{ kind: "look" }, greeting(input), { kind: "stretch" }] : [];
      case 35: return [{ kind: "look" }, { kind: "shake" }, p.personality === "curious" ? go("other") : { kind: "stretch" }];
      case 36: return input.equipped === "party-hat" && input.owned.includes("party-hat") && input.radio?.playing && input.radio.mood === "lively" && lastMealFirst && now - lastMealAt <= 20_000 ? [{ kind: "accessory", id: "party-hat" }, play("bow"), play("celebrate")] : [];
      default: return [];
    }
  };
  const safe = (input: CompanionSceneInput) => {
    const p = input.world.platforms.find(item => item.id === input.world.platformId);
    return input.preferences.enabled && input.preferences.roam && input.world.animated && !input.world.paused && p && !["hide", "control"].includes(p.kind)
      && Math.abs(p.y - input.world.y) <= 2 && input.world.x >= p.x && input.world.x <= p.x + p.width;
  };
  const storageDestination = (input: CompanionSceneInput, current: Scene, from: Point) => {
    if (!current.foodId) return;
    const storage = { pantry: input.pantry, platforms: input.world.platforms, visibleFoods: input.visibleFoods ?? input.world.foods ?? [], occupied: input.occupied, allowJump: input.preferences.jump };
    if (current.id === 19) return current.foodKind && selectCompanionHomeFoodDestination({ ...storage, bin: input.bin, brain: input.brain, preferences: input.preferences }, from, { id: current.foodId, kind: current.foodKind });
    const destination = selectCompanionHomePantryPoint(storage, from, { id: current.foodId });
    return destination ? { destination, discard: false } : undefined;
  };
  const next = (input: CompanionSceneInput): CompanionSceneAction | undefined => {
    if (!Number.isFinite(input.now)) return;
    now = Math.max(now, input.now);
    if (!safe(input)) { cancel(); return; }
    const p = input.preferences, foods = input.world.foods ?? [];
    currentOutfit = input.equipped;
    const hungry = p.feeding && input.brain.hunger >= COMPANION_FULL_THRESHOLD && foods.length > 0;
    // The acknowledged invitation owns its own social finish; the ordinary
    // petting context created by the actual input must not cancel it.
    const responseOwned = active?.id === 10 && active.responded && input.brain.episode?.kind === "social";
    const mealOwned = Boolean(input.brain.foodGoal || input.brain.intention && input.brain.intention.kind !== "explore" || input.brain.episode && input.brain.episode.remaining > 0 && !responseOwned);
    if (mealOwned || active && hungry && ![11, 12, 13, 15, 20, 25].includes(active.id)) {
      if (active?.foodId && [13, 16, 17, 19].includes(active.id) && active.commands.some(command => command.kind === "pick")) interruptedCleanup = { foodId: active.foodId, point: active.destination, discard: active.cleanup?.discard };
      cancel(); return;
    }
    if (input.brain.energy < .12) { cancel(); return; }
    if (input.brain.hunger >= .8 && hungry) { cancel(); return; }
    if (active?.failed || active && (now > active.deadline || active.budget <= 0 || active.beat >= active.commands.length)) {
      if (active && active.beat >= active.commands.length) {
        cooldowns.set(active.id, now + (active.id === 10 ? 50_000 : 90_000));
        if ([5, 6, 23].includes(active.id)) { memory.unfinished = undefined; if (active.id === 23) memory.melody = undefined; }
        if (active.id === 8) rough = false;
        if (active.id === 19) interruptedCleanup = undefined;
      }
      active = undefined;
    }
    if (!active) {
      for (let i = pending.length - 1; i >= 0; i--) if (pending[i].expires < now) pending.splice(i, 1);
      if (reservedFood && (reservedFood.expires < now || !foods.some(food => food.id === reservedFood!.id))) reservedFood = undefined;
      if (hungry && reservedFood) offer(13, 75, reservedFood.id, undefined, undefined, { returning: true });
      if (spawned) {
        if (spawned.expires < now) spawned = undefined;
        else if (foods.some(food => food.id === spawned!.foodId) && input.world.pointer && (input.world.pointer.stableMs ?? 0) >= 500 && Math.hypot(input.world.pointer.x - input.world.x, input.world.pointer.y - input.world.y) <= 180) {
          offer(17, 45, spawned.foodId); spawned = undefined;
        }
      }
      if (scattered) {
        const settled = foods.find(food => food.id === scattered!.foodId);
        if (scattered.expires < now) scattered = undefined;
        else if (settled && Math.hypot(settled.x - scattered.from.x, settled.y - scattered.from.y) >= 52) { offer(20, 60, settled.id); scattered = undefined; }
      }
      const foodKey = foods.map(food => food.id).join("|");
      if (foodKey !== lastFoods) {
        lastFoods = foodKey;
        const favorite = foods.find(food => food.kind === input.brain.life?.favoriteFood), unknown = foods.find(food => !input.knownFoods.includes(food.kind));
        if (favorite && unknown && favorite.id !== unknown.id && input.brain.hunger < .8) { const selected = p.personality === "curious" && input.brain.hunger < .55 ? unknown.id : favorite.id; offer(11, 60, selected, selected === unknown.id ? favorite.id : unknown.id); }
        const related = foods.find(food => !input.knownFoods.includes(food.kind) && companionConsumedFoodExperience(food.kind, input.knownFoods).related > 0);
        if (related) offer(12, 55, related.id);
        if (foods.length && !hungry && input.brain.energy >= .4) offer(13, 20, favorite?.id ?? foods[0].id);
        if (input.equipped === "detective-hat" && unknown) offer(25, 45, unknown.id);
      }
      const seasonKey = input.environment ? input.environment.season + ":" + input.environment.weather : "";
      if (seasonKey && seasonKey !== lastMonth) { if (lastMonth) offer(31, 45); lastMonth = seasonKey; }
      if (greetingInvitation && p.learnFromYou && memory.greetingCount >= 3 && input.world.pointer && (input.world.pointer.stableMs ?? 0) >= 1000) offer(10, 20);
      const learned = new Set([1, 2, 3, 4, 5, 6, 8, 9, 10, 15, 21, 23, 26, 30]);
      const foodScenes = new Set([11, 12, 13, 15, 16, 17, 18, 19, 20, 25, 27, 36]);
      const index = pending.findIndex(item => (p.learnFromYou || !learned.has(item.id)) && (p.feeding || !foodScenes.has(item.id)) && (!hungry || [11, 12, 15, 20, 25].includes(item.id) || item.id === 13 && item.returning) && (input.brain.energy >= getCompanionBehaviorProfile(p).restEnergy || [4, 9, 28, 31].includes(item.id)));
      if (index < 0) return;
      const offered = pending.splice(index, 1)[0], commands = commandsFor(offered, input);
      if (offered.id === 10) greetingInvitation = false;
      if (!commands.length) { cooldowns.set(offered.id, now + 12_000); return next(input); }
      const cleanupFood = commands.find(command => command.kind === "pick");
      const foodId = offered.foodId ?? (cleanupFood && "foodId" in cleanupFood ? cleanupFood.foodId : undefined);
      active = { id: offered.id, serial: ++serial, beat: 0, commands, deadline: now + 25_000, budget: 18, foodId, foodKind: foods.find(food => food.id === foodId)?.kind, otherId: offered.otherId, cleanup: offered.cleanup, quality: offered.quality, phrase: offered.phrase, score: offered.score };
    }
    const current = active, command = current.commands[current.beat], world = input.world;
    if (current.id === 10 && current.beat >= 2 && !current.responded) { current.beat = current.commands.length; return; }
    const here = { x: world.x, y: world.y, platformId: world.platformId };
    const stamp = (action: CompanionAction, effect?: CompanionSceneEffect, travel=false): CompanionSceneAction => ({ ...action, scene: { id: current.id, serial: current.serial, beat: current.beat, ...(travel?{travel:true as const}:{}), ...(effect ? { effect } : {}), ...(current.id === 22 ? { instrumentQuality: current.quality ?? "unknown" } : {}) } });
    if (command.kind === "go") {
      const support = world.platforms.find(item => item.id === world.platformId)!;
      let target: Point = { ...here };
      const food = foods.find(item => item.id === (command.foodId ?? current.foodId));
      if (command.target === "food") { if (!food) { cancel(); return; } target = { x: food.x, y: food.y, platformId: food.platformId }; }
      else if (command.target === "home") { if (!input.home) { current.beat++; return; } target = input.home; }
      else if (command.target === "helped") {
        const point = helpedLanding?.point;
        if (point && point.platformId !== support.id || helpedLanding && helpedLanding.place !== placeOf(input)) { cancel(); return; }
        target = { x: platformLandingX(support, world.x + (world.x <= support.x + support.width / 2 ? 24 : -24)), y: support.y, platformId: support.id };
      } else if (command.target === "cleanup") {
        const destination = storageDestination(input, current, here);
        if (!destination) { cancel(); return; }
        target = destination.destination; current.destination = { ...target };
      } else if (command.target === "preferred" && input.home && memory.places.home >= Math.max(3, memory.places.card, memory.places.floor)) target = input.home;
      else if (command.target === "pointer") {
        if (!world.pointer) { current.beat++; return next(input); }
        target = { x: platformLandingX(support, world.pointer.x), y: support.y, platformId: support.id };
      } else if (command.target === "reserved") {
        const destination = storageDestination(input, current, here);
        if (!destination) { cancel(); return; }
        target = destination.destination; current.destination = { ...target };
      }
      else {
        const preferred = world.platforms.filter(item => ordinary(item) && item.width >= 95 && Math.abs(item.y - world.y) <= 100)
          .sort((a, b) => (memory.places[placeOf({ ...input, world: { ...world, platformId: b.id } })] ?? 0) - (memory.places[placeOf({ ...input, world: { ...world, platformId: a.id } })] ?? 0) || Math.hypot(a.x + a.width / 2 - world.x, a.y - world.y) - Math.hypot(b.x + b.width / 2 - world.x, b.y - world.y));
        const destination = preferred.find(item => item.id !== world.platformId) ?? support;
        target = { x: platformLandingX(destination, destination.x + destination.width * (world.x <= destination.x + destination.width / 2 ? .7 : .3)), y: destination.y, platformId: destination.id };
      }
      // Keep one destination for this beat. Recomputing "44px ahead" or
      // choosing another ledge after arrival creates an endless shuttle.
      // Retain only a relative offset on the live measured plane so resize
      // can move the real destination without preserving stale screen XY.
      if (!["food", "reserved", "cleanup"].includes(command.target)) {
        if (current.goal?.beat === current.beat) {
          const plane = world.platforms.find(item => item.id === current.goal!.platformId);
          if (!plane) { cancel(); return; }
          target = { x: platformLandingX(plane, plane.x + plane.width * current.goal.ratio), y: plane.y, platformId: plane.id };
        } else {
          const plane = world.platforms.find(item => item.id === target.platformId);
          if (!plane || plane.width <= 0) { cancel(); return; }
          current.goal = { beat: current.beat, platformId: plane.id, ratio: Math.max(0, Math.min(1, (target.x - plane.x) / plane.width)) };
        }
      }
      // A picked toy/food can move across its own measured blank floor. This
      // never licenses crossing another manual span or an intervening control.
      const sameManual = support.manualOnly && support.kind === "floor" && target.platformId === support.id;
      const routePlatforms = sameManual ? world.platforms.map(item => item.id === support.id ? { ...item, manualOnly: false } : item) : world.platforms;
      const route = ["reserved", "cleanup"].includes(command.target) ? findCompanionHomeItemRoute(here, target, world.platforms, p.jump)
        : findPlatformRoute(here, target, routePlatforms, p.jump, ["food", "home", "preferred"].includes(command.target) ? target.platformId : undefined);
      if (!route) { cancel(); return; }
      if (!route.length) { current.beat++; return next(input); }
      const step = route[0], profile = getCompanionBehaviorProfile(p, input.brain.habits);
      const action: CompanionAction = { ...step, duration: step.kind === "jump" ? 900 : Math.max(250, Math.abs(step.target.x - world.x) / profile.walkSpeed * 1000), pace: p.animalMode === "dog" || p.personality === "mischievous" ? "scoot" : "amble" };
      // Route completion is checked against current coordinates at the next
      // decision. It never advances an arbitrary stale array of destinations.
      return stamp(action);
    }
    if (command.kind === "pick" || command.kind === "put" || command.kind === "discard") {
      const food = foods.find(item => item.id === command.foodId);
      if (command.kind === "pick" ? !food || input.carriedFoodId || food.platformId !== world.platformId || !withinCompanionFoodReach(Math.hypot(food.x - world.x, food.y - world.y)) : input.carriedFoodId !== command.foodId) { cancel(); return; }
      // Picking never strands an item without a current real home/bin route.
      // Revalidate again before delivery; changed fullness or occupancy sends
      // the existing finite beat back to its proved destination, not a drop.
      const destination = storageDestination(input, current, here);
      if (!destination) { cancel(); return; }
      current.destination = { ...destination.destination };
      if (command.kind !== "pick") {
        const route = findCompanionHomeItemRoute(here, destination.destination, world.platforms, p.jump);
        if (!route) { cancel(); return; }
        if (route.length) { current.beat--; current.goal = undefined; return next(input); }
      }
      return stamp({ kind: "sniff", target: here, duration: 550 }, { kind: command.kind === "pick" ? "pick" : destination.discard ? "discard" : "put", foodId: command.foodId, point: command.kind === "pick" ? here : destination.destination });
    }
    if (command.kind === "eat") {
      const food = foods.find(item => item.id === command.foodId);
      if (!p.feeding || !food || !hungry || input.carriedFoodId || food.platformId !== world.platformId || !withinCompanionFoodReach(Math.hypot(food.x - world.x, food.y - world.y))) { current.beat++; return next(input); }
      return stamp({ kind: "eat", target: here, foodId: food.id, duration: COMPANION_TIMING.eat });
    }
    if (command.kind === "wait-phrase") {
      if (current.responded) { current.beat++; return next(input); }
      return stamp({ kind: "look", target: here, duration: 1700 });
    }
    if (command.kind === "play" || command.kind === "phrase-response") {
      // Scene8 is offered only after actual reassurance petting. A food's
      // satisfaction remains private joy; it is not a volunteer invitation.
      const personalMeal=[14,15,36].includes(current.id) && now-lastMealAt<=20000 && command.kind === "play" && !companionAudiencePlay(command.play);
      if ((command.kind === "phrase-response" || command.kind === "play" && (command.audience || companionAudiencePlay(command.play))) && !personalMeal && !companionMayAddressAudience(world,current.id===8)) {
        const candidates=companionOutsidePlatforms(world,input.brain.visited);
        for(const plane of candidates) {
          const target={x:platformLandingX(plane,plane.x+plane.width/2),y:plane.y,platformId:plane.id};
          const route=findCompanionToyRoute(world,target,world.platforms,p.jump),step=route?.[0];
          if(step) return stamp({...step,duration:step.kind==="jump"?900:Math.max(250,Math.abs(step.target.x-world.x)/getCompanionBehaviorProfile(p).walkSpeed*1000),pace:"amble"},undefined,true);
        }
        cancel(); return;
      }
    }
    if (command.kind === "phrase-response") {
      if (!current.responded) { current.beat++; return next(input); }
      const chosen = p.personality === "sleepy" ? "bow" : current.quality === "steady" ? "celebrate" : p.personality === "affectionate" || p.animalMode === "dog" ? "bow" : current.quality === "uneven" ? "groom" : "bow";
      return stamp({ kind: "play", target: here, play: !p.jump && chosen === "celebrate" ? "bow" : chosen, duration: companionPlayDuration(!p.jump && chosen === "celebrate" ? "bow" : chosen) });
    }
    if (command.kind === "accessory") {
      if (!input.owned.includes(command.id) || input.equipped !== command.id || !p.rarePrank && ["magic-pocket", "propeller-hat"].includes(command.id)) { current.beat++; return next(input); }
      return stamp({ kind: "look", accessory: command.id, target: here, duration: 2400 });
    }
    if (command.kind === "play") {
      if (["doze-curl", "cozy-nest"].includes(command.play) && !p.sleep && command.play === "doze-curl") { current.beat++; return next(input); }
      const chosen = !p.jump && ["pounce", "celebrate"].includes(command.play) ? "bow" : command.play;
      lastGreeting = chosen === "bow" ? "bow" : chosen === "pounce" ? "pounce" : undefined;
      return stamp({ kind: "play", play: chosen, target: here, duration: companionPlayDuration(chosen) });
    }
    if (command.kind === "look" || command.kind === "sniff" || command.kind === "stretch" || command.kind === "shake") {
      return stamp({ kind: command.kind, target: here, direction: command.direction, duration: command.duration ?? (command.kind === "stretch" ? 950 : command.kind === "shake" ? 550 : 340) });
    }
  };
  return {
    next, event, cancel,
    resetMemory() {
      memory = normalizeCompanionSceneMemory(undefined); active = undefined; pending.length = 0; cooldowns.clear();
      rough = mealSinceMishap = firstRecall = melodyRemembered = lastMealFirst = returned = false;
      reservedFood = interruptedCleanup = helpedLanding = scattered = spawned = lastHousehold = undefined;
      lastGreeting = lastScore = undefined; manualCleanupFood = undefined;
      manualCleanupAt = householdAt = lastMealAt = -Infinity; greetingInvitation = true;
    },
    complete(action: CompanionSceneAction) {
      if (!active || action.scene.serial !== active.serial || action.scene.beat !== active.beat) return;
      active.budget--;
      if (action.scene.effect && active.resolvedBeat !== active.beat) { active.failed = true; return; }
      if (!action.scene.travel && active.commands[active.beat]?.kind !== "go") active.beat++;
    },
    resolve(action: CompanionSceneAction, success: boolean) {
      if (!active || active.serial !== action.scene.serial || active.beat !== action.scene.beat) return;
      if (!success) { active.failed = true; return; }
      active.resolvedBeat = active.beat;
      if (action.scene.effect?.kind === "put" && active.id === 13) reservedFood = { id: action.scene.effect.foodId, expires: now + 120_000 };
    },
    checkpoint: () => normalizeCompanionSceneMemory(memory),
    current: () => active ? { id: active.id, serial: active.serial, beat: active.beat } : undefined,
    pending: () => pending.map(item => item.id),
    hasReservedFood: () => reservedFood?.id,
    preferredAccessory: (owned: readonly CompanionAccessoryId[]) => preferredCompanionSceneAccessory(memory, owned),
  };
}
