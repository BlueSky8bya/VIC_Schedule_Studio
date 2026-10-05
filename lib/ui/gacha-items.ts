// 생일 캡슐 뽑기 상품(2026-10-06 소유자: "동전 넣고 손잡이 돌리면 캡슐 — 열면 사진과 축하글").
// 지금은 기능 확인용 견본: 그림은 생일 그림 한 장에서 부분을 확대해 잘라 쓰고(focus = object-position,
// zoom = 확대), 축하글은 기획 중이라 자리만 둔다. 그림·글이 정해지면 이 목록만 바꾸면 된다.
// 등급 확률은 weight 합 기준(일반 60 · 레어 30 · 전설 10). 모은 기록은 기기에만(vic.gacha.collected).

export type GachaRarity = "common" | "rare" | "legend";
export type GachaItem = {
  id: string;
  rarity: GachaRarity;
  src: string;
  focus: string;
  zoom: number;
  title: string;
  message: string;
};

const ART = "/celebrate/victory-birthday.webp";
const PLACEHOLDER = "축하글 자리 — 아직 준비 중이에요. 곧 비타민의 편지가 들어가요.";

export const GACHA_ITEMS: GachaItem[] = [
  { id: "cake", rarity: "common", src: ART, focus: "50% 88%", zoom: 1.9, title: "생일 케이크", message: PLACEHOLDER },
  { id: "banner", rarity: "common", src: ART, focus: "50% 6%", zoom: 1.7, title: "축하 현수막", message: PLACEHOLDER },
  { id: "heart-bunny", rarity: "common", src: ART, focus: "16% 74%", zoom: 2.1, title: "하트 토끼", message: PLACEHOLDER },
  { id: "chalkboard", rarity: "common", src: ART, focus: "6% 30%", zoom: 2.3, title: "칠판 편지", message: PLACEHOLDER },
  { id: "gift-note", rarity: "rare", src: ART, focus: "92% 84%", zoom: 2.1, title: "선물 쪽지", message: PLACEHOLDER },
  { id: "balloon", rarity: "rare", src: ART, focus: "96% 8%", zoom: 2.3, title: "풍선 편지", message: PLACEHOLDER },
  { id: "victory", rarity: "legend", src: ART, focus: "68% 34%", zoom: 1.7, title: "주인공 빅토리", message: PLACEHOLDER },
  { id: "party", rarity: "legend", src: ART, focus: "50% 50%", zoom: 1, title: "생일 파티 전경", message: PLACEHOLDER }
];

export const RARITY_WEIGHT: Record<GachaRarity, number> = { common: 60, rare: 30, legend: 10 };
export const RARITY_LABEL: Record<GachaRarity, string> = { common: "일반", rare: "레어", legend: "전설" };

/** 등급을 먼저 뽑고(가중치), 그 등급 안에서 고르게. */
export function drawGachaItem(rand: () => number = Math.random): GachaItem {
  const total = Object.values(RARITY_WEIGHT).reduce((a, b) => a + b, 0);
  let r = rand() * total;
  let rarity: GachaRarity = "common";
  for (const k of ["common", "rare", "legend"] as const) {
    if (r < RARITY_WEIGHT[k]) {
      rarity = k;
      break;
    }
    r -= RARITY_WEIGHT[k];
  }
  const pool = GACHA_ITEMS.filter((i) => i.rarity === rarity);
  return pool[Math.floor(rand() * pool.length)] ?? GACHA_ITEMS[0];
}

const KEY = "vic.gacha.collected";
export function gachaCollected(): Set<string> {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}
export function addGachaCollected(id: string): Set<string> {
  const s = gachaCollected();
  s.add(id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...s]));
  } catch {
    /* 이번 세션만 */
  }
  return s;
}
