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
  const click = (manual: boolean, purple: boolean, pressed = false, id = "companion-food-spawn") => {
    const element = {
      hasAttribute: (name: string) => manual && name === "data-activity-manual",
      getAttribute: (name: string) => name === "data-act" ? id : name === "aria-pressed" ? String(pressed) : null,
      matches: () => purple && !pressed
    };
    handlers.get("click")!({ target: { closest: () => element } });
  };
  const events = async () => {
    await vi.advanceTimersByTimeAsync(15000);
    return fetcher.mock.calls.flatMap(([, init]) => JSON.parse(init.body).events);
  };
  return { logger, click, events };
}

describe("completed companion input owns its activity event", () => {
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
  it("ordinary controls and an already selected human heart still count normally", async () => {
    const f = await fixture();
    f.click(false, false);
    f.click(false, true, true, "event-heart");
    expect((await f.events()).map((e: { target: string }) => e.target)).toEqual(["companion-food-spawn", "event-heart"]);
  });
});
