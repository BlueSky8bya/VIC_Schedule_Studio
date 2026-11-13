// '실제 달력 화면이 떴다'는 신호. app/loading.tsx의 스켈레톤("불러오는 중…")은 라우트 폴백이라,
// page.tsx가 실제 콘텐츠(PublicPoster/StudioShell)를 렌더해야 켜진다.
// (원래 방문 세션 비콘이 이 신호를 기다렸다 — 비콘은 2026-11-13 철수, 신호 자체는 남겨 둔다.)
// 모듈 상태는 풀 페이지 로드마다 새로 시작(콜드 로드 기준) — 의도된 동작.
let ready = false;
const listeners = new Set<() => void>();

export function markContentReady(): void {
  if (ready) return;
  ready = true;
  for (const l of listeners) l();
}

export function isContentReady(): boolean {
  return ready;
}

// 구독 — 이미 ready면 즉시 콜백, 아니면 ready 될 때 1회 호출. 해제 함수 반환.
export function onContentReady(cb: () => void): () => void {
  if (ready) {
    cb();
    return () => {};
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
