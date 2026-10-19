import { findPlatformRoute, platformLandingX, type CompanionAction, type CompanionBrain, type CompanionPlay, type CompanionWorld } from "./brain";
import { findCompanionPointerRoute } from "./reactive-cues";
import { findCompanionToyRoute, type CompanionToy } from "./toys";
import { companionPlayDuration } from "./timing";
import { COMPANION_FULL_THRESHOLD } from "./care";
import { COMPANION_FOOD_CATEGORY } from "./snacks";
import type { CompanionToyKind } from "./toy-catalog";
import type { CompanionPreferences } from "./preferences";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import type { CompanionHomeEnvironment } from "./home-environment";
import type { CompanionHomeTvState } from "./home-room-media";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe, type SceneBeat, type SceneTrigger } from "./personality-scene-catalog";

type Point = { x: number; y: number; platformId?: string };
export type PersonalityHome = Partial<Record<"sofa" | "floor" | "window" | "pad" | "box" | "dispenser" | "tv" | "light" | "curtain", Point>>;
export type PersonalitySceneInput = {
  world: CompanionWorld; brain: CompanionBrain; preferences: CompanionPreferences; now: number;
  home: PersonalityHome; toys: readonly CompanionToy[]; tv: CompanionHomeTvState;
  environment?: CompanionHomeEnvironment; favoriteFood?: string | null; learnedSocial?: boolean;
  busy?: boolean; canTv?: boolean; equipped?: boolean; hasExperience?: boolean;
  yieldedItem?: boolean; yieldedItemId?: string; storedFoodIds?: readonly string[]; favoriteToy?: string | null;
  toyPlayCounts?: Partial<Record<CompanionToyKind, number>>; toyCount?: number; curtainPhase?: "open" | "shade" | "closed"; lightLit?: boolean; familiarHour?: boolean; learnedMorning?: boolean; carriedToyId?: string; deferredToyId?: string; interruptedItemId?: string;
};
export type PersonalitySceneBeat = { id: string; serial: number; beat: number; command: SceneBeat; itemId?: string; travel?: true };
export type PersonalitySceneAction = CompanionAction & { personalityScene: PersonalitySceneBeat; personalitySignature: CompanionPreferences["personality"] };
export type PersonalitySceneProposal = { meta: PersonalitySceneBeat; action?: PersonalitySceneAction; delegate?: Extract<SceneBeat, { kind: "toy" | "food" }> };
const entry: Readonly<Record<CompanionPreferences["personality"], readonly CompanionPlay[]>> = {
  performer: ["cheer-rehearsal", "bow", "celebrate"], curious: ["bow", "pounce", "groom"], affectionate: ["ask-petting", "lean-nuzzle", "bow"],
  sleepy: ["cozy-nest", "doze-curl", "groom"], tidy: ["groom", "bow", "cozy-nest"],
  mischievous: ["pounce", "tumble", "celebrate"], gourmet: ["bow", "groom", "celebrate"], homebody: ["cozy-nest", "lean-nuzzle", "groom"], balanced: ["bow", "celebrate", "groom", "ask-petting"],
};
const safe = (point: Point | undefined): point is Point => Boolean(point && [point.x, point.y].every(Number.isFinite));
const atHome = (id?: string) => /^companion-home(?:-floor)?(?:-\d+)?$/.test(id ?? "");

/** One finite intention on the existing world clock. No DOM, timer, storage,
 * audio, learning, analytics or speculative object mutation happens here. */
export function createCompanionPersonalityDirector(recipes: readonly PersonalitySceneRecipe[] = COMPANION_PERSONALITY_SCENES) {
  let serial = 0, selected: CompanionPreferences["personality"] | undefined, first = true, cursor = 0;
  let active: { recipe: PersonalitySceneRecipe; serial: number; beat: number; started: number; progressed: number; attempts: number; itemId?: string; lastX: number; lastY: number; count: number; goal?: { beat: number; id: string; fraction?: number } } | undefined;
  let previousPlay: string | undefined, lastCompleted = "", lastPerformance = -Infinity;
  const events = new Map<SceneTrigger, number>(), completed: string[] = [], failures = new Map<string, number>();
  const purposes: string[] = [];
  let attention: Point | undefined, lastToyKind: CompanionToyKind | undefined;
  const heldBack = new Map<SceneTrigger, number>();
  let now = 0;
  const finish = (success: boolean) => {
    if (active) {
      if (success) {
        lastCompleted = active.recipe.id; completed.push(lastCompleted); if (completed.length > 12) completed.shift();
        const work = active.recipe.steps.find(step => ["toy", "food", "tv", "wash", "sleep", "hide"].includes(step.kind));
        const purpose = work ? work.kind === "toy" ? `${work.kind}:${work.mode}` : work.kind === "food" ? `${work.kind}:${work.mode}` : work.kind : active.recipe.personality === "affectionate" ? "social" : "expression";
        purposes.push(purpose); if (purposes.length > 4) purposes.shift();
        if (active.recipe.personality === "performer") lastPerformance = now;
      }
      else failures.set(active.recipe.id, now + 8000);
      for (const trigger of active.recipe.triggers) if (events.has(trigger)) heldBack.set(trigger, events.get(trigger)!);
    }
    active = undefined;
  };
  const advance = () => { if (!active) return; active.beat++; active.progressed = now; active.attempts = active.count = 0; if (active.beat >= active.recipe.steps.length) finish(true); };
  const trigger = (key: SceneTrigger, input: PersonalitySceneInput) => {
    const { preferences: p, world, home, environment } = input;
    switch (key) {
      case "free": return true;
      case "toy": return input.toys.some(toy => !toy.held && !toy.carried && !toy.hidden && toy.platformId);
      case "food": return p.feeding && Boolean(world.foods?.length);
      case "tv": return Boolean(home.tv && (input.tv !== "off" || input.canTv));
      case "rain": return environment?.weather === "rain";
      case "summer": return environment?.season === "summer" && (environment.sunlight ?? 0) >= 2;
      case "night": return Boolean(environment?.night || ["night", "evening"].includes(environment?.band ?? ""));
      case "experience": return Boolean(input.yieldedItem || input.storedFoodIds?.length || p.learnFromYou && (input.hasExperience || input.learnedSocial));
      case "outfit": return Boolean(input.equipped) && (events.get(key) ?? -Infinity) > now - 15000;
      case "pet": return p.petting && (events.get(key) ?? -Infinity) > now - 12000 && (events.get(key) ?? -Infinity) > (heldBack.get(key) ?? -Infinity);
      case "music": return (events.get(key) ?? -Infinity) > now - 9000 && (events.get(key) ?? -Infinity) > (heldBack.get(key) ?? -Infinity);
      default: return (events.get(key) ?? -Infinity) > now - 15000 && (events.get(key) ?? -Infinity) > (heldBack.get(key) ?? -Infinity);
    }
  };
  const freshFamiliarFood = (input: PersonalitySceneInput) => input.preferences.learnFromYou ? input.world.foods?.find(food =>
    !input.brain.life?.tastedFoods.includes(food.kind) && input.brain.life?.tastedFoods.some(known => COMPANION_FOOD_CATEGORY[known] === COMPANION_FOOD_CATEGORY[food.kind])) : undefined;
  const available = (recipe: PersonalitySceneRecipe, input: PersonalitySceneInput) => {
    if ((failures.get(recipe.id) ?? -Infinity) > now || !recipe.triggers.every(key => trigger(key, input))) return false;
    const { world: w, brain: b, preferences: p, home } = input, id = recipe.id;
    if (id === "C01" && !input.toys.some(toy => !(input.toyPlayCounts?.[toy.kind] ?? 0))) return false;
    if (id === "C02" && !w.foods?.some(food => !b.life?.tastedFoods.includes(food.kind))) return false;
    if (id === "G04" && !freshFamiliarFood(input)) return false;
    if (id === "P05" && now - lastPerformance > 15000) return false;
    if (id === "T04" && (!input.yieldedItem || !input.yieldedItemId)) return false;
    if (id === "B10" && (!p.learnFromYou || !input.learnedSocial)) return false;
    if (id === "G03" && (!w.foods?.some(food => input.storedFoodIds?.includes(food.id)) || b.hunger < COMPANION_FULL_THRESHOLD)) return false;
    if (id === "H02" && !input.toys.some(toy => toy.kind === input.favoriteToy && !atHome(toy.platformId))) return false;
    if (["A01", "A03", "A05", "A07", "A08", "A11", "B07", "B10", "X-A-house", "X-A-editor"].includes(id) && (!p.petting || !w.pointer || (w.pointer.stableMs ?? 0) < 200)) return false;
    if (id === "A12" && p.petting || ["S04", "X-S-house", "X-S-return-time"].includes(id) && (!p.sleep || b.energy > .65)) return false;
    if (["T02", "T03", "G02", "H08"].includes(id) && b.hunger >= COMPANION_FULL_THRESHOLD) return false;
    if (["T02", "G02", "H08"].includes(id) && !w.foods?.some(food => food.kind === input.favoriteFood)) return false;
    if (id === "T03" && !w.foods?.some(food => food.kind !== input.favoriteFood)) return false;
    if (["C09", "G04", "B03", "B09"].includes(id) && (id.startsWith("G") || id === "B03" ? (w.foods?.length ?? 0) < 2 : input.toys.length < 2)) return false;
    if (id === "B02" && (purposes.length < 2 || purposes.at(-1) !== purposes.at(-2))) return false;
    if (id === "M05" && b.energy > .7 || id === "H03" && !trigger("summer", input)) return false;
    if (["X-P-house", "A11", "X-A-house", "M05", "X-M-house", "X-B-house"].includes(id) && input.tv === "off") return false;
    if (id === "X-P-house" && input.tv !== "music") return false;
    if (id === "X-M-return-time" && !trigger("night", input)) return false;
    if (id === "P12" && (input.tv === "off" || !input.lightLit)) return false;
    if (id === "G01" && (!input.favoriteFood || !w.foods?.some(food => food.kind === input.favoriteFood) || b.hunger < COMPANION_FULL_THRESHOLD)) return false;
    if (["B11", "X-B-return-time"].includes(id) && input.environment?.season !== "autumn") return false;
    if (id === "X-C-return-time" && (input.environment?.season !== "spring" || input.environment.band !== "dawn")) return false;
    if (id === "X-S-return-time" && (input.environment?.season !== "winter" || !input.environment.night)) return false;
    if (["G10", "X-G-return-time"].includes(id) && (input.environment?.band !== "morning" || b.hunger < COMPANION_FULL_THRESHOLD)) return false;
    if (id === "G10" && (!p.learnFromYou || !input.learnedMorning)) return false;
    if (id === "X-P-return-time" && (input.environment?.band !== "evening" || !p.learnFromYou || !input.familiarHour)) return false;
    if (id === "T09" && !input.deferredToyId) return false;
    if (["T10", "B05"].includes(id) && !input.interruptedItemId) return false;
    if (["T05", "X-T-house"].includes(id) && ((input.toyCount ?? input.toys.length) || input.carriedToyId)) return false;
    if (id === "T06" && !w.foods?.some((food, i, foods) => foods.some((other, j) => i !== j && food.platformId === other.platformId && Math.hypot(food.x - other.x, food.y - other.y) < 36))) return false;
    if (recipe.steps.some(step => step.kind === "hide") && (!p.ambientPrank || !w.hideAvailable)) return false;
    if (recipe.steps.some(step => step.kind === "wash") && !home.pad) return false;
    let mayCreateToy = false;
    for (const step of recipe.steps) {
      if (step.kind === "toy" && step.mode === "spawn") mayCreateToy = true;
      if (step.kind === "toy" && step.kinds?.length && !step.optional && !mayCreateToy && !input.toys.some(toy => !toy.held && !toy.carried && !toy.hidden && step.kinds!.includes(toy.kind))) return false;
    }
    return true;
  };
  const meta = (command: SceneBeat): PersonalitySceneBeat => ({ id: active!.recipe.id, serial: active!.serial, beat: active!.beat, command, ...(active!.itemId ? { itemId: active!.itemId } : {}) });
  const action = (command: SceneBeat, value: CompanionAction, input: PersonalitySceneInput): PersonalitySceneProposal => ({ meta: meta(command), action: { ...value, personalityScene: meta(command), personalitySignature: input.preferences.personality } });
  const targetFor = (target: Extract<SceneBeat, { kind: "go" }>["target"], input: PersonalitySceneInput): Point | undefined => {
    const { world, home } = input;
    if (target === "toy") {
      const kinds = active?.recipe.steps.find(step => step.kind === "toy" && step.kinds)?.kind === "toy" ? (active.recipe.steps.find(step => step.kind === "toy" && step.kinds) as Extract<SceneBeat, { kind: "toy" }>).kinds : undefined;
      const preferred = active?.recipe.id === "H02" ? input.favoriteToy : undefined;
      const toys = input.toys.filter(toy => (!preferred || toy.kind === preferred) && !toy.held && !toy.carried && !toy.hidden && toy.platformId && (!kinds?.length || kinds.includes(toy.kind)));
      const novelty = active && ["C01", "C09", "B09"].includes(active.recipe.id);
      const toy = active?.itemId ? toys.find(item => item.id === active!.itemId) : toys.sort((a, b) =>
        (novelty ? ((input.toyPlayCounts?.[a.kind] ?? 0) - (input.toyPlayCounts?.[b.kind] ?? 0)) * 10000 + Number(a.kind === lastToyKind) * 1000 - Number(b.kind === lastToyKind) * 1000 : 0)
        + Math.hypot(a.x - world.x, a.y - world.y) - Math.hypot(b.x - world.x, b.y - world.y))[0];
      if (toy) lastToyKind = toy.kind;
      if (toy && active) active.itemId = toy.id;
      return toy?.stance ?? toy;
    }
    if (target === "food") {
      const foods = world.foods ?? [], favoriteOnly = active && ["G01", "T02", "G02", "H08"].includes(active.recipe.id), discardOnly = active?.recipe.id === "T03";
      const fresh = active?.recipe.id === "G04" ? freshFamiliarFood(input) : undefined;
      const eligible = foods.filter(food => (active?.recipe.id !== "G04" || food.id === fresh?.id) && (active?.recipe.id !== "C02" || !input.brain.life?.tastedFoods.includes(food.kind)) && (active?.recipe.id !== "T06" || foods.some(other => other.id !== food.id && other.platformId === food.platformId && Math.hypot(other.x-food.x,other.y-food.y) < 36)) && (!favoriteOnly || food.kind === input.favoriteFood) && (!discardOnly || food.kind !== input.favoriteFood) && (active?.recipe.id !== "G03" || input.storedFoodIds?.includes(food.id)));
      if (active?.recipe.id === "B03") eligible.sort((a,b) => {
        const dist = Math.hypot(a.x-world.x,a.y-world.y) - Math.hypot(b.x-world.x,b.y-world.y);
        if (input.brain.hunger >= .65 || !input.preferences.learnFromYou) return dist;
        return (Number(Boolean(input.brain.life?.tastedFoods.includes(a.kind))) - Number(Boolean(input.brain.life?.tastedFoods.includes(b.kind)))) * 10000 + dist;
      });
      const food = active?.itemId ? eligible.find(food => food.id === active!.itemId) : eligible[0]; if (food && active) active.itemId = food.id; return food;
    }
    if (target === "toy-other-side") {
      if (!active) return;
      if (active.goal?.beat === active.beat && active.goal.fraction !== undefined) {
        const plane = world.platforms.find(p => p.id === active!.goal!.id);
        return plane && { x: plane.x + plane.width * active.goal.fraction, y: plane.y, platformId: plane.id };
      }
      if (!active.itemId) targetFor("toy", input);
      const toy = input.toys.find(item => item.id === active!.itemId);
      if (!toy || toy.held || toy.carried || toy.hidden) return;
      const y = toy.stance?.y ?? toy.y, wanted = toy.x + (world.x <= toy.x ? 32 : -32);
      const plane = world.platforms.find(p => p.kind === "floor" && !p.bodyOnly && Math.abs(p.y-y) < 2 && wanted >= p.x && wanted <= p.x+p.width);
      if (!plane) return;
      const x = platformLandingX(plane,wanted);
      active.goal = { beat:active.beat,id:plane.id,fraction:(x-plane.x)/plane.width };
      return { x,y:plane.y,platformId:plane.id };
    }
    if (target === "pointer") return findCompanionPointerRoute(world, input.preferences, input.preferences.personality === "affectionate" ? 24 : 50)?.target;
    if (target === "novel-place") {
      if (active && active.goal?.beat === active.beat) {
        const platform = world.platforms.find(p => p.id === active!.goal!.id);
        return platform && { x: platformLandingX(platform, platform.x + platform.width / 2), y: platform.y, platformId: platform.id };
      }
      const point = world.platforms.filter(p => !p.manualOnly && !["control", "hide"].includes(p.kind) && p.id !== world.platformId)
        .sort((a, b) => Number(input.brain.visited.includes(a.id)) - Number(input.brain.visited.includes(b.id)) || Math.hypot(a.x - world.x, a.y - world.y) - Math.hypot(b.x - world.x, b.y - world.y))
        .map(p => ({ x: platformLandingX(p, p.x + p.width / 2), y: p.y, platformId: p.id })).find(point => findPlatformRoute(world, point, world.platforms, input.preferences.jump, point.platformId));
      if (point && active) active.goal = { beat: active.beat, id: point.platformId };
      return point;
    }
    if (target === "floor" && !home.floor) {
      const floor = world.platforms.find(p => p.id === world.platformId && p.kind === "floor") ?? world.platforms.find(p => p.kind === "floor" && !p.manualOnly);
      return floor && { x: platformLandingX(floor, world.x + 55), y: floor.y, platformId: floor.id };
    }
    return home[target];
  };
  const go = (point: Point, command: SceneBeat, input: PersonalitySceneInput): PersonalitySceneProposal | undefined => {
    const route = findCompanionToyRoute(input.world, point, input.world.platforms, input.preferences.jump);
    if (!route) return;
    const step = route[0];
    if (!step) return;
    const speed = input.preferences.speed === "relaxed" ? 65 : input.preferences.speed === "lively" ? 135 : 100;
    const offered = action(command, { ...step, pace: input.preferences.personality === "sleepy" ? "amble" : "scoot", duration: step.kind === "jump" ? 850 : Math.max(220, Math.abs(step.target.x - input.world.x) / speed * 1000) }, input);
    offered.meta.travel = true; offered.action!.personalityScene.travel = true; return offered;
  };
  return {
    event(key: SceneTrigger, at: number) { if (Number.isFinite(at)) events.set(key, at); },
    cancel() { finish(false); },
    active: () => Boolean(active),
    current: () => active ? { id: active.recipe.id, beat: active.beat, itemId: active.itemId } : undefined,
    bind(beat: PersonalitySceneBeat, itemId: string) { if (active?.serial === beat.serial && active.beat === beat.beat && !active.itemId) active.itemId = itemId; },
    completed: () => [...completed],
    /** Called only after a real native effect acknowledges success. */
    resolve(beat: PersonalitySceneBeat, success: boolean, itemId?: string) {
      if (!active || beat.serial !== active.serial || beat.beat !== active.beat || beat.travel) return;
      if (!success) { if (beat.command.optional) advance(); else finish(false); return; }
      if (itemId) active.itemId = itemId;
      if (beat.command.kind === "toy" && beat.command.mode === "return" && ++active.count < Math.min(2, beat.command.limit ?? 1)) { active.itemId = undefined; active.progressed = now; return; }
      advance();
    },
    complete(beat: PersonalitySceneBeat) {
      if (!active || beat.serial !== active.serial || beat.beat !== active.beat || beat.travel) return;
      // Travel is re-proved at the next decision. Delegated ownership and
      // furniture effects need actual ACK, never merely an elapsed pose.
      if (["go", "toy", "food", "tv", "light", "curtain"].includes(beat.command.kind)) return;
      advance();
    },
    next(input: PersonalitySceneInput): PersonalitySceneProposal | undefined {
      now = Math.max(now, Number.isFinite(input.now) ? input.now : now);
      const { world, preferences: p, brain } = input;
      if (selected !== p.personality) { selected = p.personality; first = true; finish(false); cursor = 0; }
      if (!p.enabled || !p.roam || !world.animated || world.paused || input.busy || !world.platformId) return;
      const support = world.platforms.find(platform => platform.id === world.platformId);
      if (!support || Math.abs(support.y - world.y) > 2 || world.x < support.x || world.x > support.x + support.width || ["control", "hide"].includes(support.kind)) return;
      const here = { x: world.x, y: world.y, platformId: world.platformId };
      if (first) {
        first = false; const play = p.personality === "affectionate" && !p.petting || p.personality === "mischievous" && !p.jump ? "bow" : entry[p.personality][0]; previousPlay = play;
        const command: SceneBeat = { kind: "pose", pose: play };
        const entryMeta = { id: `entry-${p.personality}`, serial: ++serial, beat: 0, command };
        return { meta: entryMeta, action: { kind: "play", play, target: here, duration: companionPlayDuration(play), personalityScene: entryMeta, personalitySignature: p.personality } };
      }
      if (active) {
        if (Math.hypot(world.x - active.lastX, world.y - active.lastY) > 4) { active.progressed = now; active.lastX = world.x; active.lastY = world.y; }
        if (now - active.progressed > 7500 || now - active.started > 60000) finish(false);
      }
      if (!active) {
        const pool = recipes.filter(recipe => recipe.personality === p.personality && available(recipe, input));
        const eligible = pool.filter(recipe => recipe.id !== lastCompleted && !completed.slice(-3).includes(recipe.id));
        const choices = eligible.length ? eligible : pool.filter(recipe => recipe.id !== lastCompleted);
        const major = choices.filter(recipe => recipe.major), event = choices.filter(recipe => recipe.triggers.some(key => !["free", "toy", "food", "tv", "night", "summer", "rain", "experience"].includes(key)));
        const candidates = event.length ? event : major.length && cursor % 4 !== 3 ? major : choices;
        const recipe = candidates[cursor++ % Math.max(1, candidates.length)];
        if (recipe) active = { recipe, serial: ++serial, beat: 0, started: now, progressed: now, attempts: 0, lastX: world.x, lastY: world.y, count: 0 };
        else {
          const options = entry[p.personality].filter(play => play !== previousPlay && (p.petting || !["ask-petting", "lean-nuzzle"].includes(play)) && (p.jump || play !== "pounce"));
          const play = options[cursor++ % Math.max(1, options.length)] ?? "bow"; previousPlay = play;
          const command: SceneBeat = { kind: "pose", pose: play }, entryMeta = { id: `ready-${p.personality}`, serial: ++serial, beat: 0, command };
          return { meta: entryMeta, action: { kind: "play", play, target: here, duration: companionPlayDuration(play), personalityScene: entryMeta, personalitySignature: p.personality } };
        }
      }
      // At most four zero-duration transitions per existing decision.
      for (let transitions = 0; active && transitions < 4; transitions++) {
        const command = active.recipe.steps[active.beat];
        if (!command) { finish(true); return; }
        if (command.kind === "go") {
          const point = targetFor(command.target, input);
          if (safe(point)) attention = point;
          if (safe(point) && point.platformId === world.platformId && Math.hypot(point.x - world.x, point.y - world.y) < (command.target === "toy" || command.target === "food" ? 34 : 24)) { advance(); continue; }
          const offered = safe(point) ? go(point, command, input) : undefined;
          if (offered) return offered;
          if (command.optional) { advance(); continue; } finish(false); return;
        }
        if (command.kind === "toy" || command.kind === "food") {
          if (command.mode !== "spawn" && !active.itemId) {
            if (["T10", "B05"].includes(active.recipe.id)) active.itemId = input.interruptedItemId;
            else if (active.recipe.id === "T09") active.itemId = input.deferredToyId;
            else targetFor(command.kind, input);
          }
          return { meta: meta(command), delegate: command };
        }
        if (["tv", "light", "curtain"].includes(command.kind)) {
          if (command.kind === "light" && input.lightLit === command.lit || command.kind === "tv" && command.state !== "next" && input.tv === command.state
            || command.kind === "curtain" && input.curtainPhase === command.phase) { advance(); continue; }
          const point = input.home[command.kind === "curtain" ? "window" : command.kind as "tv" | "light"];
          if (!point) { if (command.optional) { advance(); continue; } finish(false); return; }
          if (Math.hypot(point.x - world.x, point.y - world.y) > 55 || point.platformId !== world.platformId) {
            const offered = go(point, command, input); if (offered) return offered;
            if (command.optional) { advance(); continue; } finish(false); return;
          }
          return action(command, { kind: "play", play: command.kind === "light" && p.jump ? "pounce" : "bow", target: here, duration: command.kind === "light" && p.jump ? companionPlayDuration("pounce") : 900 }, input);
        }
        if (command.kind === "sleep" && (!p.sleep || !atHome(world.platformId) || brain.energy > getCompanionBehaviorProfile(p).sleepEnergy)) return action(command, { kind: "stretch", target: here, duration: 1000 }, input);
        if (command.kind === "sleep") return action(command, { kind: "sleep", living: "cozy", target: here, duration: Math.min(7000, Math.max(2000, command.ms)) }, input);
        if (command.kind === "hide") return action(command, { kind: "hide", target: here, duration: Math.min(3000, command.ms) }, input);
        if (command.kind === "watch") {
          const watchesTv = active.recipe.steps.some(step => step.kind === "tv") || active.recipe.triggers.includes("tv");
          if (watchesTv && input.tv !== "off" && input.home.sofa && world.platformId !== input.home.sofa.platformId) { const offered = go(input.home.sofa, command, input); if (offered) return offered; }
          if (watchesTv && input.home.tv) attention = input.home.tv;
          return action(command, { kind: "look", direction: (attention?.x ?? input.home.tv?.x ?? world.x) < world.x ? -1 : 1, target: here, duration: Math.min(3500, Math.max(650, command.ms)), ...(attention ? { attention: { kind: "social", point: attention } } : {}) }, input);
        }
        if (command.kind === "wash") {
          const pad = input.home.pad;
          if (!pad) { finish(false); return; }
          if (Math.hypot(pad.x - world.x, pad.y - world.y) > 24 || pad.platformId !== world.platformId) { const offered = go(pad, command, input); if (offered) return offered; finish(false); return; }
          return action(command, { kind: "play", play: "groom", target: here, duration: Math.min(4000, Math.max(1500, command.ms)) }, input);
        }
        if (command.kind === "pose") {
          const pose = command.pose;
          if (["look", "sniff", "stretch", "shake"].includes(pose)) return action(command, { kind: pose as "look" | "sniff" | "stretch" | "shake", ...(pose === "sniff" && active.itemId ? { direction: (input.toys.find(toy => toy.id === active!.itemId)?.x ?? world.foods?.find(food => food.id === active!.itemId)?.x ?? world.x) < world.x ? -1 as const : 1 as const } : {}), target: here, duration: Math.min(2500, command.ms ?? 900) }, input);
          const play = !p.petting && ["ask-petting", "lean-nuzzle"].includes(pose) ? "bow" : !p.jump && pose === "pounce" ? "bow" : pose as CompanionPlay;
          return action(command, { kind: "play", play, target: here, duration: companionPlayDuration(play) }, input);
        }
      }
    },
  };
}
