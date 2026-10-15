import { describe, expect, it } from "vitest";
import { companionPremiereGeneration, companionPremiereItems, companionPremiereMoment, companionPremiereReturn, companionPremiereSourceStatus, isCompanionPremiereId, type CompanionPremiereCue, type CompanionPremiereItem } from "@/lib/ui/viewer-companion/premiere";

const revealAt = "2026-10-16T03:00:00.000Z";
const item: CompanionPremiereItem = { id: "public-teaser-a", revealAt, state: "masked" };
const cue: CompanionPremiereCue = { owner: "premiere-stage-test", generation: companionPremiereGeneration([item], 1), phase: "quake", target: 100_000, items: [item] };

describe("companion premiere handoff", () => {
  it("projects public presentation fields without passing event data or changing the caller", () => {
    const input = Object.freeze({ ...item, publicTitle: "sensitive-canary", event: { publicTitle: "must-not-travel" }, dateKey: "2026-10-16", tagIds: ["canary"] });
    const projected = companionPremiereItems([input]);
    expect(projected).toEqual([item]);
    expect(Object.keys(projected[0])).toEqual(["id", "revealAt", "state"]);
    expect(projected[0]).not.toBe(input);
    expect(input.publicTitle).toBe("sensitive-canary");
  });
  it("bounds ids and list size without accepting selector syntax, duplicates or malformed deadlines", () => {
    for (const id of ["", " ", 'a"] [data-private="x', "../a", "a".repeat(97)]) expect(isCompanionPremiereId(id)).toBe(false);
    expect(isCompanionPremiereId("00000000-0000-4000-8000-000000000001")).toBe(true);
    expect(companionPremiereItems([item, { ...item }, { ...item, id: "bad", revealAt: "not-a-time" }, { ...item, id: "released", revealAt: null, state: "released" }])).toEqual([item, { id: "released", revealAt: null, state: "released" }]);
    expect(companionPremiereItems(Array.from({ length: 201 }, (_, index) => ({ ...item, id: `item-${index}` })))).toHaveLength(200);
  });
  it("is independent of cohort order and publication state, while reschedules, replacement and reopening get new generations", () => {
    const second = { ...item, id: "public-teaser-b" };
    const current = companionPremiereGeneration([item, second], 1);
    expect(companionPremiereGeneration([second, { ...item, state: "released" }], 1)).toBe(current);
    expect(companionPremiereGeneration([{ ...item, revealAt: "2026-10-16T03:00:05Z" }, second], 1)).not.toBe(current);
    expect(companionPremiereGeneration([item], 1)).not.toBe(current);
    expect(companionPremiereGeneration([item, second], 2)).not.toBe(current);
    expect(companionPremiereGeneration([item], NaN)).toBe("");
    expect(companionPremiereGeneration([], 1)).toBe("");
  });
  it("enters from73 to69 seconds and completes before the existing68-second card gather", () => {
    expect(companionPremiereMoment(cue, 26_999)).toEqual({ mode: "prelude", progress: 0, late: false });
    expect(companionPremiereMoment(cue, 27_000)).toEqual({ mode: "enter", progress: 0, late: false });
    expect(companionPremiereMoment(cue, 29_000)).toEqual({ mode: "enter", progress: .5, late: false });
    expect(companionPremiereMoment(cue, 31_000)).toEqual({ mode: "join", progress: 1, late: true });
    expect(companionPremiereMoment({ ...cue, phase: "screen" }, 32_000)).toMatchObject({ mode: "join", progress: 1 });
  });
  it("keeps the entered source stable when other chain members arrive, publish or leave", () => {
    const other = { ...item, id: "later-teaser" };
    for (const members of [[item], [item, other], [{ ...item, state: "released" as const }], [other, item]]) {
      expect(companionPremiereSourceStatus(item, members)).toBe("same");
    }
    expect(companionPremiereSourceStatus(item, [other])).toBe("missing");
    expect(companionPremiereSourceStatus(item, [{ ...item, revealAt: "2026-10-16T03:05:00Z" }, other])).toBe("rescheduled");
    expect(companionPremiereSourceStatus(item, [{ ...item, revealAt: "2026-10-16T02:55:00Z" }])).toBe("rescheduled");
  });
  it("lands a late arrival in the present phase and never replays entry after joining or a clock correction", () => {
    expect(companionPremiereMoment({ ...cue, phase: "build" }, 50_000)).toEqual({ mode: "join", progress: 1, late: true });
    expect(companionPremiereMoment(cue, 29_000, true)).toEqual({ mode: "joined", progress: 1, late: false });
    expect(companionPremiereMoment(cue, 0, true)).toEqual({ mode: "joined", progress: 1, late: false });
    expect(companionPremiereMoment({ ...cue, phase: "waiting" }, 110_000, true).mode).toBe("joined");
  });
  it("stays quiet for disabled, invalid and empty inputs and an ordinary cancellation", () => {
    const idle = { mode: "idle", progress: 0, late: false };
    expect(companionPremiereMoment(null, 30_000)).toEqual(idle);
    for (const now of [NaN, Infinity, -Infinity]) expect(companionPremiereMoment(cue, now)).toEqual(idle);
    expect(companionPremiereMoment({ ...cue, target: NaN }, 30_000)).toEqual(idle);
    expect(companionPremiereMoment({ ...cue, items: [] }, 30_000)).toEqual(idle);
    expect(companionPremiereMoment({ ...cue, phase: "return" }, 30_000, true)).toEqual(idle);
    expect(companionPremiereMoment({ ...cue, phase: "idle" }, 30_000, true)).toEqual(idle);
  });
  it("retains one explicit released exit through return and idle, but consumes a token only once", () => {
    const exit = { token: 1, generation: cue.generation, id: item.id };
    const released: CompanionPremiereCue = { ...cue, items: [{ ...item, state: "released" }], exit };
    for (const phase of ["return", "idle"] as const) {
      const returning = { ...released, phase };
      expect(companionPremiereMoment(returning, 100_000)).toEqual({ mode: "return", progress: 1, late: false });
      expect(companionPremiereReturn(returning)).toEqual(exit);
      expect(companionPremiereReturn(returning, exit.token)).toBeNull();
    }
  });
  it("rejects masked, deleted, superseded and malformed return tokens", () => {
    const released: CompanionPremiereCue = { ...cue, items: [{ ...item, state: "released" }], exit: { token: 3, generation: cue.generation, id: item.id } };
    expect(companionPremiereReturn({ ...released, items: [item] })).toBeNull();
    expect(companionPremiereReturn({ ...released, items: [] })).toBeNull();
    expect(companionPremiereReturn({ ...released, generation: "new-opening" })).toBeNull();
    for (const token of [0, -1, NaN, Infinity, .5]) expect(companionPremiereReturn({ ...released, exit: { ...released.exit!, token } })).toBeNull();
    expect(companionPremiereReturn({ ...released, exit: { ...released.exit!, id: "another-public-event" } })).toBeNull();
  });
});
