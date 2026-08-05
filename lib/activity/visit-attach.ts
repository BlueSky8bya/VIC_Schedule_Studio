// visit_key 없는 행동 기록을 '어느 방문의 일'로 볼지 정한다(순수 함수 — vitest로 검증).
//
// 왜 필요한가(2026-08-05 실측): 관리자 방문 16:33~17:44(60분) 타임라인에 항목이 **1건**만
// 떴다. 실제 DB에는 그 탭의 기록이 10건 있었는데, 페이지가 열린 직후에 찍힌 2건은
// `visit_key`가 null이었다 — 방문 키는 프레즌스 비콘이 sessionStorage에 넣는데, 화면 진입
// 기록(route.enter)이 그보다 먼저 나갔다(경합). 키 있는 8건과 키 없는 2건이 **서로 다른 방문**
// 으로 갈려, 화면에는 '항목 1건짜리 방문'이 남았다.
//
// 클라이언트는 이제 flush 시점에 키를 다시 찍어 새 기록에는 이 구멍이 없다(activity/client.ts).
// 여기 규칙은 ① 이미 쌓인 옛 기록과 ② 서버 액션(sessionStorage를 볼 수 없어 항상 키 없음)을
// 제자리에 붙이기 위한 것이다.

export type HostVisit = {
  key: string;
  accountHash: string | null;
  role: string;
  startMs: number;
  endMs: number;
};

/** 방문의 시작·끝 밖으로 이만큼은 같은 방문으로 본다(로드 직후·종료 직전 기록). */
export const ATTACH_GRACE_MS = 5 * 60_000;

/**
 * 키 없는 기록 하나를 붙일 방문을 고른다. 못 고르면 null(호출부가 별도 방문으로 만든다).
 *
 * 규칙:
 *  - **계정이 없으면 절대 안 붙인다.** 비로그인끼리는 같은 사람이라는 근거가 없다
 *    (익명끼리 뭉치면 남의 행동이 한 줄에 섞인다 — 개인 타임라인 금지 원칙과도 어긋난다).
 *  - 계정과 역할이 모두 같아야 한다. 역할 미리보기·계정 전환이 한 화면에서 일어난다.
 *  - 시간이 방문 구간(±유예) 안에 있어야 한다. 여러 개면 **시간상 가장 가까운** 방문.
 */
export function chooseHostVisit<T extends HostVisit>(
  ev: { t: number; accountHash: string | null; role: string },
  hosts: readonly T[],
  graceMs = ATTACH_GRACE_MS
): T | null {
  if (!ev.accountHash) return null;
  let best: T | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const h of hosts) {
    if (h.accountHash !== ev.accountHash || h.role !== ev.role) continue;
    if (ev.t < h.startMs - graceMs || ev.t > h.endMs + graceMs) continue;
    // 구간 안이면 gap 0. 밖이면 가까운 쪽 끝까지의 거리.
    const gap = ev.t < h.startMs ? h.startMs - ev.t : ev.t > h.endMs ? ev.t - h.endMs : 0;
    if (gap < bestGap) {
      best = h;
      bestGap = gap;
    }
  }
  return best;
}
