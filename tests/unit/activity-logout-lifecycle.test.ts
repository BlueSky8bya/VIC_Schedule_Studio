import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics/guard", () => ({ skipAnalyticsClient: () => false }));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

async function fixture() {
  vi.useFakeTimers();
  const documentListeners = new Map<string, (event?: unknown) => void>();
  const windowListeners = new Map<string, () => void>();
  // Keep the request pending: a later hide/blur must not resend this batch.
  const fetcher = vi.fn(() => new Promise(() => {}));
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("document", { visibilityState: "hidden", addEventListener: (name: string, listener: () => void) => documentListeners.set(name, listener) });
  vi.stubGlobal("window", { addEventListener: (name: string, listener: () => void) => windowListeners.set(name, listener), setTimeout, clearTimeout, sessionStorage: { getItem: () => "fixture|synthetic-visit" } });
  const logger = await import("@/lib/activity/client");
  logger.startClickTracking();
  const click = (id: string) => documentListeners.get("click")!({ target: { closest: () => ({
    hasAttribute: () => false, matches: () => false,
    getAttribute: (name: string) => name === "data-act" ? id : null
  }) } });
  return { logger, fetcher, click, documentListeners, windowListeners };
}

describe("final activity flush before either logout control changes session", () => {
  for (const target of ["logout", "io-logout"]) {
    it(`${target} immediately sends pending actions once with keepalive`, async () => {
      const f = await fixture();
      f.logger.logActivity("ui.click", { target: "companion-pet" });
      expect(f.fetcher).not.toHaveBeenCalled();
      f.click(target);
      expect(f.fetcher).toHaveBeenCalledTimes(1);
      const [, options] = f.fetcher.mock.calls[0] as unknown as [string, RequestInit];
      expect(options.keepalive).toBe(true);
      expect(JSON.parse(String(options.body)).events.map((event: { target: string }) => event.target)).toEqual(["companion-pet", target]);
      f.documentListeners.get("visibilitychange")!(); f.windowListeners.get("pagehide")!(); f.windowListeners.get("blur")!();
      await vi.advanceTimersByTimeAsync(15000);
      expect(f.fetcher).toHaveBeenCalledTimes(1);
    });
    it(`${target} keeps the full threshold batch alive when it is the twentieth event`, async () => {
      const f = await fixture();
      for (let index = 0; index < 19; index++) f.logger.logActivity("ui.click", { target: "companion-pet" });
      expect(f.fetcher).not.toHaveBeenCalled();
      f.click(target);
      expect(f.fetcher).toHaveBeenCalledTimes(1);
      const [, options] = f.fetcher.mock.calls[0] as unknown as [string, RequestInit];
      expect(options.keepalive).toBe(true);
      const events = JSON.parse(String(options.body)).events as { target: string }[];
      expect(events).toHaveLength(20); expect(events.at(-1)?.target).toBe(target);
      expect(events.every(event => !("flush" in event))).toBe(true);
      f.documentListeners.get("visibilitychange")!(); f.windowListeners.get("pagehide")!(); f.windowListeners.get("blur")!();
      await vi.advanceTimersByTimeAsync(15000);
      expect(f.fetcher).toHaveBeenCalledTimes(1);
    });
  }
  it("ordinary clicks retain batching instead of introducing a request per click", async () => {
    const f = await fixture();
    f.logger.logActivity("ui.click", { target: "companion-pet" }); f.click("settings");
    expect(f.fetcher).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.fetcher).toHaveBeenCalledTimes(1);
  });
});
