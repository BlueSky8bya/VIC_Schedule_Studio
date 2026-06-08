// VIC 일정표 — 오프라인 열람용 서비스워커. "구글 시트처럼": 인터넷 될 때 한 번 본 공개 일정표를
// 폰에 저장해 두고, 오프라인이면 그 마지막본을 보여준다. 인터넷 오면 자동으로 최신 갱신.
//
// ★ 보안 원칙(이 앱 1순위) — 공개 데이터만 캐시한다. 비공개/엠바고/작업자/스튜디오/인증/쓰기 응답은
//   절대 캐시하지도, 가로채지도 않는다(캐시는 기기에 남으므로 새면 안 됨). 아래는 명시 차단 목록이며,
//   다루는 것은 (1) /_next/static 정적자산(해시 불변), (2) 공개 포스터 루트 "/" 네비게이션의 200 응답뿐.
//   그 외 모든 요청은 손대지 않고 브라우저 기본(네트워크)대로 둔다.

const CACHE = "vic-offline-v1"; // 버전 올리면 옛 캐시 자동 정리(activate에서).

self.addEventListener("install", () => {
  self.skipWaiting(); // 새 버전 즉시 활성화
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// 절대 손대지 않는(=네트워크 그대로) 경로. 비공개·인증·쓰기·스튜디오·API 전부.
function isBlocked(pathname) {
  return (
    pathname.startsWith("/studio") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth") ||
    pathname === "/login" ||
    pathname.startsWith("/login/")
  );
}

function isStaticAsset(pathname) {
  return pathname.startsWith("/_next/static/");
}

// 캐시 대상 네비게이션은 오직 공개 포스터 루트 "/"(쿼리 무관). 다른 경로의 페이지는 캐시 안 함.
function isCacheableNav(pathname) {
  return pathname === "/";
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // 쓰기(POST 등)는 절대 손대지 않음 — 네트워크만.

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return; // 외부 도메인 무시
  if (isBlocked(url.pathname)) return; // 차단 목록 → 네트워크 기본

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (req.mode === "navigate" && isCacheableNav(url.pathname)) {
    event.respondWith(networkFirstRoot(req));
    return;
  }
  // 그 외는 손대지 않음.
});

// 정적 자산(해시 불변) — 있으면 캐시, 없으면 받아서 캐시.
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    // 정적 자산이 캐시에도 없고 네트워크도 없으면 실패 그대로.
    return new Response("", { status: 504 });
  }
}

// 공개 루트 "/" — 인터넷 우선(최신), 안 되면 마지막 저장본. 리다이렉트(오너 → /studio)는 캐시 안 함.
async function networkFirstRoot(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    // 200 + 일반 응답만 저장(리다이렉트/오류는 저장 안 함). 키는 항상 "/"로 통일.
    if (res && res.status === 200 && res.type === "basic") {
      cache.put("/", res.clone());
    }
    return res;
  } catch {
    const cached = await cache.match("/");
    if (cached) return cached;
    return new Response(
      "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
        "<div style='font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#6b5b95;background:#fffafd;text-align:center'>" +
        "<div><div style='font-size:40px'>🌙</div><p style='font-weight:800'>지금 오프라인이에요</p>" +
        "<p style='color:#9a93ad;font-size:14px'>인터넷이 연결되면 일정표가 보여요.<br>한 번이라도 열어본 적 있으면 마지막 화면이 떠요.</p></div></div>",
      { status: 503, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }
}

// 로그아웃/계정변경 시 클라이언트가 보내는 캐시 비우기 신호(공개만 캐시하지만 위생상 비운다).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "vic-clear-cache") {
    event.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
  }
});
