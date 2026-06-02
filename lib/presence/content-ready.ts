// 방문 세션을 '실제 달력 화면이 떴을 때'에만 시작하기 위한 신호.
// app/loading.tsx의 스켈레톤("불러오는 중…")은 라우트 폴백이라 layout의 PresenceBeacon이 그동안
// 이미 마운트돼 있다. 그 로딩 중 백그라운드로 빼면 방문 0이어야 하고, page.tsx가 실제 콘텐츠
// (PublicPoster/StudioShell)를 렌더해야 방문 1이어야 한다. 그래서 콘텐츠가 마운트될 때 이 신호를
// 켜고, beacon은 (신호 ON && 화면 visible)일 때만 세션을 시작한다.
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
