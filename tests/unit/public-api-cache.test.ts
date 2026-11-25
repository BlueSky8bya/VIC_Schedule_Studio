import { describe, expect, it, vi } from "vitest";
import { EDGE_CACHE_HEADER } from "@/lib/edge/anon-home-cache";
import { declaredLifetime, publicApiCacheKey, serveWithPublicApiCache, storableLifetime } from "@/lib/edge/public-api-cache";

const SEARCH = "/api/public/vic/search?q=%EB%B9%85%EB%B1%85&limit=200";

function req(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return new Request(`https://victory-broadcast.com${path}`, { method: init.method ?? "GET", headers: init.headers });
}

function json(body: unknown, cacheControl: string, extra: Record<string, string> = {}, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": cacheControl, ...extra } });
}

function memoryCache() {
  const store = new Map<string, Response>();
  return {
    store,
    async match(key: string) {
      const hit = store.get(key);
      return hit ? hit.clone() : undefined;
    },
    async put(key: string, response: Response) {
      store.set(key, new Response(await response.text(), { status: response.status, headers: response.headers }));
    }
  };
}

function context() {
  const pending: Promise<unknown>[] = [];
  return { pending, waitUntil: (p: Promise<unknown>) => void pending.push(p) };
}

describe("public API edge cache key", () => {
  it("covers only the allow-listed anonymous GET routes", () => {
    for (const path of ["/api/soop-live", SEARCH, "/api/public/vic/search/suggest?q=a", "/api/public/vic/search/trending",
      "/api/public/vic/broadcast?year=2026&month=11", "/api/public/vic/vod-timeline?titleNo=1", "/api/public/vic/vod-chat?titleNo=1", "/api/public/vic/events"]) {
      expect(publicApiCacheKey(req(path)), path).not.toBeNull();
    }
    // 편집·공개 시각이 바로 보여야 하는 것, 로그인 화면, 쓰기 요청은 대상이 아니다.
    for (const path of ["/", "/studio", "/api/public/vic/teaser-state", "/api/public/vic/teaser-state/abc",
      "/api/public/clock", "/api/studio-write", "/api/cron/broadcast-poll", "/api/public/vic/search/extra"]) {
      expect(publicApiCacheKey(req(path)), path).toBeNull();
    }
    expect(publicApiCacheKey(req(SEARCH, { method: "POST" }))).toBeNull();
    expect(publicApiCacheKey(req(SEARCH, { headers: { authorization: "Bearer x" } }))).toBeNull();
    expect(publicApiCacheKey(req(SEARCH, { headers: { rsc: "1" } }))).toBeNull();
  });

  it("ignores cookies and query order but separates different queries", () => {
    const a = publicApiCacheKey(req("/api/public/vic/search?q=a&limit=200"));
    expect(publicApiCacheKey(req("/api/public/vic/search?limit=200&q=a", { headers: { cookie: "sb-x=1" } }))).toBe(a);
    expect(publicApiCacheKey(req("/api/public/vic/search?q=b&limit=200"))).not.toBe(a);
  });
});

describe("declared lifetime", () => {
  it("follows the route header and refuses anything not explicitly public", () => {
    expect(declaredLifetime("public, s-maxage=300, stale-while-revalidate=600")).toEqual({ fresh: 300, stale: 600 });
    expect(declaredLifetime("public, max-age=30, s-maxage=30")).toEqual({ fresh: 30, stale: 0 });
    for (const header of [null, "no-store", "private, no-store", "public, max-age=60", "public, s-maxage=0", "s-maxage=300", "public, no-store, s-maxage=300"]) {
      expect(declaredLifetime(header), String(header)).toBeNull();
    }
  });

  it("never stores failures, cookie-setting or requester-dependent responses", () => {
    const ok = "public, s-maxage=300";
    expect(storableLifetime(json({}, ok))).toEqual({ fresh: 300, stale: 0 });
    expect(storableLifetime(json({}, ok, {}, 503))).toBeNull();
    expect(storableLifetime(json({}, ok, { "set-cookie": "a=1" }))).toBeNull();
    expect(storableLifetime(json({}, ok, { vary: "Accept-Encoding, Cookie" }))).toBeNull();
    expect(storableLifetime(json({}, ok, { vary: "rsc, next-router-state-tree" }))).toEqual({ fresh: 300, stale: 0 });
  });
});

describe("serveWithPublicApiCache", () => {
  it("passes other requests straight through untouched", async () => {
    const cache = memoryCache(), ctx = context();
    const original = json({ a: 1 }, "public, s-maxage=300");
    const out = await serveWithPublicApiCache(req("/api/public/vic/teaser-state"), ctx, async () => original, cache);
    expect(out).toBe(original);
    expect(cache.store.size).toBe(0);
  });

  it("renders once, then serves the copy while fresh with the route's own header", async () => {
    const cache = memoryCache(), ctx = context();
    let t = 1_000_000;
    const render = vi.fn(async () => json({ n: render.mock.calls.length }, "public, s-maxage=300, stale-while-revalidate=600"));
    const first = await serveWithPublicApiCache(req(SEARCH), ctx, render, cache, () => t);
    expect(first.headers.get(EDGE_CACHE_HEADER)).toBe("miss");
    expect(await first.json()).toEqual({ n: 1 });
    await Promise.all(ctx.pending);
    t += 299_000;
    const second = await serveWithPublicApiCache(req(SEARCH, { headers: { cookie: "sb-login=1" } }), ctx, render, cache, () => t);
    expect(second.headers.get(EDGE_CACHE_HEADER)).toBe("hit");
    expect(second.headers.get("cache-control")).toBe("public, s-maxage=300, stale-while-revalidate=600");
    expect(second.headers.get("x-vic-cached-at")).toBeNull();
    expect(second.headers.get("x-vic-origin-cache-control")).toBeNull();
    expect(await second.json()).toEqual({ n: 1 });
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("serves a stale copy inside the declared window while refreshing, and re-renders past it", async () => {
    const cache = memoryCache(), ctx = context();
    let t = 1_000_000;
    const render = vi.fn(async () => json({ n: render.mock.calls.length }, "public, s-maxage=300, stale-while-revalidate=600"));
    await serveWithPublicApiCache(req(SEARCH), ctx, render, cache, () => t);
    await Promise.all(ctx.pending);
    t += 400_000;
    const stale = await serveWithPublicApiCache(req(SEARCH), ctx, render, cache, () => t);
    expect(stale.headers.get(EDGE_CACHE_HEADER)).toBe("stale");
    expect(await stale.json()).toEqual({ n: 1 });
    await Promise.all(ctx.pending);
    expect(render).toHaveBeenCalledTimes(2);
    const refreshed = await serveWithPublicApiCache(req(SEARCH), ctx, render, cache, () => t);
    expect(refreshed.headers.get(EDGE_CACHE_HEADER)).toBe("hit");
    expect(await refreshed.json()).toEqual({ n: 2 });
    t += 901_000;
    const expired = await serveWithPublicApiCache(req(SEARCH), ctx, render, cache, () => t);
    expect(expired.headers.get(EDGE_CACHE_HEADER)).toBe("miss");
    expect(await expired.json()).toEqual({ n: 3 });
  });

  it("does not serve past s-maxage when the route declared no stale window", async () => {
    const cache = memoryCache(), ctx = context();
    let t = 1_000_000;
    const render = vi.fn(async () => json({ n: render.mock.calls.length }, "public, max-age=30, s-maxage=30"));
    await serveWithPublicApiCache(req("/api/soop-live"), ctx, render, cache, () => t);
    await Promise.all(ctx.pending);
    t += 31_000;
    const out = await serveWithPublicApiCache(req("/api/soop-live"), ctx, render, cache, () => t);
    expect(out.headers.get(EDGE_CACHE_HEADER)).toBe("miss");
    expect(await out.json()).toEqual({ n: 2 });
  });

  it("never stores a failure, so the next request tries again", async () => {
    const cache = memoryCache(), ctx = context();
    const render = vi.fn()
      .mockResolvedValueOnce(json({ error: "search unavailable" }, "no-store", {}, 503))
      .mockResolvedValueOnce(json({ ok: true }, "public, s-maxage=300"));
    const failed = await serveWithPublicApiCache(req(SEARCH), ctx, render, cache);
    expect(failed.status).toBe(503);
    expect(failed.headers.get(EDGE_CACHE_HEADER)).toBe("bypass");
    await Promise.all(ctx.pending);
    expect(cache.store.size).toBe(0);
    const ok = await serveWithPublicApiCache(req(SEARCH), ctx, render, cache);
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });
  });

  it("falls back to rendering when the cache itself throws", async () => {
    const ctx = context();
    const broken = { match: async () => { throw new Error("cache down"); }, put: async () => { throw new Error("cache down"); } };
    const out = await serveWithPublicApiCache(req(SEARCH), ctx, async () => json({ ok: true }, "public, s-maxage=300"), broken);
    expect(await out.json()).toEqual({ ok: true });
    await Promise.all(ctx.pending);
  });
});
