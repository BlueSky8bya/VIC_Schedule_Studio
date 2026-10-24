import { describe, expect, it } from "vitest";
import { createBrain, type CompanionAction, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneBeat, type PersonalitySceneInput, type PersonalitySceneProposal } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe, type SceneBeat } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { advanceCompanionPlayPresentation, COMPANION_PLAY_PRESENTATION_WAIT_MS } from "@/lib/ui/viewer-companion/play-presentation";
import { createCompanionRoutineArbiter } from "@/lib/ui/viewer-companion/routine-arbiter";
import type { CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";

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

describe("same-owner play preparation during actual required travel", () => {
  const go: SceneBeat = { kind: "go", target: "floor" };
  const local: SceneBeat = { kind: "go", target: "local-floor" };
  const groom: SceneBeat = { kind: "pose", pose: "groom" };
  const chain = (tail: readonly SceneBeat[] = [local, groom]) => offered([go, ...tail]);
  const upcoming = (c: ReturnType<typeof chain>, meta = c.p.meta, kind = c.p.action!.kind,
    preferences = c.s.preferences, at = c.s.now) => c.d.imminentPlay(meta, kind, preferences, at);

  it("prepares only the closest required play beyond consecutive required go steps", () => {
    const c = chain([local, groom, { kind: "pose", pose: "bow" }]);
    expect(c.p.action?.kind).toBe("walk"); expect(c.p.meta.travel).toBe(true);
    const before = { current: c.d.current(), deadline: c.d.progressDeadline(), completed: c.d.completed() };
    expect(upcoming(c)).toBe("groom"); expect(upcoming(c)).toBe("groom");
    expect({ current: c.d.current(), deadline: c.d.progressDeadline(), completed: c.d.completed() }).toEqual(before);
  });
  it("offers preparation before a cold2650ms transfer without extending the1200ms onset wait", () => {
    const c = chain(), requestedAt = c.s.now;
    expect(upcoming(c)).toBe("groom");
    // Real director travel, with actual arrival observations and unchanged
    // scene completion rules. This models the measured latency, not pixels.
    for (let turn = 0; turn < 6 && c.p.meta.command.kind === "go"; turn++) {
      if (!c.p.action) throw Error("Required actual route missing");
      c.s.now += c.p.action.duration; c.s.brain.activeMs = c.s.now;
      c.s.world = { ...c.s.world, ...c.p.action.target };
      c.d.observeProgress({ now: c.s.now, active: true, point: c.s.world }); c.d.complete(c.p.meta);
      const next = c.d.next(c.s); if (!next) throw Error("Required play missing after actual travel"); c.p = next;
    }
    expect(c.p.action?.play).toBe("groom");
    const poseAt = c.s.now, readyAt = requestedAt+2650;
    expect(readyAt).toBeLessThan(poseAt+COMPANION_PLAY_PRESENTATION_WAIT_MS);
    let began = poseAt, presentation = { started: false, waited: 0 };
    for (let at = poseAt; at <= Math.max(poseAt, readyAt)+50; at += 50) {
      const result = advanceCompanionPlayPresentation({ now: at, began, delta: 50, presentation, usable: at >= readyAt });
      expect(result.expired).toBe(false); began = result.began; presentation = result.presentation;
      if (presentation.started) break;
    }
    expect(presentation.started).toBe(true); expect(c.p.action?.duration).toBe(1880);
    expect(c.d.completed()).toEqual([]); expect(COMPANION_PLAY_PRESENTATION_WAIT_MS).toBe(1200);
  });
  it.each([
    [{ kind: "go", target: "local-floor", optional: true }, groom],
    [{ kind: "pose", pose: "groom", optional: true }],
    [{ kind: "pose", pose: "stretch" }, groom],
    [{ kind: "watch", ms: 1400 }, groom],
    [{ kind: "light", lit: false, optional: true }, groom],
    [{ kind: "pose", pose: "groom", audience: true }],
    [{ kind: "pose", pose: "cheer-rehearsal" }],
  ] as readonly (readonly SceneBeat[])[])("does not look past a barrier in %j", (...tail) => {
    // it.each spreads each row; the real recipe includes every barrier.
    const c = chain(tail); expect(upcoming(c)).toBeUndefined();
  });
  it.each(["id", "serial", "beat", "target", "optional", "audience", "travel", "routine", "manual", "kind"])("rejects %s metadata mismatch without changing ownership", mismatch => {
    const c = chain(), meta: PersonalitySceneBeat = { ...c.p.meta, command: { ...c.p.meta.command } };
    if (mismatch === "id") meta.id = "another-scene";
    if (mismatch === "serial") meta.serial++;
    if (mismatch === "beat") meta.beat++;
    if (mismatch === "target") meta.command = { kind: "go", target: "outside" };
    if (mismatch === "optional") meta.command = { ...meta.command, optional: true };
    if (mismatch === "audience") meta.command = { ...meta.command, audience: true };
    if (mismatch === "travel") delete meta.travel;
    if (mismatch === "routine") meta.routine = true;
    if (mismatch === "manual") meta.manual = true;
    expect(upcoming(c, meta, mismatch === "kind" ? "look" : c.p.action!.kind)).toBeUndefined();
    expect(c.d.owns(c.p.meta)).toBe(true); expect(c.d.completed()).toEqual([]);
  });
  it.each(["disabled", "roam-off", "personality", "expired", "NaN", "cancelled"])("does not prepare for %s ownership", change => {
    const c = chain(), preferences = { ...c.s.preferences };
    if (change === "disabled") preferences.enabled = false;
    if (change === "roam-off") preferences.roam = false;
    if (change === "personality") preferences.personality = "homebody";
    if (change === "cancelled") c.d.cancel();
    const at = change === "expired" ? c.s.now+60001 : change === "NaN" ? NaN : c.s.now;
    expect(upcoming(c, c.p.meta, c.p.action!.kind, preferences, at)).toBeUndefined();
    expect(c.d.completed()).toEqual([]);
  });
  it("prepares the same allowed fallback that actual pose admission uses", () => {
    const c = chain([{ kind: "pose", pose: "pounce" }]);
    expect(upcoming(c)).toBe("pounce");
    expect(upcoming(c, c.p.meta, c.p.action!.kind, { ...c.s.preferences, jump: false })).toBe("bow");
  });
});

// Real arbiter recipe, director route endpoints and wash ACK. These model
// tests do not certify browser pixels or substitute for the original141 case.
function automaticWashRecovery(personality: CompanionPersonality = "sleepy") {
  const s = context(); s.preferences.personality = personality;
  const d = createCompanionPersonalityDirector([]), arbiter = createCompanionRoutineArbiter();
  const entry = d.next(s)!; d.complete(entry.meta); s.now += entry.action!.duration;
  const input = () => ({ ...s, active: true, entryReady: d.entryReady(), canOuting: false });
  arbiter.next(input()); arbiter.observe("ate", s.now); s.now += 50;
  const wash = arbiter.next(input()); expect(wash?.kind).toBe("wash");
  if (!wash || !d.startRoutine(wash.recipe, s.now)) throw Error("Actual automatic wash not admitted");
  let acknowledged = false, exited = false;
  for (let turn = 0; turn < 16; turn++) {
    const p = d.next(s); if (!p?.action) throw Error("Automatic wash lost its required physical stage");
    if (p.meta.command.kind === "pose") {
      expect(acknowledged).toBe(true); expect(exited).toBe(true);
      expect(s.world.platformId).toBe(floor.id); expect(p.meta).toMatchObject({ id: "routine-wash", routine: true, beat: 3 });
      return { s, d, p, wash };
    }
    expect(d.finitePosePresentation(p.meta, p.action.kind)).toBeUndefined();
    s.now += p.action.duration; s.brain.activeMs = s.now;
    if (p.meta.command.kind === "wash") {
      expect(s.world.platformId).toBe(pad.id); expect(p.action.play).toBe("groom");
      d.complete(p.meta); expect(d.current()?.beat).toBe(1); // Elapsed action alone is no wash ACK.
      d.resolve(p.meta, true, undefined, s.now); acknowledged = true;
    } else {
      expect(p.meta.command.kind).toBe("go"); expect(["walk", "jump"]).toContain(p.action.kind);
      s.world = { ...s.world, ...p.action.target };
      if (acknowledged && s.world.platformId === floor.id) exited = true;
      d.complete(p.meta);
    }
  }
  throw Error("Actual automatic wash never reached its required recovery");
}

describe("automatic wash terminal basic preparation", () => {
  it.each([["sleepy", "stretch", 16], ["mischievous", "shake", 17]] as const)("prepares %s %s only after actual wash and required floor exit", (personality, kind, row) => {
    const c = automaticWashRecovery(personality), deadline = c.d.progressDeadline();
    expect(c.p.action).toMatchObject({ kind, duration: 900 });
    expect(c.d.finitePosePresentation(c.p.meta, kind)?.row).toBe(row);
    expect(c.d.completed()).toEqual([]); expect(c.d.progressDeadline()).toBe(deadline);
  });
  it.each([600, 900])("retains the original900ms recovery after %ims cold preparation", delay => {
    const c = automaticWashRecovery(), initial = c.s.now, deadline = c.d.progressDeadline();
    let began = initial, presentation = { started: false, waited: 0 };
    for (let elapsed = 50; elapsed <= delay; elapsed += 50) {
      expect(c.d.finitePosePresentation(c.p.meta, "stretch")?.row).toBe(16);
      const result = advanceCompanionPlayPresentation({ now: initial+elapsed, began, delta: 50, presentation, usable: false });
      began = result.began; presentation = result.presentation;
      expect(result.expired).toBe(false); expect(initial+elapsed-began).toBe(0); expect(c.d.completed()).toEqual([]);
    }
    const ready = advanceCompanionPlayPresentation({ now: initial+delay, began, delta: 0, presentation, usable: true });
    expect(ready.presentation).toEqual({ started: true, waited: delay }); expect(ready.began).toBe(initial+delay);
    expect(c.p.action!.duration).toBe(900); expect(c.d.progressDeadline()).toBe(deadline);
    c.s.now = ready.began+900; c.d.observeProgress({ now: c.s.now, active: true, point: c.s.world }); c.d.complete(c.p.meta);
    expect(c.d.completed()).toEqual(["routine-wash"]);
  });
  it.each(["id", "serial", "beat", "routine", "manual", "travel", "optional", "kind"])("rejects a %s mismatch without losing the current recovery", mismatch => {
    const c = automaticWashRecovery(), meta: PersonalitySceneBeat = { ...c.p.meta, command: { ...c.p.meta.command } };
    if (mismatch === "id") meta.id = "another-owner"; if (mismatch === "serial") meta.serial++;
    if (mismatch === "beat") meta.beat--; if (mismatch === "routine") delete meta.routine;
    if (mismatch === "manual") meta.manual = true; if (mismatch === "travel") meta.travel = true;
    if (mismatch === "optional") meta.command = { ...meta.command, optional: true };
    expect(c.d.finitePosePresentation(meta, mismatch === "kind" ? "look" : "stretch")).toBeUndefined();
    expect(c.d.owns(c.p.meta)).toBe(true); expect(c.d.completed()).toEqual([]);
  });
  it("cancels a permanently cold recovery at the existing1200ms bound without completion", () => {
    const c = automaticWashRecovery(), deadline = c.d.progressDeadline();
    expect(c.d.finitePosePresentation(c.p.meta, "stretch")?.row).toBe(16);
    const waiting = advanceCompanionPlayPresentation({ now: c.s.now+1200, began: c.s.now, delta: 1200, presentation: { started: false, waited: 0 }, usable: false });
    expect(waiting.expired).toBe(true); c.d.resolve(c.p.meta, false, undefined, c.s.now+1200);
    expect(c.d.finitePosePresentation(c.p.meta, "stretch")).toBeUndefined(); expect(c.d.completed()).toEqual([]);
    expect(c.d.progressDeadline()).toBe(deadline);
  });
  it("urgent care replaces the recovery without inheriting its source wait", () => {
    const c = automaticWashRecovery(); c.d.cancel(); c.s.brain.hunger = .85;
    const urgent = recipe([{ kind: "food", mode: "eat" }], { id: "routine-meal", personality: "sleepy" });
    expect(c.d.startRoutine(urgent, c.s.now)).toBe(true);
    expect(c.d.finitePosePresentation(c.p.meta, "stretch")).toBeUndefined(); expect(c.d.completed()).toEqual([]);
  });
});

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
    expect(c04?.steps[1]).toEqual({ kind: "watch", ms: 1400, at: "tv" });
    expect(c04?.steps[3]).toEqual({ kind: "watch", ms: 3000 });
    expect(c04?.steps.at(-1)).toMatchObject({ kind: "pose", pose: "bow", optional: true });
    const c = offered([pose("stretch")], () => {}, { id: "another-required-basic-source" });
    expect(rowOf(c)).toBe(16);
  });
  it.each([1400, 3000])("recognizes actual required TV watch %ims after the director binds its real subject", ms => {
    const c = tvWatch(ms);
    expect(c.p.action).toMatchObject({ kind: "look", duration: ms });
    expect(c.p.meta.command).toEqual({ kind: "watch", ms }); expect(rowOf(c)).toBe(1);
  });
  it("compares at the actual TV before taking the existing sofa route for its second watch", () => {
    const c = offered([{ kind: "watch", ms: 1400, at: "tv" }, { kind: "go", target: "sofa" }, { kind: "watch", ms: 3000 }], s => {
      s.world.x = 650; s.tv = "nature";
    }, { triggers: ["tv"] });
    expect(c.p.action).toMatchObject({ kind: "look", duration: 1400, target: { x: 650, platformId: floor.id } });
    expect(c.p.meta.travel).not.toBe(true); expect(rowOf(c)).toBe(1);
    expect(c.d.finitePosePresentation({ ...c.p.meta, command: { kind: "watch", ms: 1400 } }, "look")).toBeUndefined();
    c.s.now += 1400; c.d.complete(c.p.meta);
    const sofaRoute = c.d.next(c.s);
    expect(sofaRoute?.meta.travel).toBe(true);
    expect(sofaRoute?.meta.goal?.platformId).toBe(sofa.id);
  });
  it("approaches the actual TV rather than granting a near-TV watch anywhere on the same floor", () => {
    const c = offered([{ kind: "watch", ms: 1400, at: "tv" }], s => { s.tv = "nature"; }, { triggers: ["tv"] });
    expect(c.p.meta.travel).toBe(true);
    expect(c.p.action?.target).toMatchObject({ x: 650, platformId: floor.id });
    expect(rowOf(c)).toBeUndefined();
  });
  it.each(["off", "manual", "missing", "body-only"])("never certifies a TV-front watch with %s", gate => {
    const s = context(), d = createCompanionPersonalityDirector([recipe([{ kind: "watch", ms: 1400, at: "tv" }], { triggers: ["tv"] })], () => .5);
    s.world.x = 650; s.tv = "nature"; enter(d,s);
    if (gate === "off") s.tv = "off";
    if (gate === "manual") s.canTv = false;
    if (gate === "missing") s.home.tv = undefined;
    if (gate === "body-only") s.world.platforms = s.world.platforms.map(p => p.id === floor.id ? { ...p, bodyOnly: true } : p);
    const p = d.next(s);
    expect(p?.action && d.finitePosePresentation(p.meta,p.action.kind)).toBeFalsy();
    expect(d.completed()).not.toContain("required-basic-source-fixture");
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
