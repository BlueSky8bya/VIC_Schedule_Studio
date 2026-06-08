// VIC 일정표 — 오프라인 열람용 서비스워커. "구글 시트처럼": 인터넷 될 때 공개 일정표를 폰에 저장해
// 두고, 오프라인이면 그 마지막본을 읽기 전용으로 보여준다. 인터넷 오면 자동으로 최신 갱신.
//
// ★ 보안 원칙(이 앱 1순위) — 오프라인 스냅샷은 '비로그인(anon) 공개 포스터'다. 즉 누가 봐도 공개
//   일정만 들어 있다(이메일·하트·비공개·엠바고·작업자·스튜디오 0). 공유 기기에서도 안전.
//   · 캐시하는 것: (1) /_next/static 정적자산(앱 코드, 데이터 아님), (2) credentials 없이 받은 "/" 공개 포스터.
//   · 절대 캐시하지 않는 것: 로그인 상태의 응답(이메일 포함), /studio, /api/*, /auth, /login, 모든 쓰기(POST).
//   · 오프라인이면 어떤 화면으로 들어와도(오너의 /studio 포함) 이 '공개 포스터 스냅샷'을 보여준다 →
//     오너·개발자도 오프라인에서 공개 일정은 볼 수 있다(편집은 온라인에서만 — 비공개·언락·저장이 필요).

const CACHE = "vic-offline-v4"; // 버전 올리면 옛 캐시 자동 정리(activate에서).
const SNAPSHOT_KEY = "/__offline_snapshot"; // 비로그인 공개 포스터 스냅샷의 캐시 키(실제 "/"와 분리).
const SNAPSHOT_MIN_INTERVAL = 60_000; // 스냅샷 갱신 최소 간격(ms) — 잦은 재요청 방지.

let lastSnapshotAt = 0;

self.addEventListener("install", () => {
  self.skipWaiting(); // 새 버전 즉시 활성화
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
      await refreshSnapshot(); // 첫 방문만으로 바로 오프라인 열람 되게 미리 스냅샷.
    })()
  );
});

// 비로그인(credentials 생략) 공개 포스터 "/"를 받아 스냅샷으로 저장. 로그인 쿠키를 안 보내므로 서버가
// 공개 포스터(200)를 돌려준다 — 이메일/비공개/리다이렉트 없음. 200 + 리다이렉트 아님일 때만 저장.
async function refreshSnapshot() {
  const t = Date.now();
  if (t - lastSnapshotAt < SNAPSHOT_MIN_INTERVAL) return;
  try {
    const res = await fetch("/", { credentials: "omit", redirect: "manual", cache: "no-store" });
    if (res && res.status === 200 && !res.redirected) {
      const cache = await caches.open(CACHE);
      await cache.put(SNAPSHOT_KEY, res.clone());
      lastSnapshotAt = t; // 성공했을 때만 throttle 시작 — 실패(오프라인) 시 다음 네비에서 즉시 재시도.
      await notifyClients(t); // "마지막 동기화 시각"을 인앱 오프라인 배지에 전달.
    }
  } catch {
    /* 오프라인 등 — throttle 안 잠그고 다음 기회에 즉시 재시도 */
  }
}

// 공개 스냅샷이 갱신된 시각을 모든 열린 탭에 알린다(오프라인 배지의 "마지막 동기화 N분 전"용).
async function notifyClients(at) {
  try {
    const cs = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
    cs.forEach((c) => c.postMessage({ type: "vic-snapshot", at }));
  } catch {
    /* 무시 */
  }
}

function isStaticAsset(pathname) {
  return pathname.startsWith("/_next/static/");
}
// 가로채지도 캐시하지도 않는 경로(네트워크 그대로): API·인증. (네비게이션은 아래 navHandler가 처리)
function isPassthrough(pathname) {
  return pathname.startsWith("/api/") || pathname.startsWith("/auth");
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
  if (isPassthrough(url.pathname)) return; // API·인증은 손대지 않음(네트워크)

  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  // 페이지 이동(네비게이션) — 온라인은 네트워크 그대로(스튜디오 등 정상), 오프라인이면 공개 스냅샷.
  if (req.mode === "navigate") {
    event.respondWith(navHandler(req));
    return;
  }
  // 그 외(이미지·fetch 등)는 손대지 않음.
});

// 정적 자산(해시 불변 앱 코드) — 있으면 캐시, 없으면 받아서 캐시.
async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response("", { status: 504 });
  }
}

// 네비게이션: 온라인이면 실제 응답을 그대로 돌려주고(스튜디오·로그인·공개 모두 정상, 응답은 캐시 안 함),
// 백그라운드로 공개 스냅샷만 갱신. 오프라인이면(fetch 실패) 어떤 경로든 공개 포스터 스냅샷을 보여준다.
async function navHandler(req) {
  try {
    const res = await fetch(req);
    void refreshSnapshot(); // 응답은 캐시하지 않고, 공개 스냅샷만 최신으로(throttle).
    return res;
  } catch {
    const cache = await caches.open(CACHE);
    const snap = await cache.match(SNAPSHOT_KEY);
    if (snap) return snap; // 오너의 /studio로 들어와도 공개 포스터(읽기 전용)를 보여준다.
    return new Response(
      "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
        "<div style='font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;color:#6b5b95;background:#fffafd;text-align:center'>" +
        "<div><div style='font-size:40px'>🌙</div><p style='font-weight:800'>지금 오프라인이에요</p>" +
        "<p style='color:#9a93ad;font-size:14px'>인터넷이 연결되면 일정표가 보여요.<br>한 번이라도 열어본 적 있으면 공개 일정이 떠요.</p></div></div>",
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
