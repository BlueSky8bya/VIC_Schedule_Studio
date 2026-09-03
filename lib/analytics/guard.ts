// 통계 오염 방지(2026-09-04 전수조사) — 방문 세션(visit_session)·실시간 프레즌스·행동 기록(activity_event)은
// **실제 사람의 실제 배포 화면**만 남긴다.
//
// 실사고: 로컬 dev/prod 서버(.env.local = 운영 Supabase)에서 돌린 Playwright 검증이 운영 DB에 그대로 기록됐다.
// 9월 3~4일 이틀에 anon·desktop·체류 0~2초·계정 해시 1회짜리 세션 2,900여 건(시간당 200~400건, 새 컨텍스트마다 새
// anonId), 관리자 화면 '시간대별 동접'에 새벽 4명 5시간(비주얼 스위트 워커 4개가 동시에 페이지를 열어 둔 흔적),
// '9월 3일 3,100 세션'. 8월 새벽 anon 세션 하루 15건 안팎도 같은 출처일 가능성이 크다.
//
// 판정(클라·서버 이중):
//   클라 — navigator.webdriver(헤드리스·자동화 브라우저) 또는 호스트가 localhost/127.0.0.1/::1.
//   서버 — 요청 Host가 로컬이거나 User-Agent에 HeadlessChrome/Playwright/puppeteer.
// 둘 다 '기록만' 건너뛴다 — 화면·기능엔 영향 없다(fixture·로컬 개발도 그대로 동작).

export function skipAnalyticsClient(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  try {
    if (navigator.webdriver === true) return true;
    const host = window.location.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
  } catch {
    return false;
  }
}

const BOT_UA = /HeadlessChrome|Playwright|puppeteer|Lighthouse/i;

export function skipAnalyticsRequest(headers: Headers): boolean {
  const host = (headers.get("x-forwarded-host") ?? headers.get("host") ?? "").split(":")[0].trim().toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1") return true;
  const ua = headers.get("user-agent") ?? "";
  return BOT_UA.test(ua);
}
