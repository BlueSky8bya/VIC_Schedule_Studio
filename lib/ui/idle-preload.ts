// 누르면 열리는 큰 화면(설정 창 등)의 코드를 첫 화면 뒤 한가한 때 미리 받는다.
// 첫 화면 코드에서는 빼되(받고 풀어 읽는 시간이 줄어든다), 누른 뒤에야 받으면 창이 늦게 차므로(미국 엣지 너머로 1~3초,
// 2026-11-14 그림판 사례) 화면이 뜨고 조금 지나 브라우저가 쉴 때 받아 둔다. 같은 import()라 미리 받은 묶음을 그대로 쓴다.
// 반환값 = 취소 함수(useEffect에서 그대로 돌려준다).
export function preloadWhenIdle(load: () => Promise<unknown>, afterMs = 2000): () => void {
  if (typeof window === "undefined") return () => {};
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  let idle: number | undefined;
  const warm = () => void load().catch(() => {});
  const timer = window.setTimeout(() => {
    if (w.requestIdleCallback) idle = w.requestIdleCallback(warm, { timeout: 4000 });
    else warm();
  }, afterMs);
  return () => {
    window.clearTimeout(timer);
    if (idle !== undefined) w.cancelIdleCallback?.(idle);
  };
}
