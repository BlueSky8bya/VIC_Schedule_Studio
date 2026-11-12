import { AsyncLocalStorage } from "node:async_hooks";

// 연간 인사이트 아카이브(0160)가 개발자 화면과 **같은 집계 함수**를 서버 안에서 부르기 위한 시스템 실행 문맥.
// 인사이트 액션은 개발자 게이트를 갖는데, 크론에는 로그인한 개발자가 없다. 이 문맥은 서버 코드만 열 수 있다
// (클라이언트가 서버 액션을 불러도 AsyncLocalStorage 값을 실어 보낼 길이 없다) — 게이트를 넓히지 않고 재사용한다.
const store = new AsyncLocalStorage<true>();

export function runAsInsightsSystem<T>(fn: () => Promise<T>): Promise<T> {
  return store.run(true, fn);
}

export function isInsightsSystem(): boolean {
  return store.getStore() === true;
}
