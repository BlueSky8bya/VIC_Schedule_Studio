import { describe, expect, it, vi } from "vitest";
import {
  ANON_HOME_FRESH_SECONDS,
  ANON_HOME_MAX_SECONDS,
  CACHED_AT_HEADER,
  EDGE_CACHE_HEADER,
  anonHomeCacheKey,
  isStorableHomeResponse,
  serveWithAnonHomeCache,
  toCachedCopy
} from "@/lib/edge/anon-home-cache";

const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130";
const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1";

function req(path = "/", init: { method?: string; cookie?: string; ua?: string; headers?: Record<string, string> } = {}) {
  const headers = new Headers(init.headers);
  headers.set("user-agent", init.ua ?? DESKTOP);
  if (init.cookie) headers.set("cookie", init.cookie);
  return new Request(`https://victory-broadcast.com${path}`, { method: init.method ?? "GET", headers });
}

function html(body = "<html>poster</html>", extra: Record<string, string> = {}) {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate", vary: "rsc", ...extra }
  });
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

describe("anonHomeCacheKey", () => {
  it("caches a plain anonymous visit and separates phone/desktop", () => {
    const desktop = anonHomeCacheKey(req());
    const phone = anonHomeCacheKey(req("/", { ua: PHONE }));
    expect(desktop).not.toBeNull();
    expect(phone).not.toBeNull();
    expect(desktop).not.toBe(phone);
  });

  it("keys by linked month and remembered month, and by loading tone", () => {
    const linked = anonHomeCacheKey(req("/?month=2026-10"));
    const remembered = anonHomeCacheKey(req("/", { cookie: `vic_view=${encodeURIComponent(JSON.stringify({ sy: 2026, sm: 10 }))}` }));
    expect(linked).toContain("m=2026-10");
    expect(remembered).toBe(linked);
    expect(anonHomeCacheKey(req("/", { cookie: "vic_lt=s" }))).toContain("t=s");
    // 미리보기 중(v=1)이면 편집실 톤이 아니다(loading-variant.ts와 같은 규칙).
    expect(anonHomeCacheKey(req("/", { cookie: `vic_lt=s; vic_view=${encodeURIComponent(JSON.stringify({ v: 1 }))}` }))).toContain("t=p");
  });

  it("bypasses logged-in, unknown cookies, other paths, methods, params and RSC requests", () => {
    expect(anonHomeCacheKey(req("/", { cookie: "sb-abc-auth-token=xyz" }))).toBeNull();
    expect(anonHomeCacheKey(req("/", { cookie: "sb-abc-auth-token.0=xyz; vic_lt=p" }))).toBeNull();
    expect(anonHomeCacheKey(req("/", { cookie: "something_new=1" }))).toBeNull();
    expect(anonHomeCacheKey(req("/", { cookie: "broken" }))).toBeNull();
    expect(anonHomeCacheKey(req("/studio"))).toBeNull();
    expect(anonHomeCacheKey(req("/", { method: "POST" }))).toBeNull();
    expect(anonHomeCacheKey(req("/", { method: "HEAD" }))).toBeNull();
    expect(anonHomeCacheKey(req("/?event=abc"))).toBeNull();
    expect(anonHomeCacheKey(req("/?month=2026-13"))).toBeNull();
    expect(anonHomeCacheKey(req("/?month=2026-10&month=2026-11"))).toBeNull();
    expect(anonHomeCacheKey(req("/", { headers: { rsc: "1" } }))).toBeNull();
    expect(anonHomeCacheKey(req("/", { headers: { "next-action": "abc" } }))).toBeNull();
    // Cloudflare 자체 쿠키는 SSR과 무관하다.
    expect(anonHomeCacheKey(req("/", { cookie: "__cf_bm=1; cf_clearance=2" }))).not.toBeNull();
  });
});

describe("storing rules", () => {
  it("never stores Set-Cookie, non-200 or non-HTML responses", () => {
    expect(isStorableHomeResponse(html())).toBe(true);
    expect(isStorableHomeResponse(html("x", { "set-cookie": "a=1" }))).toBe(false);
    expect(isStorableHomeResponse(new Response("x", { status: 307, headers: { "content-type": "text/html" } }))).toBe(false);
    expect(isStorableHomeResponse(new Response("{}", { status: 200, headers: { "content-type": "application/json" } }))).toBe(false);
  });

  it("cached copy is public, short-lived, without vary or cookies", () => {
    const copy = toCachedCopy(html(), 1000);
    expect(copy.headers.get("cache-control")).toBe(`public, max-age=${ANON_HOME_MAX_SECONDS}`);
    expect(copy.headers.has("vary")).toBe(false);
    expect(copy.headers.has("set-cookie")).toBe(false);
    expect(copy.headers.get(CACHED_AT_HEADER)).toBe("1000");
  });
});

describe("serveWithAnonHomeCache", () => {
  const ctx = () => {
    const pending: Promise<unknown>[] = [];
    return { pending, waitUntil: (p: Promise<unknown>) => void pending.push(p) };
  };

  it("miss renders and stores, then hits without rendering", async () => {
    const cache = memoryCache();
    const render = vi.fn(async () => html("<html>v1</html>"));
    let clock = 1_000_000;
    const c1 = ctx();
    const first = await serveWithAnonHomeCache(req(), c1, render, cache, () => clock);
    expect(first.headers.get(EDGE_CACHE_HEADER)).toBe("miss");
    expect(await first.text()).toBe("<html>v1</html>");
    await Promise.all(c1.pending);

    clock += 5_000;
    const second = await serveWithAnonHomeCache(req(), ctx(), render, cache, () => clock);
    expect(second.headers.get(EDGE_CACHE_HEADER)).toBe("hit");
    expect(second.headers.get("cache-control")).toContain("no-store"); // 브라우저는 계속 담지 않는다
    expect(second.headers.has(CACHED_AT_HEADER)).toBe(false);
    expect(await second.text()).toBe("<html>v1</html>");
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("serves stale after the fresh window and refreshes in the background; drops after max age", async () => {
    const cache = memoryCache();
    let version = 1;
    const render = vi.fn(async () => html(`<html>v${version}</html>`));
    let clock = 1_000_000;
    const c1 = ctx();
    await serveWithAnonHomeCache(req(), c1, render, cache, () => clock);
    await Promise.all(c1.pending);

    version = 2;
    clock += (ANON_HOME_FRESH_SECONDS + 1) * 1000;
    const c2 = ctx();
    const stale = await serveWithAnonHomeCache(req(), c2, render, cache, () => clock);
    expect(stale.headers.get(EDGE_CACHE_HEADER)).toBe("stale");
    expect(await stale.text()).toBe("<html>v1</html>");
    await Promise.all(c2.pending);
    const refreshed = await serveWithAnonHomeCache(req(), ctx(), render, cache, () => clock);
    expect(await refreshed.text()).toBe("<html>v2</html>");

    version = 3;
    clock += (ANON_HOME_MAX_SECONDS + 1) * 1000;
    const expired = await serveWithAnonHomeCache(req(), ctx(), render, cache, () => clock);
    expect(expired.headers.get(EDGE_CACHE_HEADER)).toBe("miss");
    expect(await expired.text()).toBe("<html>v3</html>");
  });

  it("bypass passes logged-in requests straight through and never stores them", async () => {
    const cache = memoryCache();
    const render = vi.fn(async () => html("<html>me</html>", { "set-cookie": "sb-x=1" }));
    const res = await serveWithAnonHomeCache(req("/", { cookie: "sb-abc-auth-token=1" }), ctx(), render, cache);
    expect(res.headers.get(EDGE_CACHE_HEADER)).toBe("bypass");
    expect(cache.store.size).toBe(0);
  });

  it("does not store an anonymous response that sets a cookie", async () => {
    const cache = memoryCache();
    const render = vi.fn(async () => html("<html>x</html>", { "set-cookie": "a=1" }));
    const res = await serveWithAnonHomeCache(req(), ctx(), render, cache);
    expect(res.headers.get(EDGE_CACHE_HEADER)).toBe("bypass");
    expect(res.headers.get("set-cookie")).toBe("a=1");
    expect(cache.store.size).toBe(0);
  });

  it("other paths are untouched", async () => {
    const render = vi.fn(async () => new Response("ok", { headers: { "x-a": "1" } }));
    const res = await serveWithAnonHomeCache(req("/api/public/vic/events"), ctx(), render, memoryCache());
    expect(res.headers.has(EDGE_CACHE_HEADER)).toBe(false);
  });
});
