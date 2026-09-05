// 진행 중인 에셋 로드 수(2026-09-05, PLAN-20260905-005 P0) — 검증 하네스가 "장면이 다 준비됐나"를 알기 위한 단 하나의 신호.
// 아트 PNG(art/load.ts)와 Noto·SVG 스프라이트(assets.ts)가 fetch를 시작할 때 올리고 끝(성공·실패)에서 내린다.
// 렌더에는 아무 영향이 없다 — `window.__vicAmbient.pending()`·`ready()`가 읽는다.

let n = 0;

export const beginLoad = () => {
  n++;
};
export const endLoad = () => {
  n = Math.max(0, n - 1);
};
/** 지금 진행 중인 로드 수(0 = 요청한 에셋이 전부 도착했거나 실패로 끝났다). */
export const pendingLoads = () => n;
