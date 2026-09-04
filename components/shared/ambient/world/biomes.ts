// 바이옴 지도(2026-09-04, PLAN-20260904-004 §3) — 초원을 가운데 둔 3×3 + 남쪽 바다 두 줄 = 열한 화면. 방향은 오행 방위(북 = 물, 서 = 금/돌,
// 동 = 목/숲), 바다는 남쪽에서 시작해 남으로 갈수록 깊어진다. 먼바다·깊은 바다는 뭍이 없고 세 해안 어디서 내려가도 같은 화면(x를 0으로 접는다).
// 마을길·텃밭은 없다(소유자 ⓪). 좌표 (gx, gy): 초원 (0,0), 위가 −y.

export type BiomeKey = "valley" | "pond" | "mountain" | "hill" | "meadow" | "forest" | "tidal" | "sandy" | "rocky" | "sea" | "deep";
export type Dir = "up" | "down" | "left" | "right";

export type BiomeDef = {
  key: BiomeKey;
  nameKo: string;
  nameEn: string;
  gx: number;
  gy: number;
  /** 오행 방위·성격(알약 툴팁) */
  blurb: string;
  /** 뭍이 있는가(연대기 땅 흔적·발자국이 놓일 수 있는가) */
  land: boolean;
};

export const BIOMES: Record<BiomeKey, BiomeDef> = {
  valley: { key: "valley", nameKo: "계곡", nameEn: "Valley", gx: -1, gy: -1, blurb: "바위 사이 시내와 작은 폭포 — 물총새·수달", land: true },
  pond: { key: "pond", nameKo: "민물", nameEn: "Pond", gx: 0, gy: -1, blurb: "연못과 시내 — 오리·물고기·왜가리, 겨울엔 얼음", land: true },
  mountain: { key: "mountain", nameKo: "산", nameEn: "Mountain", gx: 1, gy: -1, blurb: "침엽수 고지와 절벽 — 눈이 먼저 오고 늦게 녹는다", land: true },
  hill: { key: "hill", nameKo: "들판·언덕", nameEn: "Hill", gx: -1, gy: 0, blurb: "억새와 바위, 바람이 보이는 곳 — 꿩·나비 떼", land: true },
  meadow: { key: "meadow", nameKo: "초원", nameEn: "Meadow", gx: 0, gy: 0, blurb: "달력 뒤의 그 초원 — 사철 같은 구도", land: true },
  forest: { key: "forest", nameKo: "숲", nameEn: "Forest", gx: 1, gy: 0, blurb: "참나무와 소나무의 그늘 — 다람쥐·올빼미·반딧불", land: true },
  tidal: { key: "tidal", nameKo: "갯벌", nameEn: "Tidal flat", gx: -1, gy: 1, blurb: "뻘과 물골, 밀물·썰물 — 칠게 떼·짱뚱어", land: true },
  sandy: { key: "sandy", nameKo: "모래해안", nameEn: "Sandy shore", gx: 0, gy: 1, blurb: "모래·조개·유목, 파도가 발자국을 지운다", land: true },
  rocky: { key: "rocky", nameKo: "암석해안", nameEn: "Rocky shore", gx: 1, gy: 1, blurb: "검은 바위와 물웅덩이, 물보라 — 가마우지·물범", land: true },
  sea: { key: "sea", nameKo: "먼바다", nameEn: "Open sea", gx: 0, gy: 2, blurb: "바다만 — 너울·물고기 떼·상어", land: false },
  deep: { key: "deep", nameKo: "깊은 바다", nameEn: "Deep sea", gx: 0, gy: 3, blurb: "어둡고 느린 물 — 발광 해파리·고래 그림자", land: false }
};

/** 미니맵 순서(위 줄부터). */
export const BIOME_ROWS: BiomeKey[][] = [
  ["valley", "pond", "mountain"],
  ["hill", "meadow", "forest"],
  ["tidal", "sandy", "rocky"],
  ["sea"],
  ["deep"]
];

export const isBiomeKey = (v: unknown): v is BiomeKey => typeof v === "string" && v in BIOMES;

/** 좌표 → 바이옴(없으면 null). gy ≥ 2는 x를 접는다(세 해안 어디서 내려가도 같은 바다). */
export function biomeAt(gx: number, gy: number): BiomeKey | null {
  if (gy === 2) return "sea";
  if (gy === 3) return "deep";
  for (const b of Object.values(BIOMES)) if (b.gx === gx && b.gy === gy) return b.key;
  return null;
}

const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** 이웃 — 바다에서 좌우는 막힘(null → 튕김), 바다에서 위로 가면 내려온 해안(lastCoastX)으로 돌아간다. */
export function neighbor(from: BiomeKey, dir: Dir, lastCoastX = 0): BiomeKey | null {
  const b = BIOMES[from];
  const [dx, dy] = DELTA[dir];
  if (b.gy >= 2) {
    if (dx !== 0) return null;
    if (dir === "up") return b.gy === 2 ? biomeAt(lastCoastX, 1) : "sea";
    return b.gy === 2 ? "deep" : null;
  }
  return biomeAt(b.gx + dx, b.gy + dy);
}

/** 화면 이동량(세계 화면 단위) — 바다 줄은 x가 접혀 있으니 시각적으로는 가로 이동 0으로 본다. */
export function screenDelta(from: BiomeKey, to: BiomeKey, lastCoastX = 0): [number, number] {
  const a = BIOMES[from];
  const b = BIOMES[to];
  const ax = a.gy >= 2 ? lastCoastX : a.gx;
  const bx = b.gy >= 2 ? (a.gy >= 2 ? lastCoastX : a.gx) : b.gx;
  return [bx - ax, b.gy - a.gy];
}
