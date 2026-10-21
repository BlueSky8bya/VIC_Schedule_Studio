import { describe, expect, it } from "vitest";
import { createBrain, type CompanionAction, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneBeat, type PersonalitySceneInput, type PersonalitySceneProposal } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe, type SceneBeat } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { advanceCompanionPlayPresentation, COMPANION_PLAY_PRESENTATION_WAIT_MS } from "@/lib/ui/viewer-companion/play-presentation";

const floor: Platform = { id: "companion-home-floor", x: 40, y: 600, width: 720, kind: "floor", manualOnly: true };
const sofa: Platform = { id: "companion-home", x: 90, y: 560, width: 160, kind: "date" };
const pad: Platform = { id: "companion-home-floor-400", x: 490, y: 600, width: 160, kind: "floor", bodyOnly: true, manualOnly: true };
const date: Platform = { id: "actual-public-date", x: 790, y: 580, width: 160, kind: "date" };
const context = (): PersonalitySceneInput => ({
  world: { x: 150, y: floor.y, platformId: floor.id, platforms: [floor, sofa, pad, date], width: 1100, height: 800, animated: true, foods: [] },
  brain: { ...createBrain(0, () => .5), hunger: .1, energy: .9, activeMs: 0 },
  preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "curious", roam: true, jump: true, feeding: true, sleep: true, ambientPrank: false },
  now: 0, home: { floor: { x: 320, y: floor.y, platformId: floor.id }, box: { x: 360, y: floor.y, platformId: floor.id },
    sofa: { x: 170, y: sofa.y, platformId: sofa.id }, pad: { x: 570, y: pad.y, platformId: pad.id },
    tv: { x: 650, y: floor.y, platformId: floor.id }, contacts: { tv: { x: 650, y: 570 } } },
  toys: [], tv: "off", canTv: true,
});
const recipe = (steps: readonly SceneBeat[], change: Partial<PersonalitySceneRecipe> = {}): PersonalitySceneRecipe => ({
  id: "required-basic-source-fixture", label: "one actual required source command", personality: "curious", major: true, triggers: ["free"], steps, ...change,
});
function enter(d: ReturnType<typeof createCompanionPersonalityDirector>, s: PersonalitySceneInput) {
  const entry = d.next(s);
  expect(entry?.meta.id).toBe("entry-curious");
  if (!entry?.action) throw Error("real initial proposal missing");
  d.complete(entry.meta); s.now += entry.action.duration; s.brain.activeMs = s.now;
  return entry;
}
function offered(steps: readonly SceneBeat[], configure: (s: PersonalitySceneInput) => void = () => {}, change: Partial<PersonalitySceneRecipe> = {}) {
  const s = context(); configure(s);
  const authored = recipe(steps, change), d = createCompanionPersonalityDirector([authored], () => .5);
  const entry = enter(d, s), p = d.next(s);
  expect(p?.meta.id).toBe(authored.id);
  if (!p) throw Error("actual source command not admitted");
  return { s, d, p, entry, authored };
}
const pose = (name: "stretch" | "shake" | "sniff" | "look", ms = 900): SceneBeat => ({ kind: "pose", pose: name, ms });
const rowOf = (c: ReturnType<typeof offered>, proposal: PersonalitySceneProposal = c.p) => proposal.action
  ? c.d.finitePosePresentation(proposal.meta, proposal.action.kind)?.row : undefined;
const tvWatch = (ms = 1400) => offered([{ kind: "watch", ms }], s => {
  s.world = { ...s.world, x: 170, y: sofa.y, platformId: sofa.id }; s.tv = "nature";
}, { id: "real-required-television-source-fixture", triggers: ["tv"] });

// These are API/clock model tests. Only the visual factory can certify an
// actual decoded cell, actual TV picture and a real subsequent activity.
describe("157 required finite basic source subject", () => {
  it.each([["stretch", 16], ["shake", 17], ["sniff", 1], ["look", 1]] as const)("maps an actually offered required %s command to row %i", (name, row) => {
    const c = offered([pose(name)]);
    expect(c.p.action).toMatchObject({ kind: name, duration: 900 });
    expect(c.p.meta.command).toMatchObject({ kind: "pose", pose: name, ms: 900 });
    expect(c.d.owns(c.p.meta)).toBe(true); expect(rowOf(c)).toBe(row);
    const before = { current: c.d.current(), completed: c.d.completed(), deadline: c.d.progressDeadline() };
    for (let i = 0; i < 20; i++) expect(rowOf(c)).toBe(row);
    expect({ current: c.d.current(), completed: c.d.completed(), deadline: c.d.progressDeadline() }).toEqual(before);
  });
  it("uses the actual registered required subjects without making their source IDs a production branch", () => {
    expect(COMPANION_PERSONALITY_SCENES.find(r => r.id === "S05")?.steps[2]).toEqual({ kind: "pose", pose: "stretch" });
    const c04 = COMPANION_PERSONALITY_SCENES.find(r => r.id === "C04");
    expect(c04?.steps[2]).toEqual({ kind: "watch", ms: 1400 });
    expect(c04?.steps[4]).toEqual({ kind: "watch", ms: 3000 });
    expect(c04?.steps.at(-1)).toMatchObject({ kind: "pose", pose: "bow", optional: true });
    const c = offered([pose("stretch")], () => {}, { id: "another-required-basic-source" });
    expect(rowOf(c)).toBe(16);
  });
  it.each([1400, 3000])("recognizes actual required TV watch %ims after the director binds its real subject", ms => {
    const c = tvWatch(ms);
    expect(c.p.action).toMatchObject({ kind: "look", duration: ms });
    expect(c.p.meta.command).toEqual({ kind: "watch", ms }); expect(rowOf(c)).toBe(1);
  });
  it("does not turn ordinary watch or an introductory source into a TV-owned look", () => {
    const c = offered([{ kind: "watch", ms: 1400 }]);
    expect(c.p.action?.kind).toBe("look"); expect(rowOf(c)).toBeUndefined();
    expect(c.entry.action).toBeTruthy();
    expect(c.d.finitePosePresentation(c.entry.meta, c.entry.action!.kind)).toBeUndefined();
  });
  it.each(["optional-pose", "optional-watch", "tv-off", "human-tv-lease"])("leaves %s on its existing clock", gate => {
    const isWatch = gate !== "optional-pose";
    const steps: SceneBeat[] = isWatch ? [{ kind: "watch", ms: 1400, ...(gate === "optional-watch" ? { optional: true } : {}) }]
      : [{ kind: "pose", pose: "stretch", ms: 900, optional: true }];
    const c = offered(steps, s => {
      if (isWatch) { s.world = { ...s.world, x: 170, y: sofa.y, platformId: sofa.id }; s.tv = gate === "tv-off" ? "off" : "nature"; }
      if (gate === "human-tv-lease") s.canTv = false;
    }, isWatch ? { triggers: ["tv"] } : {});
    expect(rowOf(c)).toBeUndefined(); expect(c.d.completed()).toEqual([]);
  });
  it.each(["id", "serial", "beat", "travel", "routine", "manual", "command-kind", "command-pose", "command-ms", "command-optional", "action-kind"])("rejects a %s mismatch instead of owning a stale basic packet", gate => {
    const c = offered([pose("stretch")]);
    const meta: PersonalitySceneBeat = { ...c.p.meta, command: { ...c.p.meta.command } };
    let kind: CompanionAction["kind"] = "stretch";
    if (gate === "id") meta.id = "another-owner"; if (gate === "serial") meta.serial++;
    if (gate === "beat") meta.beat++; if (gate === "travel") meta.travel = true;
    if (gate === "routine") meta.routine = true; if (gate === "manual") meta.manual = true;
    if (gate === "command-kind") meta.command = { kind: "watch", ms: 900 };
    if (gate === "command-pose") meta.command = pose("shake");
    if (gate === "command-ms") meta.command = pose("stretch", 901);
    if (gate === "command-optional") meta.command = { ...pose("stretch"), optional: true };
    if (gate === "action-kind") kind = "look";
    expect(c.d.finitePosePresentation(meta, kind)).toBeUndefined();
    expect(c.d.current()).toMatchObject({ id: c.authored.id, beat: 0 }); expect(c.d.completed()).toEqual([]);
    expect(rowOf(c)).toBe(16);
  });
  it.each(["command-kind", "command-ms", "command-optional", "action-kind"])("rejects a %s mismatch for the actual TV subject", gate => {
    const c = tvWatch(); const meta = { ...c.p.meta, command: { ...c.p.meta.command } };
    if (gate === "command-kind") meta.command = pose("look", 1400);
    if (gate === "command-ms") meta.command = { kind: "watch", ms: 1401 };
    if (gate === "command-optional") meta.command = { kind: "watch", ms: 1400, optional: true };
    expect(c.d.finitePosePresentation(meta, gate === "action-kind" ? "sniff" : "look")).toBeUndefined();
    expect(rowOf(c)).toBe(1);
  });
});

describe("157 the real finite presentation helper retains the complete source clock", () => {
  it.each([600, 900])("does not spend a required900ms stretch during a %ims source preparation", delay => {
    const c = offered([pose("stretch")]);
    const duration = c.p.action!.duration, deadline = c.d.progressDeadline(), initial = c.s.now;
    let began = initial, presentation = { started: false, waited: 0 };
    for (let elapsed = 50; elapsed <= delay; elapsed += 50) {
      expect(rowOf(c)).toBe(16);
      const result = advanceCompanionPlayPresentation({ now: initial + elapsed, began, delta: 50, presentation, usable: false });
      began = result.began; presentation = result.presentation;
      expect(result.expired).toBe(false); expect(result.presentation.started).toBe(false);
      expect(initial + elapsed - began).toBe(0); expect(c.d.completed()).toEqual([]);
    }
    const now = initial + delay, ready = advanceCompanionPlayPresentation({ now, began, delta: 0, presentation, usable: true });
    expect(ready).toEqual({ began: now, presentation: { started: true, waited: delay }, expired: false });
    expect(now - ready.began).toBe(0); expect(duration).toBe(900);
    expect(now + duration - 1 - ready.began).toBe(duration - 1); expect(c.d.completed()).toEqual([]);
    // No movement/effect/learning ACK is synthesized by readiness or queries.
    expect(c.d.progressDeadline()).toBe(deadline); expect(c.p.action!.duration).toBe(duration);
    c.s.now = now + duration; c.s.brain.activeMs = c.s.now;
    c.d.observeProgress({ now: c.s.now, active: true, point: c.s.world }); c.d.complete(c.p.meta);
    expect(c.d.completed()).toEqual([c.authored.id]); expect(c.d.progressDeadline()).toBe(deadline);
  });
  it.each([900, 1400, 3000])("starts a warm required source at phase0 and keeps its original %ims duration", duration => {
    const c = duration === 900 ? offered([pose("stretch")]) : tvWatch(duration);
    const now = c.s.now, before = c.d.progressDeadline(); expect(rowOf(c)).toBe(duration === 900 ? 16 : 1);
    const warm = advanceCompanionPlayPresentation({ now, began: now, delta: 450, presentation: { started: false, waited: 0 }, usable: true });
    expect(warm).toEqual({ began: now, presentation: { started: true, waited: 0 }, expired: false });
    expect(c.p.action!.duration).toBe(duration); expect(c.d.progressDeadline()).toBe(before); expect(c.d.completed()).toEqual([]);
    const later = advanceCompanionPlayPresentation({ now: now + duration, began: warm.began, delta: duration, presentation: warm.presentation, usable: false });
    expect(later.began).toBe(now); expect(later.expired).toBe(false); expect(now + duration - later.began).toBe(duration);
  });
  it("cancels a still-unavailable required packet at the existing1200ms cap without granting completion", () => {
    const c = offered([pose("stretch")]), initial = c.s.now, deadline = c.d.progressDeadline();
    let began = initial, presentation = { started: false, waited: 0 };
    for (let elapsed = 100; elapsed <= COMPANION_PLAY_PRESENTATION_WAIT_MS; elapsed += 100) {
      const result = advanceCompanionPlayPresentation({ now: initial + elapsed, began, delta: 100, presentation, usable: false });
      began = result.began; presentation = result.presentation;
      expect(result.expired).toBe(elapsed === 1200); expect(result.presentation.started).toBe(false);
      expect(initial + elapsed - began).toBe(0); expect(c.d.completed()).toEqual([]);
    }
    c.d.resolve(c.p.meta, false, undefined, initial + 1200);
    expect(c.d.owns(c.p.meta)).toBe(false); expect(rowOf(c)).toBeUndefined();
    expect(c.d.completed()).toEqual([]); expect(c.d.progressDeadline()).toBe(deadline);
  });
  it("does not count a late preceding frame or paused wall time as preparation owned by this action", () => {
    const c = offered([pose("stretch")]), now = c.s.now;
    const launched = advanceCompanionPlayPresentation({ now, began: now, delta: 5000, presentation: { started: false, waited: 0 }, usable: false });
    expect(launched).toEqual({ began: now, presentation: { started: false, waited: 0 }, expired: false });
    const waiting = advanceCompanionPlayPresentation({ now: now + 50, began: launched.began, delta: 50, presentation: launched.presentation, usable: false });
    const paused = advanceCompanionPlayPresentation({ now: now + 5000, began: waiting.began, delta: 0, presentation: waiting.presentation, usable: false });
    expect(paused.presentation).toEqual({ started: false, waited: 50 }); expect(paused.expired).toBe(false);
    expect(c.d.completed()).toEqual([]);
  });
});

describe("157 existing real priority and owner cancellation retain authority", () => {
  it("rejects the prior beat after its actual completion without modifying the next owner", () => {
    const c = offered([pose("stretch"), pose("shake")]); c.s.now += 900; c.s.brain.activeMs = c.s.now; c.d.complete(c.p.meta);
    const next = c.d.next(c.s); expect(next?.meta.beat).toBe(1); expect(rowOf(c)).toBeUndefined();
    if (!next?.action) throw Error("required next source was not offered");
    expect(c.d.finitePosePresentation(next.meta, next.action.kind)?.row).toBe(17);
    c.d.resolve(c.p.meta, false); expect(c.d.owns(next.meta)).toBe(true); expect(c.d.completed()).toEqual([]);
  });
  it.each(["cancel", "accepted-manual-input"])("revokes a waiting source through the existing %s lifecycle API", gate => {
    const c = offered([pose("stretch")]), deadline = c.d.progressDeadline();
    if (gate === "accepted-manual-input") expect(c.d.interruptForPetting(c.s)).toBe(true); else c.d.cancel();
    expect(c.d.current()).toBeUndefined(); expect(c.d.owns(c.p.meta)).toBe(false); expect(rowOf(c)).toBeUndefined();
    c.d.complete(c.p.meta); expect(c.d.completed()).toEqual([]); expect(c.d.progressDeadline()).toBe(deadline);
  });
  it("does not admit anything while OFF and a new controller cannot adopt the disposed controller's source", () => {
    const c = offered([pose("stretch")]); c.s.preferences.enabled = false;
    expect(c.d.next(c.s)).toBeUndefined();
    // OFF disposes the component effect and stops its tick. A new director
    // owns no old source; next() returning undefined is not a cancellation ACK.
    const replacement = createCompanionPersonalityDirector([c.authored]);
    expect(replacement.finitePosePresentation(c.p.meta, "stretch")).toBeUndefined();
    expect(replacement.next(c.s)).toBeUndefined(); expect(c.d.completed()).toEqual([]); expect(replacement.completed()).toEqual([]);
  });
  it("personality replacement invalidates the old serial and its later failure cannot touch the new entry", () => {
    const c = offered([pose("stretch")]); c.s.preferences.personality = "sleepy"; c.s.now += 50;
    const next = c.d.next(c.s); expect(next?.meta.id).toBe("entry-sleepy"); expect(rowOf(c)).toBeUndefined();
    c.d.resolve(c.p.meta, false); expect(c.d.entryReady()).toBe(false); expect(c.d.completed()).toEqual([]);
  });
  it.each(["go", "wash", "sleep", "food", "tv-contact"])("keeps actual %s work on its original physical/care clock", gate => {
    const steps: SceneBeat[] = gate === "go" ? [{ kind: "go", target: "floor" }]
      : gate === "wash" ? [{ kind: "wash", ms: 2000 }]
      : gate === "sleep" ? [{ kind: "sleep", ms: 2500 }]
      : gate === "food" ? [{ kind: "food", mode: "eat" }]
      : [{ kind: "tv", state: "nature" }];
    const c = offered(steps, s => {
      if (gate === "wash") s.world = { ...s.world, x: 570, y: pad.y, platformId: pad.id };
      if (gate === "sleep") { s.brain.energy = .1; s.world = { ...s.world, x: 170, y: sofa.y, platformId: sofa.id }; }
      if (gate === "food") { s.brain.hunger = .6; s.world.foods = [{ id: "actual-meal-fixture", kind: "carrot", x: s.world.x, y: s.world.y, platformId: s.world.platformId }]; }
      if (gate === "tv-contact") s.world.x = 650;
    });
    expect(c.p.meta.command.kind).toBe(gate === "tv-contact" ? "tv" : gate);
    expect(rowOf(c)).toBeUndefined();
    if (gate === "food") {
      expect(c.p.delegate).toEqual({ kind: "food", mode: "eat" });
      expect(c.d.finitePosePresentation(c.p.meta, "eat")).toBeUndefined();
    }
    else expect(c.p.action).toBeTruthy();
    if (gate === "go") expect(["walk", "jump"]).toContain(c.p.action?.kind);
    if (gate === "wash") expect(c.p.action).toMatchObject({ kind: "play", play: "groom", duration: 2000 });
    if (gate === "sleep") expect(c.p.action).toMatchObject({ kind: "sleep", duration: 2500 });
    if (gate === "tv-contact") expect(c.p.meta.interactionContact).toEqual({ x: 650, y: 570 });
  });
  it("an actual manual wash replaces the waiting owner and excludes even its later required basic recovery pose", () => {
    const c = offered([pose("stretch")]); c.s.preferences.personality = "sleepy";
    c.s.world = { ...c.s.world, x: 570, y: pad.y, platformId: pad.id }; c.s.preferences.roam = false; c.s.now += 50;
    expect(c.d.startManualWash(c.s)).toBe(true); expect(c.d.manualWash()).toBe(true); expect(rowOf(c)).toBeUndefined();
    let recovery: PersonalitySceneProposal | undefined;
    for (let i = 0; i < 8 && c.d.active(); i++) {
      const next = c.d.next(c.s); if (!next) continue;
      if (next.meta.command.kind === "pose" && next.meta.command.pose === "stretch") { recovery = next; break; }
      if (!next.action) throw Error("manual care action not offered");
      c.s.now += next.action.duration; c.s.brain.activeMs = c.s.now;
      if (next.meta.command.kind === "wash") c.d.resolve(next.meta, true, undefined, c.s.now);
      else { if (["walk", "jump"].includes(next.action.kind)) c.s.world = { ...c.s.world, ...next.action.target }; c.d.complete(next.meta); }
    }
    expect(recovery?.action?.kind).toBe("stretch");
    if (!recovery?.action) throw Error("manual wash recovery not reached");
    expect(c.d.finitePosePresentation(recovery.meta, recovery.action.kind)).toBeUndefined();
    expect(c.d.manualWash()).toBe(true); expect(c.d.completed()).toEqual([]);
  });
  it.each(["routine-meal", "routine-nap"])("a real urgent %s replacement cannot inherit or wait for an old decoded basic source", id => {
    const c = offered([pose("stretch")]);
    if (id === "routine-meal") { c.s.brain.hunger = .85; c.s.world.foods = [{ id: "urgent-food", kind: "carrot", x: c.s.world.x, y: c.s.world.y, platformId: floor.id }]; }
    else c.s.brain.energy = .1;
    const care: PersonalitySceneRecipe = { id, label: "actual care priority", personality: "curious", major: true, triggers: [],
      steps: id === "routine-meal" ? [{ kind: "food", mode: "eat" }] : [{ kind: "sleep", ms: 2500 }, { kind: "pose", pose: "stretch", ms: 900 }] };
    expect(c.d.startRoutine(care, c.s.now, id === "routine-meal" ? "urgent-food" : undefined)).toBe(true);
    expect(rowOf(c)).toBeUndefined(); c.d.resolve(c.p.meta, false); expect(c.d.current()?.id).toBe(id);
    const next = c.d.next(c.s); expect(next?.meta.command.kind).toBe(id === "routine-meal" ? "food" : "sleep");
    expect(c.d.completed()).toEqual([]);
    if (id === "routine-nap") {
      if (!next?.action) throw Error("urgent rest action missing");
      c.s.now += next.action.duration; c.s.brain.activeMs = c.s.now; c.d.complete(next.meta);
      const waking = c.d.next(c.s); expect(waking?.action?.kind).toBe("stretch");
      if (!waking?.action) throw Error("urgent waking source missing");
      expect(c.d.finitePosePresentation(waking.meta, waking.action.kind)).toBeUndefined();
    }
  });
});


describe("157 readiness keeps the original current-owner lifetime limits", () => {
  // Existing model movement API, not a browser/paint completion. The actual
  // native factory must independently observe the corresponding body cells.
  function longApproach() {
    const c = offered([{ kind: "go", target: "floor" }, pose("stretch")], s => {
      s.world = { ...s.world, width: 3700, platforms: [{ ...floor, width: 3400 }, sofa, pad] };
      s.home.floor = { x: 3000, y: floor.y, platformId: floor.id };
    });
    const started = c.s.now;
    expect(c.p.action?.kind).toBe("walk");
    for (let elapsed = 4000; elapsed <= 56000; elapsed += 4000) {
      c.s.now = started + elapsed; c.s.brain.activeMs = c.s.now; c.s.world.x += 100;
      c.d.observeProgress({ now: c.s.now, active: true, point: c.s.world });
      const hop = c.d.next(c.s); expect(hop?.meta.command).toMatchObject({ kind: "go", target: "floor" });
      expect(hop?.action?.kind).toBe("walk"); expect(c.d.current()?.id).toBe(c.authored.id);
    }
    c.s.now = started + 59000; c.s.brain.activeMs = c.s.now; c.s.world.x = 3000;
    c.d.observeProgress({ now: c.s.now, active: true, point: c.s.world });
    const p = c.d.next(c.s); expect(p?.meta.command).toEqual(pose("stretch"));
    if (!p?.action) throw Error("actual post-approach source not offered");
    return { ...c, p, started };
  }
  it("exposes the existing7500ms boundary without advancing it through readiness reads", () => {
    const c = offered([pose("stretch")]), started = c.s.now;
    const subject = c.d.finitePosePresentation(c.p.meta, "stretch");
    expect(subject).toEqual({ row: 16, expiresAt: started + 7500 });
    const progress = c.d.progressDeadline();
    for (const activeMs of [started + 600, started + 900, started + 7499, started + 7500]) {
      c.s.brain.activeMs = activeMs;
      expect(c.d.finitePosePresentation(c.p.meta, "stretch")).toEqual(subject);
      expect(activeMs > subject!.expiresAt).toBe(false); expect(c.d.owns(c.p.meta)).toBe(true);
    }
    expect(c.d.progressDeadline()).toBe(progress); expect(c.d.completed()).toEqual([]);
    c.s.brain.activeMs = started + 7501;
    expect(c.s.brain.activeMs > subject!.expiresAt).toBe(true);
    // This is the host's existing failure API. Equality is still allowed;
    // exceeding the boundary is cancellation, never a successful completion.
    c.d.resolve(c.p.meta, false, undefined, c.s.brain.activeMs);
    c.d.complete(c.p.meta); expect(c.d.completed()).toEqual([]); expect(c.d.active()).toBe(false);
  });
  it("keeps the existing60000ms owner limit after real model approach progress", () => {
    const c = longApproach(), subject = c.d.finitePosePresentation(c.p.meta, "stretch");
    expect(subject).toEqual({ row: 16, expiresAt: c.started + 60000 });
    expect(subject!.expiresAt).toBeLessThan(c.s.now + 7500); expect(c.p.action!.duration).toBe(900);
    const ready = advanceCompanionPlayPresentation({ now: c.s.now + 600, began: c.s.now, delta: 600, presentation: { started: false, waited: 0 }, usable: true });
    expect(ready.presentation).toEqual({ started: true, waited: 600 });
    expect(ready.began + c.p.action!.duration).toBeGreaterThan(subject!.expiresAt);
    // Keep checking after first readiness, including the would-be final tick.
    // Neither a ready texture nor the finite playback may refill owner time.
    for (const activeMs of [c.started + 59600, c.started + 60000]) {
      c.s.brain.activeMs = activeMs; expect(c.d.finitePosePresentation(c.p.meta, "stretch")).toEqual(subject);
      expect(activeMs > subject!.expiresAt).toBe(false);
    }
    c.s.brain.activeMs = c.started + 60001;
    expect(c.s.brain.activeMs > subject!.expiresAt).toBe(true);
    c.d.resolve(c.p.meta, false, undefined, c.s.brain.activeMs);
    c.d.complete(c.p.meta); expect(c.d.completed()).toEqual([]); expect(rowOf(c)).toBeUndefined();
  });
  it("does not mistake a new current owner for the waiting source at its old expiry", () => {
    const c = offered([pose("stretch")]), previous = c.d.finitePosePresentation(c.p.meta, "stretch");
    expect(previous).toBeDefined();
    const care: PersonalitySceneRecipe = { id: "routine-meal", label: "actual urgent replacement", personality: "curious", major: true, triggers: [], steps: [{ kind: "food", mode: "eat" }] };
    expect(c.d.startRoutine(care, c.s.now, "urgent-real-food")).toBe(true);
    expect(c.d.finitePosePresentation(c.p.meta, "stretch")).toBeUndefined();
    c.d.resolve(c.p.meta, false, undefined, previous!.expiresAt + 1);
    expect(c.d.current()).toMatchObject({ id: "routine-meal", beat: 0, itemId: "urgent-real-food" });
    expect(c.d.completed()).toEqual([]);
  });
});
