// 전환(transition)이 끝날 때까지 **프레임마다** 재는 작은 추적기(2026-09-19).
//
// 왜: 포스터 배율·패널 좌우 전환은 0.55초짜리 transition이라, 그 사이에 한 번 재면 중간값이
// 나온다. 그래서 여태 "지금 + 400ms + 900ms" 세 번을 재서 보정했는데, 그러면 카드가 **세 번
// 튀어** 사용자 눈엔 "타다닥" 거린다(소유자 신고: 미리보기 '편집실로 가기 | 일정 그림판' 묶음).
// 프레임마다 재면 카드가 전환과 **함께** 미끄러져, 튀는 단계 자체가 없어진다.
//
// 값이 stableMs 동안 안 바뀌면 멈춘다(전환이 끝났다는 뜻). maxMs는 안전벨트.
export function trackSettle(
  step: () => number | null,
  opts?: { maxMs?: number; stableMs?: number }
): () => void {
  const maxMs = opts?.maxMs ?? 1400;
  const stableMs = opts?.stableMs ?? 180;
  let raf = 0;
  const t0 = performance.now();
  let last: number | null = Number.NaN;
  let lastChange = t0;
  const loop = () => {
    raf = 0;
    const v = step();
    const now = performance.now();
    if (v !== last) {
      last = v;
      lastChange = now;
    }
    if (now - t0 < maxMs && now - lastChange < stableMs) raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
}
