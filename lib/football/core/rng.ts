// 결정적(deterministic) 난수 — 강화학습/리플레이의 토대. 같은 seed면 항상 같은 수열을 낸다.
// 엔진(lib/football)은 Math.random()을 절대 쓰지 않는다(재현 불가해지므로). 모든 무작위는 이 Rng로.
//
// 구현: mulberry32 (빠르고 통계적으로 충분한 32bit PRNG). DOM·시간·전역 상태에 의존하지 않는다.

export type Rng = {
  /** [0, 1) 균등 난수 */
  next(): number;
  /** [a, b) 실수 */
  range(a: number, b: number): number;
  /** [0, n) 정수 */
  int(n: number): number;
  /** 배열에서 하나 선택 */
  pick<T>(arr: readonly T[]): T;
  /** 50% 확률 */
  chance(p: number): boolean;
  /** salt로 갈라진 독립 자식 스트림(같은 부모·salt면 결정적) */
  fork(salt: number): Rng;
  /** 현재 seed(리플레이 저장용) */
  readonly seed: number;
};

export function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    seed: seed >>> 0,
    next,
    range: (a, b) => a + next() * (b - a),
    int: (n) => Math.floor(next() * n),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    fork: (salt) => makeRng((seed ^ Math.imul(salt | 0, 0x9e3779b1)) >>> 0)
  };
  return rng;
}

/** 비결정 seed가 필요할 때(라이브 경기 시작 등)만 호출. 엔진 내부에서는 쓰지 말 것. */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
