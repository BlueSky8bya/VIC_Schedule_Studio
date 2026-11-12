// 익명 시청자 첫 화면(`/`) HTML 캐시 규칙 — cloudflare/worker.ts가 Workers Cache API로 쓴다(2026-11-13).
// 왜: `/`는 셸을 먼저 흘린 뒤 693개 일정·다시보기 묶음을 SSR로 0.5~0.7초 더 흘려보낸다. 익명 응답은 아래 열쇠가
// 같으면 바이트까지 같으므로(개인 필드 없음: myHeartIds는 로그인 쿠키가 있을 때만, 하트 수·시각은 짧은 TTL로 허용)
// 짧게 담아 두고 곧바로 내준다. Worker는 Supabase 옆(서울) placement라 이 캐시도 거기 한 곳에 모인다.
// 규칙은 **허용 목록**: SSR이 읽는 쿠키(vic_view·vic_lt)는 열쇠에 넣고, 로그인 쿠키(sb-*)나 모르는 쿠키·쿼리가
// 하나라도 있으면 통째로 우회한다 — 새 코드가 다른 쿠키를 읽기 시작해도 남의 화면이 섞이지 않는다.
// 이 파일은 wrangler(esbuild)가 그대로 묶으므로 `@/` 별칭 없이 상대 경로만 import한다.
import { isMobileUserAgent } from "../auth/in-app-browser";
import { isPublicMonth, parsePublicMonth } from "../ui/public-month-link";

export const ANON_HOME_FRESH_SECONDS = 20; // 이보다 오래된 사본은 내주면서 뒤에서 새로 만든다
export const ANON_HOME_MAX_SECONDS = 60; // 이보다 오래된 사본은 버린다 — 편집 반영 최악 지연
export const EDGE_CACHE_HEADER = "x-vic-edge-cache";
export const CACHED_AT_HEADER = "x-vic-cached-at";

// SSR과 무관한 Cloudflare 자체 쿠키(봇 관리·챌린지). 서버 코드가 읽지 않는다.
const IGNORED_COOKIES = new Set(["__cf_bm", "cf_clearance", "_cfuvid", "__cflb"]);
const VIEW_COOKIE = "vic_view"; // lib/ui/view-cookie.ts — 같은 이름(그 파일은 클라 코드도 품어 여기선 상수만 복제)
const LOADING_TONE_COOKIE = "vic_lt";

function parseCookies(header: string | null): Map<string, string> | null {
  const out = new Map<string, string>();
  if (!header) return out;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) return null; // 모양이 이상하면 판단하지 않고 우회
    out.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return out;
}

function readViewMemory(raw: string | undefined): { sy?: unknown; sm?: unknown; v?: unknown } {
  if (!raw) return {};
  try {
    const obj = JSON.parse(decodeURIComponent(raw));
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

// 캐시 가능한 익명 `/` 요청이면 열쇠(합성 URL)를, 아니면 null(우회)을 돌려준다.
// 열쇠 = app/page.tsx가 익명 화면에서 쓰는 입력 전부: 첫 달(쿼리 month → vic_view의 sy/sm), 휴대폰 여부(UA),
// 로딩 스켈레톤 톤(vic_lt=s && v!==1 → 편집실 톤, lib/ui/loading-variant.ts).
export function anonHomeCacheKey(request: Request): string | null {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  if (url.pathname !== "/") return null;
  // RSC·프리페치·서버 액션 요청은 같은 경로라도 응답이 다르다.
  for (const h of ["rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-action"]) {
    if (request.headers.has(h)) return null;
  }
  const params = [...url.searchParams.keys()];
  if (params.some((k) => k !== "month")) return null;
  const monthValues = url.searchParams.getAll("month");
  if (monthValues.length > 1) return null;
  const linked = monthValues.length === 1 ? parsePublicMonth(monthValues[0]) : null;
  if (monthValues.length === 1 && !linked) return null;

  const cookies = parseCookies(request.headers.get("cookie"));
  if (!cookies) return null;
  for (const name of cookies.keys()) {
    if (name === VIEW_COOKIE || name === LOADING_TONE_COOKIE || IGNORED_COOKIES.has(name)) continue;
    return null; // sb-*(로그인) 포함 모든 모르는 쿠키 → 우회
  }

  const mem = readViewMemory(cookies.get(VIEW_COOKIE));
  const remembered = { year: mem.sy, month: mem.sm };
  const view = linked ?? (isPublicMonth(remembered) ? remembered : null);
  const month = view ? `${view.year}-${String(view.month).padStart(2, "0")}` : "";
  const studioTone = cookies.get(LOADING_TONE_COOKIE) === "s" && mem.v !== 1;
  const narrow = isMobileUserAgent(request.headers.get("user-agent") ?? "");

  return `https://anon-home.cache.invalid/?m=${month}&n=${narrow ? 1 : 0}&t=${studioTone ? "s" : "p"}`;
}

// 담아도 되는 응답인지 — 200 HTML이고 쿠키를 심지 않을 때만.
export function isStorableHomeResponse(response: Response): boolean {
  if (response.status !== 200) return false;
  if (response.headers.has("set-cookie")) return false;
  return (response.headers.get("content-type") ?? "").includes("text/html");
}

// 캐시에 넣을 사본: Next의 private/no-store를 캐시용 수명으로 바꾸고 담은 시각을 적는다(Vary는 열쇠가 대신한다).
export function toCachedCopy(response: Response, now: number): Response {
  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  headers.delete("vary");
  headers.set("cache-control", `public, max-age=${ANON_HOME_MAX_SECONDS}`);
  headers.set(CACHED_AT_HEADER, String(now));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

// 캐시에서 꺼낸 사본을 브라우저로 내보낼 모양: 브라우저·중간 캐시는 계속 담지 못하게(원래 Next 헤더와 같게).
export function toClientResponse(cached: Response, state: "hit" | "stale"): Response {
  const headers = new Headers(cached.headers);
  headers.set("cache-control", "private, no-cache, no-store, max-age=0, must-revalidate");
  headers.delete(CACHED_AT_HEADER);
  headers.delete("set-cookie");
  headers.set(EDGE_CACHE_HEADER, state);
  return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
}

export function withCacheState(response: Response, state: "miss" | "bypass"): Response {
  const headers = new Headers(response.headers);
  headers.set(EDGE_CACHE_HEADER, state);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function cachedAgeSeconds(cached: Response, now: number): number {
  const at = Number(cached.headers.get(CACHED_AT_HEADER));
  return Number.isFinite(at) && at > 0 ? (now - at) / 1000 : Infinity;
}

type EdgeCache = { match(key: string): Promise<Response | undefined>; put(key: string, response: Response): Promise<void> };
type WaitUntil = { waitUntil(promise: Promise<unknown>): void };

// Worker fetch 감싸기. 우회면 원래 핸들러 그대로(+상태 헤더), 신선한 사본이면 즉시, 오래된 사본이면 즉시 내주고
// 뒤에서 새로 만들어 넣는다(stale-while-revalidate). 캐시 오류는 삼키고 원래 경로로 간다 — 캐시는 덤이다.
export async function serveWithAnonHomeCache(
  request: Request,
  ctx: WaitUntil,
  render: (request: Request) => Promise<Response>,
  cache: EdgeCache,
  now: () => number = Date.now
): Promise<Response> {
  const key = anonHomeCacheKey(request);
  if (!key) {
    const response = await render(request);
    return request.method === "GET" && new URL(request.url).pathname === "/" ? withCacheState(response, "bypass") : response;
  }

  const refresh = async () => {
    const fresh = await render(request.clone());
    if (isStorableHomeResponse(fresh)) await cache.put(key, toCachedCopy(fresh, now()));
  };

  let cached: Response | undefined;
  try {
    cached = await cache.match(key);
  } catch {
    cached = undefined;
  }
  if (cached) {
    const age = cachedAgeSeconds(cached, now());
    if (age <= ANON_HOME_MAX_SECONDS) {
      if (age > ANON_HOME_FRESH_SECONDS) ctx.waitUntil(refresh().catch(() => {}));
      return toClientResponse(cached, age > ANON_HOME_FRESH_SECONDS ? "stale" : "hit");
    }
  }

  const response = await render(request);
  if (!isStorableHomeResponse(response)) return withCacheState(response, "bypass");
  const copy = toCachedCopy(response.clone(), now());
  ctx.waitUntil(cache.put(key, copy).catch(() => {}));
  return withCacheState(response, "miss");
}
