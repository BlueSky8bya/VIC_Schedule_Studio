import { describe, expect, it } from "vitest";
import { createBrain, recordCompanionEvent, type CompanionFood, type Platform } from "@/lib/ui/viewer-companion/brain";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { createCompanionScenes, type CompanionSceneAction, type CompanionSceneEvent, type CompanionSceneInput } from "@/lib/ui/viewer-companion/scenes";
import { beginCompanionEncounter, createCompanionSceneStore, newCompanionSceneMemory, normalizeCompanionSceneMemory, preferredCompanionSceneAccessory, type CompanionSceneMemory } from "@/lib/ui/viewer-companion/scene-memory";
import { companionInstrumentPulse } from "@/lib/ui/viewer-companion/instrument-music";
import { companionInstrumentScoreBoundary } from "@/lib/ui/viewer-companion/instrument-score";
import { DEFAULT_COMPANION_LIFE } from "@/lib/ui/viewer-companion/life";

const wallTime = Date.parse("2026-10-19T21:00:00+09:00");
const floor: Platform = { id: "floor", kind: "floor", x: 0, y: 600, width: 900 };
const pantryFloor: Platform = { id: "companion-home-floor", kind: "floor", manualOnly: true, x: 400, y: 600, width: 300 };
const apple = (id = "a", x = 100): CompanionFood => ({ id, kind: "apple", x, y: 600, platformId: "floor" });
function scenario(memory = newCompanionSceneMemory()) {
  const controller = createCompanionScenes(memory), brain = { ...createBrain(0, () => .5), hunger: .1, energy: .9, life: { ...DEFAULT_COMPANION_LIFE, foodScores: { ...DEFAULT_COMPANION_LIFE.foodScores }, familiarity: { ...DEFAULT_COMPANION_LIFE.familiarity } } };
  const input: CompanionSceneInput = { brain, world: { x: 100, y: 600, platformId: "floor", platforms: [floor, pantryFloor], foods: [], width: 1000, height: 700, animated: true }, pantry: { x: 550, y: 600, platformId: pantryFloor.id }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: true, jump: true, feeding: true, sleep: true, learnFromYou: true, rarePrank: true }, now: 0, knownFoods: COMPANION_FOOD_KINDS, owned: [], equipped: null };
  const removed = new Map<string, CompanionFood>();
  const event = (value: CompanionSceneEvent) => controller.event(value, input.now, input.preferences.learnFromYou);
  const next = () => controller.next(input);
  const complete = (action: CompanionSceneAction, acknowledge = true) => {
    input.now += action.duration;
    if (action.kind === "walk" || action.kind === "jump") input.world = { ...input.world, ...action.target };
    const effect = action.scene.effect;
    if (effect && acknowledge) {
      const foods = [...input.world.foods ?? []];
      if (effect.kind === "pick") {
        const food = foods.find(food => food.id === effect.foodId)!;
        removed.set(food.id, food); input.carriedFoodId = food.id; input.world.foods = foods.filter(item => item.id !== food.id);
      } else {
        if (effect.kind === "put") input.world.foods = [...foods, { ...removed.get(effect.foodId)!, ...effect.point }];
        input.carriedFoodId = undefined;
      }
      controller.resolve(action, true);
    }
    if (action.kind === "eat" && action.foodId) {
      const food = (input.world.foods ?? []).find(food => food.id === action.foodId)!;
      input.world.foods = input.world.foods?.filter(food => food.id !== action.foodId);
      event({ kind: "meal", foodId: food.id, food: food.kind, favoriteChanged: false, first: false });
    }
    controller.complete(action);
  };
  const drain = (id: number, each?: (action: CompanionSceneAction) => void) => {
    const trace: CompanionSceneAction[] = [];
    for (let i = 0; i < 80; i++) {
      const action = next(); if (!action || action.scene.id !== id) return trace;
      trace.push(action); each?.(action); complete(action);
    }
    throw Error("Scene did not finish within eighty real acknowledgements");
  };
  return { controller, input, event, next, complete, drain };
}

describe("36 scene triggers are actual context, not numbered pose aliases", () => {
  const cases: [number, (s: ReturnType<typeof scenario>, m: CompanionSceneMemory) => void][] = [
    [1, (s, m) => { m.lastMinute = wallTime / 60000 - 4321; m.lastVisitMinute = m.lastMinute; }],
    [2, (_s, m) => { m.lastMinute = wallTime / 60000 - 60; m.hours[21] = 3; }],
    [3, (_s, m) => { m.hours[21] = 3; }],
    [4, (_s, m) => { m.homeHours[21] = 3; }],
    [5, (_s, m) => { m.unfinished = "performance"; }],
    [6, (_s, m) => { m.unfinished = "hide"; }],
    [7, s => s.event({ kind: "manual-land", place: "floor", recovered: true, point: { x: 100, y: 600, platformId: "floor" } })],
    [8, s => { s.event({ kind: "rough" }); for (let i = 0; i < 3; i++) s.event({ kind: "petted", place: "floor" }); }],
    [9, (s, m) => { m.places.floor = 3; }],
    [10, (s, m) => { m.greetingCount = 3; s.input.world.pointer = { x: 120, y: 500, stableMs: 1500 }; }],
    [11, s => { s.input.brain.hunger = .5; s.input.brain.life!.favoriteFood = "apple"; s.input.knownFoods = ["apple"]; s.input.world.foods = [apple(), { id: "b", kind: "croissant", x: 200, y: 600, platformId: "floor" }]; }],
    [12, s => { s.input.brain.hunger = .5; s.input.knownFoods = ["bread"]; s.input.world.foods = [{ id: "b", kind: "croissant", x: 200, y: 600, platformId: "floor" }]; }],
    [13, s => { s.input.world.foods = [apple()]; }],
    [14, s => s.event({ kind: "meal", food: "apple", first: false, favoriteChanged: true })],
    [15, s => { s.event({ kind: "food-mishap", food: "apple" }); s.event({ kind: "meal", food: "apple", first: false, favoriteChanged: false }); s.event({ kind: "petted", place: "floor" }); }],
    [16, s => { s.input.radio = { playing: true, mood: "calm" }; s.event({ kind: "radio", mood: "calm" }); }],
    [17, s => { s.input.brain.energy = .3; s.input.world.foods = [apple()]; s.input.world.pointer = { x: 120, y: 550, stableMs: 600 }; s.event({ kind: "household", effect: "spawn", foodId: "a" }); }],
    [18, s => { s.event({ kind: "household", effect: "discard", foodId: "a" }); s.event({ kind: "user-discard", foodId: "b" }); }],
    [19, s => { s.input.world.foods = [apple()]; s.event({ kind: "cleanup-interrupted", foodId: "a", point: { x: 40, y: 600, platformId: "floor" } }); s.event({ kind: "meal", food: "bread", first: false, favoriteChanged: false }); }],
    [20, s => { s.input.brain.energy = .3; s.input.world.foods = [apple("a", 180)]; s.event({ kind: "household", effect: "scatter", foodId: "a", from: { x: 100, y: 600 } }); }],
    [21, (s, m) => { m.music.calm = 3; s.input.radio = { playing: true, mood: "calm" }; }],
    [22, s => s.event({ kind: "instrument", phrase: 0, phraseEnd: true, finished: false, quality: "steady", score: { id: "score-32", segment: 0 } })],
    [23, (_s, m) => { m.unfinished = "melody"; m.melody = { score: "score-32", segment: 0 }; }],
    [24, s => s.event({ kind: "instrument", phrase: 8, finished: true, quality: "steady", mood: "lively", score: { id: "score-32", segment: 0 } })],
    [25, s => { s.input.equipped = "detective-hat"; s.input.owned = ["detective-hat"]; s.input.brain.energy = .3; s.input.knownFoods = []; s.input.world.foods = [apple()]; }],
    [26, (_s, m) => { m.outfits.beret = 3; }],
    [27, s => { s.input.equipped = "magic-pocket"; s.input.owned = ["magic-pocket"]; s.next(); s.event({ kind: "meal", food: "apple", first: true, favoriteChanged: false }); }],
    [28, s => { s.input.equipped = "propeller-hat"; s.input.owned = ["propeller-hat"]; s.event({ kind: "rested", equipped: "propeller-hat" }); }],
    [29, s => { s.input.knownBehaviors = ["bow"]; s.event({ kind: "signal", signal: { kind: "memory-inspected", behavior: "bow" } }); }],
    [30, (_s, m) => { m.first = "touch"; }],
    [31, s => { s.input.environment = { season: "winter", weather: "clear" }; s.event({ kind: "month", empty: false }); }],
    [32, s => s.event({ kind: "month", empty: false })],
    [33, s => s.event({ kind: "month", empty: true })],
    [34, s => s.event({ kind: "premiere-return" })],
    [35, s => s.event({ kind: "layout" })],
    [36, s => { s.input.equipped = "party-hat"; s.input.owned = ["party-hat"]; s.input.radio = { playing: true, mood: "lively" }; s.next(); s.event({ kind: "meal", food: "apple", first: true, favoriteChanged: false }); }],
  ];
  it.each(cases)("scene %i has its distinct required trigger", (id, setup) => {
    const memory = newCompanionSceneMemory(); let s = scenario(memory);
    setup(s, memory);
    if ([1, 2, 3, 4, 5, 6, 9, 10, 21, 23, 26, 30].includes(id)) {
      const priorInput = s.input; s = scenario(memory); Object.assign(s.input, priorInput);
      if (id === 9) s.event({ kind: "petted", place: "floor" });
      else if (id === 21) s.event({ kind: "radio", mood: "calm", listenedMs: 3000 });
      else if (id === 26) { s.input.owned = ["beret"]; s.event({ kind: "signal", signal: { kind: "wardrobe-opened" } }); }
      else s.event({ kind: "encounter", wallTime: id === 3 ? wallTime - 12 * 3600_000 : wallTime });
      if (id === 23) s.event({ kind: "instrument", phrase: 0, finished: false, quality: "unknown", score: { id: "score-32", segment: 0 } });
    }
    // Month stability can queue both its seasonal and navigation expressions.
    // Check lower-priority empty-calendar scene after the valid navigation.
    if (id === 33) s.drain(32);
    expect(s.next()?.scene.id).toBe(id);
  });
});

describe("causal action and acknowledgement contracts", () => {
  it("7 walks on the proved helped landing rather than inventing a new support", () => {
    const s = scenario(); s.event({ kind: "manual-land", place: "floor", recovered: true, point: { x: 100, y: 600, platformId: "floor" } });
    const trace = s.drain(7); expect(trace.some(action => action.kind === "walk")).toBe(true);
    expect(trace.every(action => action.target.platformId === "floor")).toBe(true);
  });
  it("9 can select the actually reachable learned home, not just another card", () => {
    const memory = newCompanionSceneMemory(); memory.places.home = 4;
    const s = scenario(memory), home: Platform = { id: "companion-home", kind: "date", manualOnly: true, x: 180, width: 120, y: 500 };
    s.input.world.platforms = [floor, home]; s.input.home = { x: 240, y: 500, platformId: home.id };
    s.event({ kind: "petted", place: "home" });
    expect(s.drain(9).some(action => action.target.platformId === home.id)).toBe(true);
  });
  it("11 chooses and approaches the actual novel food, then permits only a real bite", () => {
    const s = scenario(); s.input.preferences.personality = "curious"; s.input.brain.hunger = .5;
    s.input.brain.life!.favoriteFood = "apple"; s.input.knownFoods = ["apple"];
    s.input.world.foods = [apple("a", 150), { id: "b", kind: "croissant", x: 250, y: 600, platformId: "floor" }];
    const trace = s.drain(11), bite = trace.find(action => action.kind === "eat");
    expect(bite?.foodId).toBe("b"); expect(trace.findIndex(action => action.kind === "walk")).toBeLessThan(trace.findIndex(action => action.kind === "eat"));
    expect(s.input.world.foods?.map(food => food.id)).toEqual(["a"]);
  });
  it("13 moves one existing food and later returns to that same identity while hungry", () => {
    const s = scenario(); s.input.world.foods = [apple()];
    expect(s.drain(13).filter(action => action.scene.effect).map(action => action.scene.effect!.kind)).toEqual(["pick", "put"]);
    expect(s.controller.hasReservedFood()).toBe("a"); s.input.brain.hunger = .5;
    const returned = s.drain(13); expect(returned.some(action => action.kind === "eat" && action.foodId === "a")).toBe(true);
    expect(returned.some(action => action.scene.effect)).toBe(false); expect(s.controller.hasReservedFood()).toBeUndefined();
  });
  it("requires actual effect acknowledgement and never resumes a different cleanup food", () => {
    const s = scenario(); s.input.world.foods = [apple()];
    s.event({ kind: "cleanup-interrupted", foodId: "a", point: { x: 50, y: 600, platformId: "floor" } });
    s.event({ kind: "meal", foodId: "b", food: "bread", favoriteChanged: false, first: false });
    const first = s.next()!; expect(first.scene.id).toBe(19); expect(first.scene.effect?.foodId).toBe("a");
    s.complete(first, false); expect(s.next()?.scene.id).not.toBe(19);
    const missing = scenario(); missing.input.world.foods = [apple("b")];
    missing.event({ kind: "cleanup-interrupted", foodId: "gone" }); missing.event({ kind: "meal", food: "bread", favoriteChanged: false, first: false });
    expect(missing.next()?.scene.id).not.toBe(19);
  });
  it("17 requires a real settled spawned food and a nearby stable observer", () => {
    const s = scenario(); s.input.brain.energy = .3; s.event({ kind: "household", effect: "spawn", foodId: "a" });
    expect(s.next()).toBeUndefined(); s.input.world.foods = [apple()];
    s.input.world.pointer = { x: 700, y: 600, stableMs: 2000 }; expect(s.next()).toBeUndefined();
    s.input.world.pointer = { x: 130, y: 570, stableMs: 600 }; expect(s.next()?.scene.id).toBe(17);
  });
  it("18 expires old cooperation and never double-counts the same discarded item", () => {
    for (const [delay, userId] of [[20_000, "b"], [0, "a"]] as const) {
      const s = scenario(); s.event({ kind: "household", effect: "discard", foodId: "a" }); s.input.now = delay;
      s.event({ kind: "user-discard", foodId: userId }); expect(s.controller.pending()).not.toContain(18);
    }
  });
  it("20 follows a measured far roll once and does not produce another scatter", () => {
    const s = scenario(); s.input.brain.energy = .3; s.input.world.foods = [apple("a", 140)];
    s.event({ kind: "household", effect: "scatter", foodId: "a", from: { x: 100, y: 600 } }); expect(s.next()).toBeUndefined();
    s.input.world.foods = [apple("a", 180)]; const trace = s.drain(20);
    expect(trace.some(action => action.kind === "walk" && action.target.x === 180)).toBe(true);
    expect(trace.some(action => action.scene.effect)).toBe(false);
  });
  it("22 waits for the next actual phrase and responds differently to its validated quality", () => {
    const response = (quality: "steady" | "uneven") => {
      const s = scenario(); s.input.preferences.personality = "mischievous";
      s.event({ kind: "instrument", phrase: 0, phraseEnd: true, finished: false, quality: "steady", score: { id: "score-32", segment: 0 } });
      const bow = s.next()!; s.complete(bow);
      s.event({ kind: "instrument", phrase: 1, phraseEnd: true, finished: false, quality, score: { id: "score-32", segment: 0 } });
      return s.drain(22).find(action => action.kind === "play");
    };
    expect(response("steady")?.play).toBe("celebrate"); expect(response("uneven")?.play).toBe("groom");
  });
  it("10 completes an acknowledged invitation through the actual petting social context", () => {
    const memory = newCompanionSceneMemory(); memory.greetingCount = 3;
    const s = scenario(memory); s.input.world.pointer = { x: 110, y: 590, stableMs: 2000 };
    const invitation = s.next()!; expect(invitation.scene.id).toBe(10); s.complete(invitation);
    s.input.brain = recordCompanionEvent(s.input.brain, "petted");
    expect(s.input.brain.episode?.kind).toBe("social");
    s.event({ kind: "petted", place: "floor" });
    expect(s.drain(10).some(action => action.kind === "play")).toBe(true);
  });

  it("22 neither treats the first note of another phrase as completed nor asks forever", () => {
    const s = scenario();
    s.event({ kind: "instrument", phrase: 0, phraseEnd: true, finished: false, quality: "steady", score: { id: "score-32", segment: 0 } });
    const bow = s.next()!; s.complete(bow);
    s.event({ kind: "instrument", phrase: 1, phraseEnd: false, finished: false, quality: "unknown", score: { id: "score-32", segment: 0 } });
    expect(s.drain(22).some(action => action.kind === "play")).toBe(false);
    s.input.now += 30_000; expect(s.next()?.scene.id).not.toBe(22);
  });
  it("23 recognizes only the one allowlisted unfinished score segment", () => {
    const memory = newCompanionSceneMemory(); memory.unfinished = "melody"; memory.melody = { score: "score-32", segment: 0 };
    const s = scenario(memory); s.event({ kind: "encounter", wallTime });
    for (const score of [{ id: "external-private-title", segment: 0 }, { id: "score-32", segment: 1 }]) s.event({ kind: "instrument", phrase: 0, finished: false, quality: "unknown", score });
    expect(s.controller.pending()).not.toContain(23);
    s.event({ kind: "instrument", phrase: 1, finished: false, quality: "unknown", score: { id: "score-32", segment: 0 } }); expect(s.controller.pending()).toContain(23);
  });
  it("26 prefers a different owned keepsake without equipping or revealing locked art", () => {
    const memory = newCompanionSceneMemory(); memory.outfits.beret = 4; memory.outfits["party-hat"] = 2;
    expect(preferredCompanionSceneAccessory(memory, ["party-hat"])).toBe("party-hat");
    const s = scenario(memory); s.input.owned = ["beret", "party-hat"]; s.input.equipped = "party-hat";
    expect(s.controller.preferredAccessory(s.input.owned)).toBe("beret"); s.event({ kind: "signal", signal: { kind: "wardrobe-opened" } });
    expect(s.drain(26).some(action => action.accessory === "beret")).toBe(false); expect(s.input.equipped).toBe("party-hat");
  });
  it("31 has four real seasonal paths and remains on measured supports", () => {
    const traces = new Map<string, CompanionSceneAction[]>();
    for (const season of ["spring", "summer", "autumn", "winter"]) {
      const s = scenario(); s.input.preferences.personality = "curious";
      const home: Platform = { id: "companion-home", kind: "date", manualOnly: true, x: 180, width: 120, y: 500 };
      s.input.world.platforms = [floor, home]; s.input.home = { x: 240, y: 500, platformId: home.id };
      s.input.environment = { season, weather: "clear" }; s.event({ kind: "month", empty: false });
      const trace = s.drain(31); traces.set(season, trace);
      expect(trace.every(action => [floor.id, home.id].includes(action.target.platformId!))).toBe(true);
    }
    expect(traces.get("spring")?.some(action => action.kind === "sniff")).toBe(true);
    expect(traces.get("summer")?.some(action => action.play === "groom")).toBe(true);
    expect(traces.get("summer")?.some(action => action.kind === "walk" || action.kind === "jump")).toBe(false);
    expect(traces.get("autumn")?.some(action => action.kind === "shake")).toBe(true);
    expect(traces.get("winter")?.some(action => action.play === "cozy-nest" && action.target.platformId === "companion-home")).toBe(true);
  });
  it.each(["rain", "snow", "fog"])("31 %s looks out then chooses finite personality-specific indoor play", weather => {
    const reaction = (personality: "homebody" | "mischievous") => {
      const s = scenario(); s.input.preferences.personality = personality; s.input.environment = { season: "winter", weather };
      s.event({ kind: "month", empty: false }); return s.drain(31);
    };
    const calm = reaction("homebody"), lively = reaction("mischievous");
    expect(calm[0].kind).toBe("look"); expect(calm.some(action => action.play === "cozy-nest")).toBe(true);
    expect(lively.some(action => action.play === "pounce")).toBe(true);
    expect([...calm, ...lively].some(action => action.scene.effect)).toBe(false);
  });
  it("31 wind checks both directions without creating a window perch", () => {
    const s = scenario(); s.input.environment = { season: "spring", weather: "wind" }; s.event({ kind: "month", empty: false });
    const trace = s.drain(31); expect(trace.filter(action => action.kind === "look").map(action => action.direction)).toEqual([1, -1]);
    expect(trace.every(action => action.target.platformId === floor.id)).toBe(true);
  });
  it("protects actual meal/episode/urgent rest ownership and bounds unanswered invitations", () => {
    for (const priority of ["meal", "episode", "intention", "rest"] as const) {
      const s = scenario(); s.event({ kind: "layout" });
      if (priority === "meal") s.input.brain.foodGoal = { foodId: "a", remaining: 4, retryAfter: 0 };
      if (priority === "episode") s.input.brain.episode = { kind: "social", phase: "start", variant: "careful", remaining: 2, mishapUsed: false, legs: 0 };
      if (priority === "intention") s.input.brain.intention = { kind: "rest", stage: "travel", remaining: 2, targetId: "floor", offset: .5 };
      if (priority === "rest") s.input.brain.energy = .01;
      expect(s.next()).toBeUndefined();
    }
    const memory = newCompanionSceneMemory(); memory.greetingCount = 3;
    const s = scenario(memory); s.input.world.pointer = { x: 110, y: 590, stableMs: 2000 };
    const trace = s.drain(10); expect(trace.filter(action => action.kind === "play")).toHaveLength(1);
    s.input.now += 60_000; expect(s.next()).toBeUndefined();
  });
});

describe("local bounded memory and actual instrument metadata", () => {
  it("does not learn several days from same-hour reloads on one day", () => {
    let memory = newCompanionSceneMemory();
    for (const minute of [0, 20, 40]) memory = beginCompanionEncounter(memory, wallTime + minute * 60_000).memory;
    expect(memory.hours[21]).toBe(1);
  });
  it("distinguishes an earlier morning visit from a later evening visit", () => {
    const evening = newCompanionSceneMemory(); evening.hours[21] = 3;
    expect(beginCompanionEncounter(evening, wallTime - 12 * 3600_000).early).toBe(true);
    const morning = newCompanionSceneMemory(); morning.hours[9] = 3;
    expect(beginCompanionEncounter(morning, wallTime).early).toBe(false);
  });
  it("drops arbitrary identity/title/coordinate fields and invalid scores; disabled storage stays untouched", () => {
    const raw = { ...newCompanionSceneMemory(), accountId: "secret", scheduleTitle: "secret", point: { x: 30 }, melody: { score: "secret", segment: 0 }, outfits: { secret: 100 } };
    const clean = normalizeCompanionSceneMemory(raw); expect(JSON.stringify(clean)).not.toContain("secret");
    let writes = 0, reads = 0; const store = createCompanionSceneStore({ getItem: () => { reads++; return null; }, setItem: () => { writes++; } });
    store.load(false); store.save(clean, false); expect([reads, writes]).toEqual([0, 0]);
  });
  it("does not turn a wall-clock rollback into absence rewards or permanently block fresh visits", () => {
    const memory = newCompanionSceneMemory(); memory.lastMinute = wallTime / 60000 + 5000; memory.lastVisitMinute = memory.lastMinute;
    const first = beginCompanionEncounter(memory, wallTime); expect(first.gapMinutes).toBe(0); expect(first.fresh).toBe(false);
    expect(beginCompanionEncounter(first.memory, wallTime + 21 * 60000).fresh).toBe(true);
  });
  it("adds phrase/score boundaries only to actually performed allowlisted score attacks", () => {
    expect(companionInstrumentPulse("private-title", 100, 500, { sequence: 1, index: 2 }).scoreKey).toBeUndefined();
    expect(companionInstrumentPulse("생일 축하합니다", 100).scoreKey).toBeUndefined();
    expect(companionInstrumentPulse("생일 축하합니다", 100, 500, { sequence: 1, index: 2 })).toMatchObject({ scoreKey: "score-32", phraseEnd: true, scoreEnd: false });
    expect(companionInstrumentScoreBoundary("생일 축하합니다", -1)).toBeUndefined();
  });
});
