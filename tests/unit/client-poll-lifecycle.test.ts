import { afterEach, beforeEach, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[], setters: [] as ReturnType<typeof vi.fn>[] }));
vi.mock("react", () => ({
  useEffect: (effect: () => void | (() => void)) => hooks.effects.push(effect),
  useCallback: (callback: unknown) => callback,
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => { const setter = vi.fn(); hooks.setters.push(setter); return [typeof initial === "function" ? initial() : initial, setter]; },
}));
vi.mock("@/lib/ui/synced-clock", () => ({
  clockIsSynced: () => true, syncedNow: () => Date.now(),
  synchronizeClock: async () => {}, applyDatabaseClock: vi.fn(), subscribeClock: vi.fn(),
}));

const cleanups: (() => void)[] = [];
beforeEach(() => { vi.resetModules(); hooks.effects = []; hooks.setters = []; });
afterEach(() => { cleanups.splice(0).forEach(stop => stop()); vi.useRealTimers(); vi.unstubAllGlobals(); });

function environment(hidden = false) {
  vi.useFakeTimers({ toFake: ["Date", "performance", "setTimeout", "clearTimeout"] });
  const doc = Object.assign(new EventTarget(), { hidden, documentElement: { hasAttribute: () => false }, querySelector: () => null });
  const win = new EventTarget();
  const nav = { onLine: true };
  vi.stubGlobal("document", doc); vi.stubGlobal("window", win); vi.stubGlobal("navigator", nav);
  vi.stubGlobal("HTMLElement", class {});
  return { doc, win, nav };
}

it("the actual live hook shares one request across consumers and retains fresh data across remounts", async () => {
  const { doc } = environment();
  const data = { isLive: false, bjNick: null, title: null, category: null, watchUrl: null };
  const fetch = vi.fn(async () => ({ ok: true, json: async () => data })); vi.stubGlobal("fetch", fetch);
  const { useSoopLive } = await import("@/components/poster/use-soop-live");
  const Consumer = () => { useSoopLive(); const stop = hooks.effects.pop()!() as () => void; cleanups.push(stop); return stop; };
  const a = Consumer(), b = Consumer();
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(hooks.setters[0]).toHaveBeenCalledWith(data); expect(hooks.setters[1]).toHaveBeenCalledWith(data);
  a(); b(); cleanups.length = 0;
  Consumer(); await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(30_000);
  doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetch).toHaveBeenCalledTimes(1);
  doc.hidden = false; doc.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("the actual live hook aborts on offline and never applies an obsolete response", async () => {
  const { win, nav } = environment();
  let complete!: () => void, signal!: AbortSignal;
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    signal = init.signal as AbortSignal;
    await new Promise<void>(resolve => { complete = resolve; });
    return { ok: true, json: async () => ({ isLive: true }) };
  }); vi.stubGlobal("fetch", fetch);
  const { useSoopLive } = await import("@/components/poster/use-soop-live");
  useSoopLive(); cleanups.push(hooks.effects.pop()!() as () => void);
  nav.onLine = false; win.dispatchEvent(new Event("offline"));
  expect(signal.aborted).toBe(true);
  complete(); await vi.advanceTimersByTimeAsync(60_000);
  expect(hooks.setters[0]).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(1);
});

it("the actual premiere hook stops missing-ID lookups and late updates on hide, including OFF stage", async () => {
  const { doc } = environment();
  let complete!: () => void, signal!: AbortSignal;
  const fetch = vi.fn(async (_url: string, init: RequestInit) => {
    if (fetch.mock.calls.length > 1) {
      signal = init.signal as AbortSignal;
      await new Promise<void>(resolve => { complete = resolve; });
    }
    return { ok: true, json: async () => ({ ok: true, schemaVersion: 1, sampledAtDbMs: Date.now(), entries: [] }) };
  }); vi.stubGlobal("fetch", fetch);
  const { useTeaserPremiere } = await import("@/lib/ui/premiere/use-teaser-premiere");
  const events = ["a", "b"].map(id => ({ id, startsAt: "2026-06-10T00:00:00+09:00", isAllDay: true, isTentative: false, status: "scheduled" as const, visibilityScope: "public" as const, category: "stream" as const, sortOrder: 0, tagIds: [], primaryTagIds: [], publicTitle: "", teaser: true, teaserRevealAt: new Date(Date.now() + 90_000).toISOString() }));
  const onEvents = vi.fn();
  useTeaserPremiere({ slug: "fixture", events, month: "2026-06", enabled: false, root: { current: null }, blocked: { current: false }, onEvents });
  // Run only the actual network effect; the independent clock render effect is
  // outside this request test. No fake server, browser or production traffic.
  cleanups.push(hooks.effects[1]() as () => void);
  await vi.advanceTimersByTimeAsync(0);
  expect(fetch).toHaveBeenCalledTimes(2); expect(onEvents).toHaveBeenCalledTimes(1);
  doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
  expect(signal.aborted).toBe(true);
  complete(); await vi.advanceTimersByTimeAsync(60_000);
  expect(fetch).toHaveBeenCalledTimes(2); expect(onEvents).toHaveBeenCalledTimes(1);
});
