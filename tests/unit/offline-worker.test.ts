import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";

const source = readFileSync("public/sw.js", "utf8");
const CACHE = "vic-offline-v7";
type Store = Map<string, Map<string, Response>>;

function worker(store: Store = new Map()) {
  const handlers = new Map<string, (event: unknown) => void>();
  const state = { visible: true, online: true, now: 1_800_000_000_000 };
  const key = (request: string | { url: string }) => typeof request === "string" ? request : request.url;
  const caches = {
    keys: async () => [...store.keys()], delete: async (name: string) => store.delete(name),
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const entries = store.get(name)!;
      return {
        match: async (request: string) => entries.get(key(request))?.clone(),
        put: async (request: string, response: Response) => { entries.set(key(request), response.clone()); },
      };
    },
  };
  const fetch = vi.fn(async (request: string | { url: string }, init?: RequestInit) => {
    void init;
    return new Response(key(request) === "/" ? "anonymous public poster" : "live studio response");
  });
  runInNewContext(source, {
    caches, fetch, Response, URL, AbortController, AbortSignal,
    Date: { now: () => state.now },
    self: {
      addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler),
      skipWaiting: vi.fn(), location: { origin: "https://fixture.invalid" },
      navigator: { get onLine() { return state.online; } },
      clients: { claim: async () => {}, matchAll: async () => [{ visibilityState: state.visible ? "visible" : "hidden", postMessage: vi.fn() }] },
    },
  });
  const message = (type: string, extra: Record<string, unknown> = {}) => {
    const work: Promise<unknown>[] = [];
    handlers.get("message")!({ data: { type, ...extra }, waitUntil: (promise: Promise<unknown>) => work.push(promise) });
    return Promise.all(work);
  };
  const navigate = () => {
    const work: Promise<unknown>[] = [];
    let response!: Promise<Response>;
    handlers.get("fetch")!({
      request: { method: "GET", url: "https://fixture.invalid/studio", mode: "navigate" },
      waitUntil: (promise: Promise<unknown>) => work.push(promise),
      respondWith: (promise: Promise<Response>) => { response = promise; },
    });
    return { response, background: Promise.all(work), work };
  };
  return { state, fetch, store, message, navigate };
}

it("coalesces concurrent navigation snapshots and extends the fetch event through the write", async () => {
  const sw = worker();
  let release!: (response: Response) => void;
  sw.fetch.mockImplementation(async (request) => {
    if (request === "/") return new Promise<Response>(resolve => { release = resolve; });
    return new Response("authenticated studio: never cached");
  });
  const a = sw.navigate(), b = sw.navigate();
  await Promise.all([a.response, b.response]);
  expect(a.work).toHaveLength(1); expect(b.work).toHaveLength(1);
  await vi.waitFor(() => expect(sw.fetch.mock.calls.filter(([url]) => url === "/")).toHaveLength(1));
  release(new Response("anonymous public poster"));
  await Promise.all([a.background, b.background]);
  expect(await sw.store.get(CACHE)!.get("/__offline_snapshot")!.text()).toBe("anonymous public poster");
  expect([...sw.store.get(CACHE)!.keys()].some(key => key.includes("studio"))).toBe(false);
  const init = sw.fetch.mock.calls.find(([url]) => url === "/")![1] as RequestInit;
  expect(init).toMatchObject({ credentials: "omit", cache: "no-store", redirect: "manual" });
});

it("persists successful-fetch freshness across worker restarts without extending it on failures", async () => {
  const sw = worker();
  await sw.message("vic-refresh-snapshot");
  const restarted = worker(sw.store);
  restarted.state.now += 59_999;
  await restarted.message("vic-refresh-snapshot");
  expect(restarted.fetch).not.toHaveBeenCalled();
  restarted.state.now += 2;
  restarted.fetch.mockRejectedValueOnce(new Error("offline"));
  await restarted.message("vic-refresh-snapshot");
  await restarted.message("vic-refresh-snapshot");
  expect(restarted.fetch).toHaveBeenCalledTimes(2);
});

it("does not make a snapshot permanently fresh when the OS clock moves backwards", async () => {
  const sw = worker(); await sw.message("vic-refresh-snapshot");
  sw.state.now -= 60_000;
  await sw.message("vic-refresh-snapshot");
  expect(sw.fetch).toHaveBeenCalledTimes(2);
});

it("starts no extra SSR in hidden/offline windows and resumes when a visible client requests it", async () => {
  const sw = worker();
  sw.state.visible = false; await sw.message("vic-refresh-snapshot");
  sw.state.visible = true; sw.state.online = false; await sw.message("vic-refresh-snapshot");
  expect(sw.fetch).not.toHaveBeenCalled();
  sw.state.online = true; await sw.message("vic-refresh-snapshot");
  expect(sw.fetch).toHaveBeenCalledTimes(1);
});

it("drains and invalidates an in-flight snapshot before clearing, even if fetch ignores abort", async () => {
  const sw = worker();
  let release!: (response: Response) => void;
  sw.fetch.mockImplementation(async () => new Promise<Response>(resolve => { release = resolve; }));
  const refresh = sw.message("vic-refresh-snapshot");
  // The worker reaches fetch through asynchronous client/cache lookups.
  await vi.waitFor(() => expect(sw.fetch).toHaveBeenCalledTimes(1));
  const clear = sw.message("vic-clear-cache");
  const init = sw.fetch.mock.calls[0][1] as RequestInit;
  expect(init.signal!.aborted).toBe(true);
  release(new Response("late anonymous response"));
  await Promise.all([refresh, clear]);
  expect(sw.store.size).toBe(0);
});

it("pauses an active snapshot only when all windows are hidden", async () => {
  const sw = worker();
  let release!: (response: Response) => void;
  sw.fetch.mockImplementation(async () => new Promise<Response>(resolve => { release = resolve; }));
  const refresh = sw.message("vic-refresh-snapshot");
  await vi.waitFor(() => expect(sw.fetch).toHaveBeenCalledTimes(1));
  const init = sw.fetch.mock.calls[0][1] as RequestInit;
  await sw.message("vic-pause-snapshot"); expect(init.signal!.aborted).toBe(false);
  sw.state.visible = false;
  await sw.message("vic-pause-snapshot"); expect(init.signal!.aborted).toBe(true);
  release(new Response("late response")); await refresh;
  expect(sw.store.get(CACHE)?.has("/__offline_snapshot")).toBe(false);
});

it("bounds asset prefetch to four requests and continues past already-cached assets", async () => {
  const sw = worker();
  const urls = Array.from({ length: 9 }, (_, i) => `/_next/static/${i}.js`);
  sw.store.set(CACHE, new Map([[urls[0], new Response("cached static")]]));
  let active = 0, peak = 0;
  sw.fetch.mockImplementation(async request => {
    if (request === "/") return new Response(urls.map(url => `<script src="${url}"></script>`).join(""));
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 2)); active--;
    return new Response("public static");
  });
  await sw.message("vic-refresh-snapshot");
  expect(peak).toBe(4);
  expect(sw.fetch).toHaveBeenCalledTimes(9); // one SSR + eight uncached immutable chunks
  for (const url of urls) expect(sw.store.get(CACHE)!.has(url)).toBe(true);
});

it("resumes interrupted chunk caching from fresh HTML without repeating anonymous SSR", async () => {
  const sw = worker();
  const asset = "/_next/static/paused.js";
  let release!: (response: Response) => void;
  sw.fetch.mockImplementation(async request => {
    if (request === "/") return new Response(`<script src="${asset}"></script>`);
    if (sw.fetch.mock.calls.length === 2) return new Promise<Response>(resolve => { release = resolve; });
    return new Response("resumed static asset");
  });
  const refresh = sw.message("vic-refresh-snapshot");
  await vi.waitFor(() => expect(sw.fetch).toHaveBeenCalledTimes(2));
  sw.state.visible = false; await sw.message("vic-pause-snapshot");
  release(new Response("aborted asset")); await refresh;
  expect(sw.store.get(CACHE)!.has(asset)).toBe(false);
  sw.state.visible = true; await sw.message("vic-refresh-snapshot");
  expect(sw.fetch.mock.calls.filter(([url]) => url === "/")).toHaveLength(1);
  expect(await sw.store.get(CACHE)!.get(asset)!.text()).toBe("resumed static asset");
});

it("queues a rapid foreground resume until an aborted snapshot chain actually drains", async () => {
  const sw = worker();
  let release!: (response: Response) => void;
  sw.fetch.mockImplementation(async () => {
    if (sw.fetch.mock.calls.length === 1) return new Promise<Response>(resolve => { release = resolve; });
    return new Response("new foreground snapshot");
  });
  const first = sw.message("vic-refresh-snapshot");
  await vi.waitFor(() => expect(sw.fetch).toHaveBeenCalledTimes(1));
  sw.state.visible = false; await sw.message("vic-pause-snapshot");
  sw.state.visible = true;
  const resume = sw.message("vic-refresh-snapshot");
  expect(sw.fetch).toHaveBeenCalledTimes(1);
  release(new Response("aborted background response"));
  await Promise.all([first, resume]);
  expect(sw.fetch).toHaveBeenCalledTimes(2);
  expect(await sw.store.get(CACHE)!.get("/__offline_snapshot")!.text()).toBe("new foreground snapshot");
});

it("an identity change refills only after clear completes, without accepting an old in-flight response", async () => {
  const sw = worker();
  let release!: (response: Response) => void;
  sw.fetch.mockImplementation(async () => {
    if (sw.fetch.mock.calls.length === 1) return new Promise<Response>(resolve => { release = resolve; });
    return new Response("fresh anonymous poster after identity clear");
  });
  const first = sw.message("vic-refresh-snapshot");
  await vi.waitFor(() => expect(sw.fetch).toHaveBeenCalledTimes(1));
  const change = sw.message("vic-clear-cache", { refresh: true });
  expect(sw.fetch).toHaveBeenCalledTimes(1);
  release(new Response("old response")); await Promise.all([first, change]);
  expect(sw.fetch).toHaveBeenCalledTimes(2);
  expect(await sw.store.get(CACHE)!.get("/__offline_snapshot")!.text()).toBe("fresh anonymous poster after identity clear");
  sw.state.visible = false;
  await sw.message("vic-clear-cache", { refresh: true });
  expect(sw.store.size).toBe(0); expect(sw.fetch).toHaveBeenCalledTimes(2);
});
