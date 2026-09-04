// 세계의 축척(2026-09-04, PLAN-20260904-004 §2) — 동물의 숲의 장난감 비율. 타일 한 칸 = 64 CSS px, 세계의 **가장 큰 것 : 가장 작은 것 ≤ 1 : 12**.
// 소유자: "나무 크기가 주변 비율이랑 전혀 안 맞아 — 나뭇잎이 나무만하면 어떡해". 나무를 키우는 게 아니라 **작은 것(낙엽·발자국·클로버)을
// 줄인다** + 나무는 조금 키운다. 꽃은 동숲처럼 일부러 크게. 모든 장면·대체물·아트 로더는 여기서 읽는다 — 화면 px 하드코딩 금지.
// 값은 화면 **아래쪽(가까운 곳)** 기준 1× CSS px; 먼 곳은 view.ts의 depthScale이 0.8배까지 줄인다.

export const TILE = 64;

/** 크기 표(px). 이름은 계획서 §2와 같다. */
export const SIZE = {
  // 나무
  treeCrownW: 128, // 참나무 성목 수관 폭(2칸) — 반지름 64
  treeH: 192,
  debutCrownW: 192, // 데뷔 나무 상한(20m, 3칸) — 반지름 96
  pineW: 112,
  pineH: 224,
  sapling: 48,
  sprout: 20,
  // 소품
  shrub: 64,
  rock: 48,
  stump: 40,
  log: 96,
  flower: 26, // 데이지·민들레(과장)
  mushroom: 24,
  tuft: 20,
  clover: 12,
  pebble: 8,
  leafPile: 48,
  snowman: 64,
  swimRing: 64,
  acorn: 18,
  // 낙하물
  leaf: 16, // 떨어지는 낙엽(범인 1) — 지금 30~50
  petal: 6,
  // 발자국(범인 2) — 지금 36
  printSole: 18,
  printPaw: 10,
  printBird: 8,
  printRabbitHind: 10,
  printRabbitFore: 7,
  // 생물(주민 1칸 감각)
  duck: 44,
  rabbit: 40,
  chipmunk: 36,
  cat: 48,
  fox: 64,
  butterfly: 18,
  bee: 14,
  ladybug: 12,
  hopper: 17, // 메뚜기(여름 초원) — 무당벌레보다 크고 나비보다 작다

  dragonfly: 20,
  fishSmall: 28,
  fishMid: 44,
  fishBig: 72,
  shark: 160,
  lilypad: 48,
  lotus: 24
} as const;

/** 옛 값 → 새 값 배율(장면이 상수 하나로 옮겨 탈 때). */
export const LEAF_K = SIZE.leaf / 44; // ≈ .36 — 낙엽 sprite·물리 반지름 공통
export const PRINT_K = 0.5; // 발자국 절반
