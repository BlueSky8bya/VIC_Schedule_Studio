// 공개 API 응답의 엣지 캐시 — cloudflare/worker.ts가 Workers Cache API로 쓴다(2026-11-26).
// 왜: 이 라우트들은 `Cache-Control: public, s-maxage=…`를 달고 나간다. Vercel에서는 CDN이 그 헤더대로 담아
// 줬지만, Cloudflare는 Worker가 만든 응답을 담지 않는다(Worker가 캐시보다 앞에서 돈다) → 이전 뒤로 매 요청이
// Next 렌더 + DB 왕복이었다(실측: 같은 검색어를 연달아 불러도 매번 1.1~2.2초, 60초마다 도는 방송 확인도 매번).
// 여기서는 라우트가 이미 선언한 수명(s-maxage, stale-while-revalidate)을 그대로 지킬 뿐 새 수명을 만들지 않는다.
// 규칙은 **허용 목록**: 아래 경로의 GET, 쿠키·로그인과 무관하게 같은 응답을 내는 라우트만(각 라우트는 쿠키·헤더를
// 읽지 않는다). 일정 전체(/events)는 소유자 허용(2026-11-26, 편집 반영 최대 1분)으로 넣고 라우트 수명을 60초 안으로 줄였다.
// 최초공개 상태(/teaser-state)는 공개 시각이 바로 보여야 해서 넣지 않는다.
// 이 파일은 wrangler(esbuild)가 그대로 묶으므로 `@/` 별칭 없이 상대 경로만 import한다.
import { CACHED_AT_HEADER, EDGE_CACHE_HEADER, cachedAgeSeconds } from "./anon-home-cache";

const ORIGIN_CACHE_CONTROL_HEADER = "x-vic-origin-cache-control";
const PUBLIC_ROUTE = /^\/api\/public\/[^/]+\/(events|search|search\/suggest|search\/trending|broadcast|vod-timeline|vod-chat)$/;
const NEXT_INTERNAL_HEADERS = ["rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-action"];

// 캐시 가능한 요청이면 열쇠(합성 URL)를, 아니면 null(우회)을 돌려준다. 쿼리는 순서만 달라도 같은 열쇠가 되게 정렬한다.
export function publicApiCacheKey(request: Request): string | null {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.pathname !== "/api/soop-live" && !PUBLIC_ROUTE.test(url.pathname)) return null;
  if (request.headers.has("authorization")) return null;
  if (NEXT_INTERNAL_HEADERS.some((h) => request.headers.has(h))) return null;
  const query = [...url.searchParams.entries()]
    .sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : av > bv ? 1 : 0) : ak < bk ? -1 : 1))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return `https://public-api.cache.invalid${url.pathname}?${query}`;
}

// 라우트가 선언한 수명. 공개(public)이고 s-maxage가 1초 이상일 때만 — 아니면 null(담지 않는다).
export function declaredLifetime(cacheControl: string | null): { fresh: number; stale: number } | null {
  if (!cacheControl) return null;
  const directives = new Map<string, string>();
  for (const part of cacheControl.toLowerCase().split(",")) {
    const [name, value = ""] = part.trim().split("=");
    if (name) directives.set(name, value.trim());
  }
  if (!directives.has("public") || directives.has("private") || directives.has("no-store") || directives.has("no-cache")) return null;
  const fresh = Number(directives.get("s-maxage"));
  if (!Number.isFinite(fresh) || fresh < 1) return null;
  const stale = Number(directives.get("stale-while-revalidate"));
  return { fresh, stale: Number.isFinite(stale) && stale > 0 ? stale : 0 };
}

// 담아도 되는 응답인지 — 200이고, 쿠키를 심지 않고, 요청자에 따라 달라진다고 말하지 않을 때만.
export function storableLifetime(response: Response): { fresh: number; stale: number } | null {
  if (response.status !== 200 || response.headers.has("set-cookie")) return null;
  const vary = (response.headers.get("vary") ?? "").toLowerCase();
  if (/(^|[\s,])(\*|cookie|authorization)([\s,]|$)/.test(vary)) return null;
  return declaredLifetime(response.headers.get("cache-control"));
}

function toCachedCopy(response: Response, lifetime: { fresh: number; stale: number }, now: number): Response {
  const headers = new Headers(response.headers);
  headers.delete("vary");
  headers.set(ORIGIN_CACHE_CONTROL_HEADER, response.headers.get("cache-control") ?? "");
  headers.set("cache-control", `public, max-age=${lifetime.fresh + lifetime.stale}`);
  headers.set(CACHED_AT_HEADER, String(now));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// 꺼낸 사본을 내보낼 모양: 라우트가 원래 단 Cache-Control로 되돌리고 안쪽 표식은 지운다.
function toClientResponse(cached: Response, state: "hit" | "stale"): Response {
  const headers = new Headers(cached.headers);
  headers.set("cache-control", cached.headers.get(ORIGIN_CACHE_CONTROL_HEADER) ?? "no-store");
  headers.delete(ORIGIN_CACHE_CONTROL_HEADER);
  headers.delete(CACHED_AT_HEADER);
  headers.set(EDGE_CACHE_HEADER, state);
  return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
}

function withState(response: Response, state: "miss" | "bypass"): Response {
  const headers = new Headers(response.headers);
  headers.set(EDGE_CACHE_HEADER, state);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

type EdgeCache = { match(key: string): Promise<Response | undefined>; put(key: string, response: Response): Promise<void> };
type WaitUntil = { waitUntil(promise: Promise<unknown>): void };

// Worker fetch 감싸기. 대상이 아니면 원래 핸들러 그대로. 신선한 사본은 즉시, 선언된 stale 구간의 사본은 즉시 내주고
// 뒤에서 새로 만든다. 실패 응답(503 등)은 담지 않는다. 캐시 오류는 삼키고 원래 경로로 간다 — 캐시는 덤이다.
export async function serveWithPublicApiCache(
  request: Request,
  ctx: WaitUntil,
  render: (request: Request) => Promise<Response>,
  cache: EdgeCache,
  now: () => number = Date.now
): Promise<Response> {
  const key = publicApiCacheKey(request);
  if (!key) return render(request);

  const refresh = async () => {
    const fresh = await render(request.clone());
    const lifetime = storableLifetime(fresh);
    if (lifetime) await cache.put(key, toCachedCopy(fresh, lifetime, now()));
  };

  let cached: Response | undefined;
  try {
    cached = await cache.match(key);
  } catch {
    cached = undefined;
  }
  if (cached) {
    const lifetime = declaredLifetime(cached.headers.get(ORIGIN_CACHE_CONTROL_HEADER));
    const age = cachedAgeSeconds(cached, now());
    if (lifetime && age <= lifetime.fresh) return toClientResponse(cached, "hit");
    if (lifetime && age <= lifetime.fresh + lifetime.stale) {
      ctx.waitUntil(refresh().catch(() => {}));
      return toClientResponse(cached, "stale");
    }
  }

  const response = await render(request);
  const lifetime = storableLifetime(response);
  if (!lifetime) return withState(response, "bypass");
  const copy = toCachedCopy(response.clone(), lifetime, now());
  ctx.waitUntil(cache.put(key, copy).catch(() => {}));
  return withState(response, "miss");
}
