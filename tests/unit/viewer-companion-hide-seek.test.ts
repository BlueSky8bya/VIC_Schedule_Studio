import { describe, expect, it } from "vitest";
import { COMPANION_HIDE_EMERGE_MS, COMPANION_HIDE_ENTER_MS, COMPANION_HIDE_FOUND_MS, COMPANION_HIDE_WAIT_MAX_MS, COMPANION_HIDE_WAIT_MIN_MS, createCompanionHideSeek } from "@/lib/ui/viewer-companion/hide-seek";

describe("local event hide-and-seek session", () => {
  it("starts idle, finishes a finite entry and requests no hidden work", () => {
    const seek = createCompanionHideSeek();
    expect(seek.sample(0)).toEqual({ token: null, phase: "idle", progress: 0, active: false });
    expect(seek.start("session-a", 100)).toBe(true);
    expect(seek.sample(100)).toEqual({ token: "session-a", phase: "entering", progress: 0, active: true });
    expect(seek.sample(450)).toMatchObject({ phase: "entering", progress: .5, active: true });
    expect(seek.sample(100 + COMPANION_HIDE_ENTER_MS)).toEqual({ token: "session-a", phase: "hidden", progress: 1, active: false });
  });
  it("waits quiescently until its chosen deadline, then emerges finitely without trapping the pet", () => {
    const seek = createCompanionHideSeek(); seek.start("session-a", 0, COMPANION_HIDE_WAIT_MIN_MS);
    const deadline = COMPANION_HIDE_ENTER_MS + COMPANION_HIDE_WAIT_MIN_MS;
    expect(seek.wakeIn(350)).toBeNull();
    for (const now of [700, 12000, deadline - 1]) expect(seek.sample(now)).toEqual({ token: "session-a", phase: "hidden", progress: 1, active: false });
    expect(seek.wakeIn(700)).toBe(COMPANION_HIDE_WAIT_MIN_MS); expect(seek.wakeIn(deadline - 1)).toBe(1);
    expect(seek.sample(deadline)).toEqual({ token: "session-a", phase: "emerging", progress: 0, active: true }); expect(seek.wakeIn(deadline)).toBeNull();
    expect(seek.sample(deadline + 350)).toMatchObject({ phase: "emerging", progress: .5, active: true });
    expect(seek.sample(deadline + COMPANION_HIDE_EMERGE_MS)).toEqual({ token: "session-a", phase: "done", progress: 1, active: false });
    expect(seek.sample(1e12)).toMatchObject({ phase: "done", active: false });
  });
  it("finds only the matching token and settles the reaction finitely", () => {
    const seek = createCompanionHideSeek(); seek.start("session-a", 0);
    expect(seek.find("other-event-session", 900)).toBe(false);
    expect(seek.sample(900).phase).toBe("hidden");
    expect(seek.find("session-a", 1000)).toBe(true);
    expect(seek.sample(1500)).toEqual({ token: "session-a", phase: "found", progress: .5, active: true });
    expect(seek.sample(1000 + COMPANION_HIDE_FOUND_MS)).toEqual({ token: "session-a", phase: "settled", progress: 1, active: false });
    expect(seek.sample(1e12)).toMatchObject({ phase: "settled", active: false });
  });
  it("allows an immediate native find during entry without waiting for its animation", () => {
    const seek = createCompanionHideSeek(); seek.start("session-a", 100);
    expect(seek.find("session-a", 120)).toBe(true);
    expect(seek.sample(120)).toMatchObject({ phase: "found", progress: 0, active: true });
    expect(seek.sample(1120)).toMatchObject({ phase: "settled", active: false });
  });
  it("does not restart entry or found reaction when the same bridge/session repeats", () => {
    const seek = createCompanionHideSeek(); seek.start("session-a", 0);
    expect(seek.start("session-a", 600)).toBe(false);
    expect(seek.sample(700)).toMatchObject({ phase: "hidden", active: false });
    seek.find("session-a", 800);
    expect(seek.find("session-a", 1500)).toBe(false);
    expect(seek.start("session-a", 1600)).toBe(false);
    expect(seek.sample(1800)).toMatchObject({ phase: "settled", active: false });
  });
  it("samples without consuming time or mutating the session while the caller's active clock is paused", () => {
    const seek = createCompanionHideSeek(); seek.start("session-a", 0);
    const halfway = seek.sample(350);
    for (let frame = 0; frame < 1000; frame++) expect(seek.sample(350)).toEqual(halfway);
    expect(seek.sample(700)).toMatchObject({ phase: "hidden", active: false });
    seek.find("session-a", 700);
    const found = seek.sample(900);
    for (let frame = 0; frame < 1000; frame++) expect(seek.sample(900)).toEqual(found);
    expect(seek.sample(1700)).toMatchObject({ phase: "settled", active: false });
  });
  it("rejects stale tokens after an explicit source/month/preference cancellation or new session", () => {
    const seek = createCompanionHideSeek(); seek.start("old", 0); seek.reset();
    expect(seek.find("old", 1000)).toBe(false);
    expect(seek.sample(1000).phase).toBe("idle");
    seek.start("new", 1000);
    expect(seek.find("old", 1100)).toBe(false);
    expect(seek.sample(1100)).toMatchObject({ token: "new", phase: "entering" });
    seek.reset(); seek.reset(); expect(seek.sample(1200).active).toBe(false);
  });
  it("bounds caller-selected waits and does not reroll a repeated session", () => {
    const low = createCompanionHideSeek(), high = createCompanionHideSeek();
    low.start("low", 0, -100); high.start("high", 0, 1e12);
    expect(low.wakeIn(700)).toBe(COMPANION_HIDE_WAIT_MIN_MS); expect(high.wakeIn(700)).toBe(COMPANION_HIDE_WAIT_MAX_MS);
    expect(high.start("high", 1000, 12000)).toBe(false); expect(high.wakeIn(1000)).toBe(COMPANION_HIDE_WAIT_MAX_MS - 300);
  });
  it("lets the matching find win until emergence starts, including while a deadline read is paused", () => {
    const early = createCompanionHideSeek(); early.start("early", 0, 12000);
    for (let sample = 0; sample < 1000; sample++) expect(early.wakeIn(1000)).toBe(11700);
    expect(early.find("other", 12699)).toBe(false); expect(early.find("early", 12699)).toBe(true);
    expect(early.wakeIn(12700)).toBeNull(); expect(early.sample(30000)).toMatchObject({ phase: "settled", active: false });
    const late = createCompanionHideSeek(); late.start("late", 0, 12000);
    expect(late.find("late", 12700)).toBe(false); expect(late.sample(12700).phase).toBe("emerging");
  });
  it("ignores invalid starts/finds and fails closed on an invalid read without erasing valid memory", () => {
    const seek = createCompanionHideSeek();
    expect(seek.start("", 0)).toBe(false); expect(seek.start(" ", 0)).toBe(false);
    expect(seek.start("a", NaN)).toBe(false); expect(seek.start("a", -1)).toBe(false); expect(seek.start("a", 0, NaN)).toBe(false);
    seek.start("a", 100);
    expect(seek.find("a", 99)).toBe(false); expect(seek.find("a", Infinity)).toBe(false);
    expect(seek.sample(NaN)).toEqual({ token: null, phase: "idle", progress: 0, active: false });
    expect(seek.sample(99).active).toBe(false);
    expect(seek.sample(800)).toEqual({ token: "a", phase: "hidden", progress: 1, active: false });
  });
});
