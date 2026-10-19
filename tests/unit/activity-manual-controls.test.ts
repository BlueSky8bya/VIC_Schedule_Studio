import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics/guard", () => ({ skipAnalyticsClient: () => false }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

async function fixture() {
  vi.useFakeTimers();
  const handlers = new Map<string, (event: unknown) => void>();
  const fetcher = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("document", {
    addEventListener: (name: string, listener: (event: unknown) => void) => handlers.set(name, listener),
    visibilityState: "visible"
  });
  vi.stubGlobal("window", {
    addEventListener: () => {}, setTimeout, clearTimeout,
    sessionStorage: { getItem: () => null }
  });
  const logger = await import("@/lib/activity/client");
  logger.startClickTracking();
  const click = (manual: boolean, purple: boolean, pressed = false, id = "companion-food-spawn", option: string | null = null) => {
    const element = {
      hasAttribute: (name: string) => manual && name === "data-activity-manual",
      getAttribute: (name: string) => name === "data-act" ? id : name === "data-act-opt" ? option : name === "aria-pressed" ? String(pressed) : null,
      matches: () => purple && !pressed
    };
    handlers.get("click")!({ target: { closest: () => element } });
  };
  const events = async () => {
    await vi.advanceTimersByTimeAsync(15000);
    return fetcher.mock.calls.flatMap(([, init]) => JSON.parse(init.body).events);
  };
  const range = (name: string, id = "companion-radio-volume", disabled = false, manual = false) => {
    const element = {
      tagName: "INPUT",
      hasAttribute: (attribute: string) => attribute === "disabled" && disabled || attribute === "data-activity-manual" && manual,
      getAttribute: (attribute: string) => attribute === "type" ? "range" : attribute === "data-act" ? id : null,
      matches: () => false
    };
    handlers.get(name)?.({ target: { ...element, closest: () => element } });
  };
  return { logger, click, range, events };
}

describe("completed companion input owns its activity event", () => {
  it("captures visible activity and new personality choices while completed toy gestures count once without IDs", async () => {
    const f = await fixture();
    f.click(false, false, false, "companion-active-visible", "off");
    for (const personality of ["gourmet", "performer", "homebody"]) f.click(false, false, false, "companion-personality", personality);
    for (const target of ["companion-home-toys", "companion-toy-grab", "companion-toy-drop", "companion-toy-return"]) {
      f.click(true, false, false, target);
      f.logger.logActivity("ui.click", { target, meta: { toyId: "private-toy-id", personality: "private-trait", date: "2026-10-19", count: 12 }, durMs: 1000 });
      f.click(true, false, false, target);
    }
    const events = await f.events();
    expect(events.map((event: { target: string }) => event.target)).toEqual([
      "companion-active-visible#off", "companion-personality#gourmet", "companion-personality#performer", "companion-personality#homebody",
      "companion-home-toys", "companion-toy-grab", "companion-toy-drop", "companion-toy-return"
    ]);
    expect(events.every((event: { meta: unknown; durMs: unknown }) => event.meta == null && event.durMs == null)).toBe(true);
    for (const value of ["private-toy-id", "private-trait", "2026-10-19"]) expect(JSON.stringify(events)).not.toContain(value);
  });
  it("manual controls suppress synthetic clicks; a committed gesture counts once", async () => {
    const f = await fixture();
    f.click(true, false); // cancelled/incomplete pointer gesture has no event
    expect(await f.events()).toEqual([]);
    f.logger.logActivity("ui.click", { target: "companion-drag" });
    f.click(true, false);
    expect((await f.events()).map((e: { target: string }) => e.target)).toEqual(["companion-drag"]);
  });
  it("clearing a purple souvenir never counts as a real human vote", async () => {
    const f = await fixture();
    f.click(false, true, false, "event-heart");
    f.logger.logActivity("ui.click", { target: "companion-heart-clear" });
    expect((await f.events()).map((e: { target: string }) => e.target)).toEqual(["companion-heart-clear"]);
  });
  it("the physical gift's successful manual opening counts once while an ordinary settings gift uses delegation", async () => {
    const f = await fixture();
    f.click(true, false, false, "companion-gift-open");
    expect(await f.events()).toEqual([]);
    f.logger.logActivity("ui.click", { target: "companion-gift-open" });
    f.click(true, false, false, "companion-gift-open");
    f.click(false, false, false, "companion-gift-open");
    expect((await f.events()).map((event: { target: string }) => event.target)).toEqual(["companion-gift-open", "companion-gift-open"]);
  });
  it("TV and lamp controls count each direct operation once with fixed options", async () => {
    const f = await fixture();
    for (const [action, options] of [["companion-home-tv", ["on", "next", "off"]], ["companion-home-light", ["on", "off"]]] as const) for (const option of options) f.click(false, false, false, action, option);
    const events = await f.events();
    expect(events.map((event: { target: string }) => event.target)).toEqual(["companion-home-tv#on", "companion-home-tv#next", "companion-home-tv#off", "companion-home-light#on", "companion-home-light#off"]);
    expect(events.every((event: { meta?: unknown }) => event.meta == null)).toBe(true);
  });
  it("ordinary controls and an already selected human heart still count normally", async () => {
    const f = await fixture();
    f.click(false, false);
    f.click(false, true, true, "event-heart");
    expect((await f.events()).map((e: { target: string }) => e.target)).toEqual(["companion-food-spawn", "event-heart"]);
  });

  it("counts a committed pointer or keyboard range change once without its value or following click", async () => {
    const f = await fixture();
    f.range("click"); f.range("input");
    expect(await f.events()).toEqual([]);
    f.range("change"); f.range("click");
    f.range("change", "companion-sound-volume");
    f.range("input", "companion-collection-page");
    f.range("change", "companion-collection-page"); f.range("click", "companion-collection-page");
    f.range("change", "companion-radio-volume", true);
    f.range("change", "companion-radio-volume", false, true);
    f.range("change", "sound-volume"); // Unrelated range behavior is unchanged.
    expect((await f.events()).map((event: { target: string }) => event.target)).toEqual(["companion-radio-volume", "companion-sound-volume", "companion-collection-page"]);
  });

  it("removes personal companion fields before the request, while preserving ordinary activity metadata", async () => {
    const f = await fixture();
    const canary = "synthetic-private@example.test";
    f.logger.logActivity("ui.click", { target: "companion-food-spawn#apple", meta: { title: canary, count: 180, on: true }, durMs: 9876 });
    f.logger.logActivity("ui.click", { target: "settings-companion-tab#personality", meta: { favorite: "peach", on: true }, durMs: 9876 });
    f.logger.logActivity("ui.click", { target: `companion-unregistered-${canary}` });
    f.logger.logActivity("ui.click", { target: "open-day-visit", meta: { on: true }, durMs: 42 });
    const events = await f.events();
    expect(events).toEqual([
      { kind: "ui.click", target: "companion-food-spawn", meta: null, durMs: null, visitKey: null },
      { kind: "ui.click", target: "settings-companion-tab#personality", meta: null, durMs: null, visitKey: null },
      { kind: "ui.click", target: "open-day-visit", meta: { on: true }, durMs: 42, visitKey: null }
    ]);
    for (const value of [canary, "apple", "peach", "9876"]) expect(JSON.stringify(events)).not.toContain(value);
  });

  it("applies the same transport boundary to historical automatic companion aliases", async () => {
    const f = await fixture();
    for (const prefix of ["auto:", "auto:."]) {
      f.logger.logActivity("ui.click", { target: `${prefix}companion-enabled`, meta: { count: 180, on: true }, durMs: 9876 });
      f.logger.logActivity("ui.click", { target: `${prefix}companion-food-spawn#apple`, meta: { count: 180, on: true }, durMs: 9876 });
      f.logger.logActivity("ui.click", { target: `${prefix}companion-unregistered-sensitive@example.test`, meta: { count: 180 }, durMs: 9876 });
    }
    const events = await f.events();
    expect(events.map((event: { target: string }) => event.target)).toEqual(["companion-enabled", "companion-food-spawn", "companion-enabled", "companion-food-spawn"]);
    expect(events.every((event: { meta: unknown; durMs: unknown }) => event.meta === null && event.durMs === null)).toBe(true);
    for (const value of ["auto:", "apple", "sensitive@example.test", "9876", "180"]) expect(JSON.stringify(events)).not.toContain(value);
  });
});
