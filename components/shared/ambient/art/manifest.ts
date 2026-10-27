// Active art catalogue: current sky/celestial slots only (Owner2026-10-27).
// Ecology generation plans are retired; original assets and frozen evidence stay intact.

import type { SeasonKey } from "@/components/shared/ambient/registry";

export type ArtCategory = "tree" | "plant" | "ground" | "water" | "prop" | "sky" | "fish" | "bug" | "animal";
export type ArtView = "stand" | "flat" | "shadow" | "side";
export type ArtNow = "procedural" | "emoji" | "silhouette" | "svg" | "none";

export type ArtSlot = {
  /** 파일 이름 줄기(`public/ambient/art/<id>.png`) */
  id: string;
  nameKo: string;
  nameEn: string;
  category: ArtCategory;
  seasons: readonly SeasonKey[];
  view: ArtView;
  /** 화면에 놓이는 크기(CSS px, 1×). 생성물은 정사각 1024 투명 PNG — 엔진이 알파 경계로 잘라 이 상자에 맞춘다. */
  px: readonly [number, number];
  /** 변형 수(`<id>-1.png`…). 없으면 `<id>.png` 하나. */
  variants?: number;
  /** 그릴 것 — 코덱스 프롬프트의 본문(한국어). */
  brief: string;
  /** 모여봐요 동물의 숲 참고 항목(스타일 참고만 — 원본 복제 금지) */
  acnhRef?: string;
  /** 지금 화면의 원천(파일이 없을 때 보이는 것) */
  now: ArtNow;
  /** Historical metadata field; active sky entries retain their original phase. */
  phase: 1 | 2;
  /** 파일럿 배치(ENTITY_ART_PLAN §4)에서 **이번에 만들 장수**. 변형이 많아도 파일럿은 일부만 받는다(갈대 4변형 중 2장). */
  pilot?: number;
  /** 도트 격자를 자리 크기 대신 **손으로** 정한다(16·32·64·128 중). 격자는 크기만으로 정해지지 않는다 — 형태의 복잡도가 정한다.
   *  예: 참나무는 잎 덩이 가장자리의 울퉁불퉁한 요철이 그 나무의 인상이라 64칸으로는 표현할 칸이 모자란다(2026-09-07 소유자 판정). */
  grid?: 16 | 32 | 64 | 128;
  /** **한 화면에 동시에 놓이는 최대 개수**(장면 코드에서 센 값). 변형 수가 여기서 나온다 — `recommendedVariants()`.
   *  이 값이 없으면 변형 수를 감으로 정하게 되고, 실제로 그래서 소나무 2변형이 산에서 6~10회씩 반복됐다(2026-09-08 소유자 지적). */
  perScreen?: number;
  /** 정체성 소품인가(바위·나무·관목·구름 — 실루엣이 또렷해 반복이 바로 보인다) 대 잔 소품인가(풀·자갈·꽃).
   *  둘의 변형 상한이 다르다. 기본은 category로 판정하고, 예외만 여기에 적는다. */
  filler?: boolean;
};

/** 한 화면에 `perScreen`개가 깔릴 때 필요한 변형 수.
 *
 *  `ceil(perScreen / 2)`인 이유: 좌우 플립과 크기 흔들림이 있지만 **실루엣이 뚜렷한 것은 플립으로 안 가려진다**
 *  (뒤집힌 바위는 여전히 그 바위다). 그래서 /4가 아니라 /2다. 검사관 A의 판정 기준이 "같은 실루엣 6회 이상 = S-3"이므로
 *  한 변형이 두 번까지 나오는 선에서 끊는다.
 *  상한 8: 그 위로는 생성 비용이 눈에 보이는 이득을 넘는다(한 화면 12개면 8변형으로 이미 1.5회다).
 *  잔 소품(풀·자갈·꽃)은 작고 서로 겹쳐 놓여 반복이 덜 보이므로 상한 6. */
export const recommendedVariants = (perScreen: number, filler = false): number => {
  // 하한은 **화면에 놓이는 수를 넘지 않는다** — 한 화면에 셋뿐인 시스택에 변형 넷을 요구하면 그리지도 못할 장을 부탁하게 된다.
  const floor = Math.min(filler ? 2 : 4, perScreen);
  return Math.max(floor, Math.min(filler ? 6 : 8, Math.ceil(perScreen / 2)));
};

/** 이 자리가 잔 소품인가 — 카테고리 기본값 + 자리별 예외(`filler`). */
export const isFiller = (s: ArtSlot): boolean => s.filler ?? (s.category === "plant" || s.category === "prop");


// ── Current sky/celestial catalogue ──────────────────────────────────────────────────────────────────
const SKY_SLOTS: readonly ArtSlot[] = [
  {
    "id": "sun-disc",
    "nameKo": "해",
    "nameEn": "Sun",
    "category": "sky",
    "seasons": [
      "spring",
      "summer",
      "autumn",
      "winter"
    ],
    "view": "flat",
    "px": [
      96,
      96
    ],
    "variants": 2,
    "grid": 32,
    "brief": "해 원반 — 정면. 변형들: ① 한낮(크림 흰빛 #f6f8fb 중심에 옅은 미색 테) ② 노을(회장미~살구, 채도 .3 이하 — 선명한 주황 금지). 광선·별빛 십자 금지, 원반과 아주 옅은 후광만.",
    "now": "procedural",
    "phase": 1
  },
  {
    "id": "moon-phase",
    "nameKo": "달(위상)",
    "nameEn": "Moon phases",
    "category": "sky",
    "seasons": [
      "spring",
      "summer",
      "autumn",
      "winter"
    ],
    "view": "flat",
    "px": [
      80,
      80
    ],
    "variants": 8,
    "grid": 32,
    "brief": "달 여덟 위상을 **한 장씩**: 1 삭(거의 안 보이는 검푸른 원반) · 2 초승 · 3 상현 · 4 차오르는 볼록 · 5 보름 · 6 기우는 볼록 · 7 하현 · 8 그믐. 밝은 쪽은 크림 흰빛(#f6f8fb), 어두운 쪽은 밤하늘보다 살짝 밝은 검푸름. **바다(어두운 얼룩) 무늬는 보름에 가장 또렷하고 초승엔 거의 안 보인다.** 경계(터미네이터)는 톱니 픽셀로 또렷하게 — 흐린 그라데이션 금지.",
    "now": "procedural",
    "phase": 1
  },
  {
    "id": "comet",
    "nameKo": "혜성",
    "nameEn": "Comet",
    "category": "sky",
    "seasons": [
      "spring",
      "summer",
      "autumn",
      "winter"
    ],
    "view": "flat",
    "px": [
      140,
      60
    ],
    "variants": 2,
    "grid": 64,
    "brief": "혜성 — 밝은 핵과 뒤로 길게 퍼지는 꼬리. **꼬리는 밤하늘보다 밝아야 한다**: 핵은 흰빛(#f6f8fb), 꼬리는 청백 → 연보라로 옅어지며 끝은 성긴 점으로 흩어진다. 변형들은 꼬리 길이·각도가 다르다. **머리(핵)는 오른쪽, 전체 축은 오른쪽 위로 16° 남짓** — 엔진이 이 각도를 알고 진행 방향에 맞춰 돌린다(`ART_HEADING`), 다르게 그리면 꼬리가 가는 쪽과 어긋난다. 자리가 140×60(가로:세로 2.3:1)이니 **가로로 길게 눕힌 형태**로. ⚠ 1차 납품은 꼬리가 어두운 남회색이라 밤하늘에서 빛줄기가 아니라 **긁힌 자국**으로 보였고, 실루엣도 거의 정사각이라 자리의 40%만 채웠다 — 반려.",
    "now": "none",
    "phase": 1
  },
  {
    "id": "shooting-star",
    "nameKo": "별똥별",
    "nameEn": "Shooting star",
    "category": "sky",
    "seasons": [
      "spring",
      "summer",
      "autumn",
      "winter"
    ],
    "view": "flat",
    "px": [
      64,
      24
    ],
    "variants": 2,
    "grid": 64,
    "brief": "별똥별 한 줄기 — **가로로 길게 눕힌 획**(자리가 64×24로 납작하다). 앞(오른쪽 위)에 밝은 점 하나, 뒤로 가늘어지며 사라지는 꼬리. 색은 흰빛 → 옅은 청백. **머리(밝은 점)는 오른쪽, 전체 축은 오른쪽 위로 16° 남짓**이고 **전체 실루엣의 가로:세로는 2.7:1**이어야 한다 — 엔진이 이 각도를 알고 진행 방향에 맞춰 돌린다(`ART_HEADING`). ⚠ 1차 납품이 정사각 안의 계단 블록 서넛이 되어 반려됐다 — 획으로 읽혀야 한다.",
    "now": "none",
    "phase": 1
  },
  {
    "id": "cloud-low",
    "nameKo": "구름(낮은)",
    "nameEn": "Cloud, low",
    "category": "sky",
    "seasons": [
      "spring",
      "summer",
      "autumn",
      "winter"
    ],
    "view": "flat",
    "px": [
      190,
      80
    ],
    "variants": 8,
    "perScreen": 16,
    "grid": 64,
    "brief": "뭉게구름 — 위로 덩이가 부풀고 **아래쪽 윤곽이 대체로 수평**이다. 흰빛 #f6f8fb 3톤(윗면 밝고 밑면은 회청). 변형들은 덩이 수(2~5)와 너비가 확실히 다르게 — 같은 구름이 반복되면 하늘이 벽지가 된다. ⚠ **밑면을 별도의 판으로 그리지 말 것**: 1차 납품은 덩이 아래에 좌우로 더 튀어나온 평평한 선반이 붙어 탁자처럼 보였다. 아래 윤곽은 덩이들의 밑선이 이어져 수평에 가까워지는 것이지, 따로 붙인 널빤지가 아니다.",
    "now": "procedural",
    "phase": 1
  },
  {
    "id": "cloud-mid",
    "nameKo": "구름(중간)",
    "nameEn": "Cloud, mid",
    "category": "sky",
    "seasons": [
      "spring",
      "summer",
      "autumn",
      "winter"
    ],
    "view": "flat",
    "px": [
      230,
      60
    ],
    "variants": 6,
    "perScreen": 12,
    "grid": 64,
    "brief": "중간 높이의 구름 — 낮은 구름보다 옆으로 길고 납작하다(자리 230×60, 가로:세로 3.8:1), 덩이 경계가 부드럽지만 여전히 픽셀 계단. 변형들. ⚠ 뭉게구름과 같은 금지: **밑면에 따로 판을 붙이지 않는다.**",
    "now": "procedural",
    "phase": 1
  },
  {
    "id": "cloud-high",
    "nameKo": "새털구름(긴)",
    "nameEn": "Cirrus, long",
    "category": "sky",
    "seasons": [
      "spring",
      "summer",
      "autumn",
      "winter"
    ],
    "view": "flat",
    "px": [
      260,
      40
    ],
    "variants": 4,
    "perScreen": 8,
    "grid": 128,
    "brief": "새털구름 — **화면을 가로지르는 아주 납작하고 긴 띠**(자리가 260×40, 가로:세로 6.5:1이다). 붓으로 쓸어놓은 듯한 가늘고 긴 획 서넛이 **같은 방향으로 나란히 눕고** 한쪽 끝이 갈고리처럼 살짝 굽는다. 획끼리 세로로 벌어지지 않게 — 전체가 하나의 납작한 띠로 읽혀야 한다. 색은 밝은 회백 **두 톤**(한 톤이면 하늘에서 안 보인다), 알파를 낮추지 말 것. ⚠ 1차 납품이 정사각 안에 획을 흩어 놓아 화면에서 260px 자리의 18%(47×40)만 채웠다 — 반려.",
    "now": "procedural",
    "phase": 1
  },
  {
    "id": "cloud-wisp",
    "nameKo": "새털구름(짧은)",
    "nameEn": "Cirrus, short",
    "category": "sky",
    "seasons": [
      "spring",
      "summer",
      "autumn",
      "winter"
    ],
    "view": "flat",
    "px": [
      140,
      40
    ],
    "variants": 4,
    "perScreen": 8,
    "grid": 64,
    "brief": "짧은 새털구름 — 긴 새털(cloud-high)과 **같은 어법·같은 두 톤 회백**이되 길이가 절반쯤인 조각(자리 140×40, 가로:세로 3.5:1). 획 두셋이 나란히 눕고 한쪽 끝이 갈고리로 살짝 굽는다. 긴 것 사이사이에 섞여 놓이므로 **긴 것을 그대로 잘라 놓은 것처럼 보이면 안 된다** — 끝이 뭉툭하게 맺히거나 살짝 뭉쳐 한 덩이로 읽히는 쪽. **변형들은 휜 방향이 서로 반대**(왼쪽 갈고리 / 오른쪽 갈고리)라 나란히 놓아도 복제로 안 보인다.",
    "now": "procedural",
    "pilot": 2,
    "phase": 1
  },
  {
    "id": "cloud-storm",
    "nameKo": "비구름",
    "nameEn": "Rain cloud",
    "category": "sky",
    "seasons": [
      "spring",
      "summer",
      "autumn",
      "winter"
    ],
    "view": "flat",
    "px": [
      250,
      110
    ],
    "variants": 4,
    "perScreen": 8,
    "grid": 64,
    "brief": "비구름 — 아래쪽이 어둡고(회청) 위로 두껍게 솟는다. 자리 250×110(가로:세로 2.3:1)이니 옆으로 넓게. 변형들은 두께가 다르다. ⚠ 1차 납품의 두 가지 금지: **밑면의 평평한 판**(탁자 상판처럼 좌우로 튀어나왔다)과 **아래로 뻗은 사각 기둥 두 개**(탁자 다리처럼 보였다). 늘어진 자락이 필요하면 구름 몸통에서 **폭이 좁아지며 이어지는 덩이**로, 몸통과 떨어진 막대가 아니라.",
    "now": "procedural",
    "phase": 1
  }
];

// No ecology slots or species-derived generation remain.
export const ART_SLOTS: readonly ArtSlot[] = SKY_SLOTS;
export const artSlot = (id: string): ArtSlot | undefined => ART_SLOTS.find((s) => s.id === id);

/** Explicit paired assets. `seasons` describes availability, not extra output files. */
export const ART_FAMILIES: Readonly<Record<string, { slotIds: readonly string[]; pairedVariants: boolean }>> = {};

/** 자리의 파일 이름들(변형 포함) — 라우트가 존재 여부를 검사하고, 로더가 무작위로 고른다. */
export function slotFiles(s: ArtSlot): string[] {
  return s.variants && s.variants > 1 ? Array.from({ length: s.variants }, (_, i) => `${s.id}-${i + 1}.png`) : [`${s.id}.png`];
}

export const ART_DIR = "/ambient/art"; // public/ambient/art

/** 생성기 원본의 변(px) — gpt-image 계열의 최소 출력. 이보다 작게는 못 받는다(요금도 이 단위라 작게 뽑아도 안 싸다). */
export const SOURCE_EDGE = 1024;
/** 도트 격자 후보 — 1024를 정수로 나누는 값만(블록이 정수 px라야 축소가 무손실). */
const GRIDS = [16, 32, 64, 128] as const;
/** 자리의 도트 격자 — 원본 1024 안에서 그림이 가져야 할 **논리 해상도**.
 *  화면에서 도트 한 칸이 4 장치px(= DPR 2에서 CSS 2px) 안팎이 되게 잡는다: 격자 ≈ 자리 긴 변 ÷ 2.
 *  고정값을 쓰면 안 된다 — 128로 통일하면 조약돌(12px)의 도트가 0.4 장치px가 되어 아예 안 보이고, 16으로 통일하면 통나무가 레고가 된다. */
export const dotGrid = (px: readonly [number, number], override?: number): number => {
  if (override) return override;
  const want = Math.max(px[0], px[1]) / 2;
  return GRIDS.reduce((best, g) => (Math.abs(g - want) < Math.abs(best - want) ? g : best), GRIDS[0]);
};
/** 자리의 가로:세로 비 — 프롬프트에 싣는다. 엔진이 비율을 지켜 넣으므로 그림이 이 비에서 멀면 자리를 못 채운다
 *  (2026-09-08 실측: 6.5:1 자리에 1.2:1로 그려 온 새털구름이 화면에서 18%만 찼다). */
export const ratioOf = (px: readonly [number, number]) => `${(px[0] / px[1]).toFixed(px[0] / px[1] >= 10 ? 0 : 1)} : 1`;
/** 도트 한 칸의 원본 px(1024 ÷ 격자) — 코덱스가 지킬 블록 크기. */
export const dotBlock = (px: readonly [number, number], override?: number): number => SOURCE_EDGE / dotGrid(px, override);
/** 물체가 실제로 쓸 수 있는 **가로 도트 칸 수** — 격자 칸수 × (긴 변의 85%를 채운다는 규칙) × 가로 비.
 *  이 숫자를 프롬프트에 싣지 않으면 생성기가 예산을 모른 채 시작해, 16칸 자리에 디테일을 밀어 넣다 격자를 깨거나
 *  반대로 덩어리 하나로 뭉갠다(2026-09-08 소유자 지적: 바위가 "면·균열이 읽히는 돌" → "색면 덩어리"). */
export const dotsAcross = (px: readonly [number, number], override?: number): number => {
  const g = dotGrid(px, override);
  const long = Math.max(px[0], px[1]);
  return Math.max(4, Math.round(g * 0.85 * (px[0] / long)));
};

/** 저장 목표 변(px) — 반드시 **1024의 정수 약수**여야 한다(2026-09-07 결정 ⓐ′).
 *  비정수 배로 줄이면 nearest가 도트를 들쭉날쭉 버리고, lanczos3로 줄이면 도트가 아예 뭉개진다(색 76 → 3,723 실측).
 *  화면 px의 4배(DPR 2 × 확대 여유) 이상이면서 가장 작은 약수를 고른다. scripts/ambient-art-normalize.mjs와 같은 식. */
const EDGES = [128, 256, 512] as const;
export const targetEdge = (px: readonly [number, number]) => {
  const want = Math.max(px[0], px[1]) * 4;
  return EDGES.find((e) => e >= want) ?? 512;
};
/** 저장본이 원본에서 몇 분의 일인가(정수) — 보드가 "1024 ÷ 4"로 보여 준다. */
export const sourceRatio = (px: readonly [number, number]) => SOURCE_EDGE / targetEdge(px);

/** 폴더에 실제로 있는 파일(서버가 읽어 보드에 넘긴다) */
export type ArtFileInfo = { file: string; bytes: number; w: number; h: number };
export type PresentArt = Record<string, ArtFileInfo[]>;

// ── 코덱스 프롬프트 ─────────────────────────────────────────────────────────────────────────────────────
export const SEASON_KO: Record<SeasonKey, string> = { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" };
export const VIEW_KO: Record<ArtView, string> = {
  stand: "서 있는 것 — 동물의 숲 카메라(높은 앵글 약 60°에서 내려다본 3/4 정면, 위·아래가 모두 보인다). 바닥 그림자는 그리지 않는다(엔진이 그린다).",
  flat: "땅·물 위에 납작 놓인 것 — 위에서 비스듬히(3/4 카메라) 내려다본 모습: 세로가 살짝 눌린 타원 느낌(엔진이 0.7배로 한 번 더 누른다). 앞 = 위. 바닥 그림자 없음.",
  shadow: "물속·하늘 그림자 — 정확히 위에서 본 단색 실루엣(진남색 #1c3a58 한 색, 안쪽 무늬 없음). 머리 = 왼쪽.",
  side: "**옆모습** — 깊은 바다 전용(그 장면만 카메라가 다르다: 물속을 옆에서 본다, CLAUDE.md 예외 조항). 머리 = 왼쪽, 몸 전체가 한 실루엣으로 읽히게. 색은 넣되 어두운 물속에서 보이는 만큼만."
};
export const VIEW_SHORT: Record<ArtView, string> = { stand: "서 있음(3/4)", flat: "납작(3/4·눌림)", shadow: "실루엣", side: "옆모습(깊은 바다)" };

// 하늘 자리(해·달·구름·혜성·별똥별)는 `view: "flat"`이지만 **지면이 아니다** — `GROUND_SQUASH`도 원근 눌림도 안 받고
// 하늘 판에 정면 그대로 얹힌다. 지면용 문구("세로가 눌린 타원", "앞 = 위")를 그대로 보내면 생성기가 눌린 그림을 그려 온다
// (2026-09-08 짧은 새털을 부탁하다 발견 — cloud-high·해·달·혜성·별똥별이 전부 그 문구를 받아 왔다).
// **두 함수로 두는 이유**: 자리 프롬프트와 배치 표가 각자 `s.view`를 읽으면 한쪽만 고쳐져 어긋난다(실제로 한 번 그랬다).
const SKY_VIEW_KO = "하늘에 뜬 것 — **정면 그대로**(원근 눌림 없음). 배경 없이 물체만, 아래를 향한 그림자·바닥선 금지.";
/** 자리 프롬프트의 '카메라' 줄 — 하늘이면 하늘 문구. */
export const viewKoOf = (s: ArtSlot): string => (s.category === "sky" ? SKY_VIEW_KO : VIEW_KO[s.view]);
/** 배치 표의 '카메라' 칸 — 원시 키(`flat`)를 그대로 찍지 않는다. 하늘은 `sky`로 보여 가이드의 flat 항목과 안 부딪히게. */
export const viewTagOf = (s: ArtSlot): string => (s.category === "sky" ? "sky(정면)" : s.view);
export const NOW_KO: Record<ArtNow, string> = { procedural: "코드 도형", emoji: "Noto 이모지", silhouette: "PD 실루엣", svg: "우리 SVG", none: "아무것도 안 그려짐" };
export const CATEGORY_KO: Record<ArtCategory, string> = { tree: "나무", plant: "풀·꽃", ground: "지형", water: "물", prop: "소품", sky: "하늘·천체", fish: "물고기", bug: "곤충", animal: "동물" };

/** 스타일 가이드 — 모든 자리에 공통. 모여봐요 동물의 숲(참고 페이지: 물고기·곤충 도감)을 **스타일 참고**로만 쓴다. */
const ART_STYLE_HEADER = `## 스타일 가이드(모든 그림 공통)
- **확정 스타일 = 픽셀아트**(2026-09-04 확정). 굵은 픽셀 블록으로 그린 도트 그림 — 모여봐요 동물의 숲의 **소재·귀여움**에
  16비트 도트의 **또렷함**을 더한 것. 앞으로 만드는 자리는 **전부 같은 어법**이어야 한다(한 장면에 도트와 물감이 섞이면 깨진다).
  (옛 문구 "참나무는 기준이 아니다 · 재작업 대상"은 **철회한다** — 재작업본이 이미 들어왔는데 안내가 낡아 있었다.)
  소재·귀여움의 참고는 모여봐요 동물의 숲 도감 — https://animalcrossing.soopoolleaf.com/ko/acnh/Fish/ · https://animalcrossing.soopoolleaf.com/ko/acnh/Bugs/ .
  닌텐도 원본을 복제·트레이스하지 말고, 같은 소재를 **새로 그린 원작**으로.
`;
const ART_REFERENCE_GUIDE = `- 하늘·천체의 해당 합격본과 고정 참고만 확인한다. 과거 생물·식생 생성 계획은 이번 요청에 포함하지 않는다.
- 공통화풍참고는 색감·구도만 참고하며 물체·캐릭터·UI·고유 디자인을 복제하거나 트레이스하지 않는다.
`;
const ART_STYLE_SPEC = `- 기존 하늘 자리의 크기·논리 격자·블록·동시 개수·카메라·변형 파일명을 그대로 지킨다.
- 1024 투명 캔버스에 하늘 물체를 정면으로 그린다. 바닥선·아래로 향한 접지 그림자·원근 눌림을 추가하지 않는다.
- 승인 참고와 한 세트인지 실제로 비교한다. 파일당 한 장이며 이미 도착한 파일을 다시 요청하지 않는다.
- 이 프롬프트 복사는 생성·모델 다운로드·유료 API 실행 승인이 아니다.
`;
export const ART_STYLE_GUIDE = `${ART_STYLE_HEADER}${ART_REFERENCE_GUIDE}${ART_STYLE_SPEC}`;

/** 고정 입력의 역할. style-*는 공통화풍참고 색인이 고른 게임 캡처 사본이다(분위기·그림체·형태 비율만, 복제 금지). */
export type ArtPromptReferenceKind = "accepted" | "accepted-sheet" | "inspiration" | "style-mood" | "style-depiction" | "style-form";
export type ArtPromptReference = { path: string; kind: ArtPromptReferenceKind; slotId?: string; note?: string };
const REFERENCE_LABEL: Record<ArtPromptReferenceKind, string> = {
  accepted: "합격본 저장본", "accepted-sheet": "합격본 시트", inspiration: "형태 발상만",
  "style-mood": "화풍·분위기(공통화풍참고)", "style-depiction": "화풍·그림체(같은 부류)", "style-form": "형태 비율만(3D 렌더)"
};
const referenceLabel = (kind: ArtPromptReferenceKind) => REFERENCE_LABEL[kind];
const isApprovedKind = (kind: ArtPromptReferenceKind) => kind === "accepted" || kind === "accepted-sheet";
const isStyleKind = (kind: ArtPromptReferenceKind) => kind.startsWith("style-");
const fixedReferenceGuide = (inputs: readonly ArtPromptReference[]) => [
  "## 고정 입력 — 이번 요청의 유일한 이미지 참고",
  "아래 고정입력 사본을 **한 장도 빠짐없이 그림으로 첨부**해 보낸다 — 생성기는 저장소 경로를 열 수 없고, 못 본 것은 맞출 수 없다. 첨부한 파일과 관찰한 특징을 적는다. 다른 live 파일로 바꾸지 않는다.",
  ...inputs.map((input) => `- ${referenceLabel(input.kind)}: \`${input.path}\`${input.note ? ` — ${input.note}` : ""}`),
  inputs.some((input) => isApprovedKind(input.kind)) ? "화풍·부위 표현은 위 합격본 기준. 형태 발상은 이 화풍을 바꾸지 않는다." : "해당 범주의 합격본 없음. 이번 결과는 첫 화풍 승인을 위한 스타일 파일럿이다.",
  ...(inputs.some((input) => isStyleKind(input.kind))
    ? ["공통화풍참고 사본은 소유자가 모은 상업 게임 캡처다. **분위기**는 색 온도·화면 밀도·카메라만, **그림체**는 같은 부류를 그 게임이 어떻게 덩어리·외곽선·색 단수로 단순화했는지만, **형태 비율**은 부위 배치만 본다. 물체·캐릭터·UI·고유 디자인을 복제하거나 트레이스하지 않고, 렌더 질감·부드러운 명암을 흉내 내지 않는다. 도트 굵기·색 단수·외곽선 어법은 합격본과 아래 규격이 정한다."]
    : []),
  "반려 이미지는 화풍 기준이 아니다. 실패 예시가 필요하면 REJECTED 라벨·위반 ruleId·문제 crop·기대 형태를 함께 제시한다.",
  ""
].join("\n");

/** 파일럿 배치에서 실제로 받을 파일들(자리의 변형 중 앞의 `pilot`장만). */
export const pilotFiles = (s: ArtSlot): string[] => (s.pilot ? slotFiles(s).slice(0, s.pilot) : []);
/** 파일럿 자리들(ENTITY_ART_PLAN §4 — 12장) */
export const pilotSlots = (): ArtSlot[] => ART_SLOTS.filter((s) => s.pilot);

export function slotPrompt(s: ArtSlot): string {
  const files = slotFiles(s).join(", ");
  return [
    `# ${s.nameKo} (${s.nameEn}) — 파일: ${files}`,
    `- 계절: ${s.seasons.map((k) => SEASON_KO[k]).join("·")} · 화면 크기 약 ${s.px[0]}×${s.px[1]}px — **가로:세로 ${ratioOf(s.px)}** (실루엣이 이 비를 벗어나면 자리를 못 채운다). 작게 놓이므로 큰 덩어리 위주, 잔 디테일 금지`,
    `- 카메라: ${viewKoOf(s)}`,
    `- 그릴 것: ${s.brief}`,
    s.acnhRef ? `- 동물의 숲 참고 항목: ${s.acnhRef}(스타일 참고만)` : "",
    s.variants && s.variants > 1 ? `- 변형 ${s.variants}개를 각각 별도 PNG로(${files}).` : "",
    s.pilot ? `- **파일럿 배치**: 이번에는 앞의 ${s.pilot}장만 만든다(${pilotFiles(s).join(", ")}).` : "",
    `- 도트 격자: **${dotGrid(s.px, s.grid)}칸** — 도트 한 칸 = ${dotBlock(s.px, s.grid)}×${dotBlock(s.px, s.grid)}px 블록(1024 안에서). 블록 경계를 넘는 색 변화 금지.`,
    `- **도트 예산: 물체 가로 약 ${dotsAcross(s.px, s.grid)}칸.** 이 안에서 실루엣 → 면의 명암 3단 → 특징 순으로 채운다(3단은 칸이 적어도 끝까지 남긴다).`,
    s.perScreen
      ? `- ⚠ **이 그림은 한 화면에 최대 ${s.perScreen}개가 동시에 놓인다.** 그래서 변형이 ${s.variants ?? 1}개다 — 한 변형이 두 번까지만 보이게 하려는 것이다.
  **실루엣·크기·색 구성이 셋 다 갈려야 한다.** 좌우로 뒤집어도 같은 그림은 같은 그림이고(엔진이 무작위로 뒤집는다), 색만 바꾼 복제는 화면에서 바로 벽지로 읽힌다.`
      : "",
    `- 저장: 우리가 1024 → ${targetEdge(s.px)}px로 **${sourceRatio(s.px)}분의 1 정수배** 축소한다(격자를 지켜야 도트가 남는다).`,
    "",
    ART_STYLE_GUIDE
  ]
    .filter(Boolean)
    .join("\n");
}

/** 이 배치에서 이 자리에 요청할 파일들. `only`가 있으면 그 안의 것만(= 아직 안 온 파일만 다시 부탁할 때). */
const wantFiles = (s: ArtSlot, pilot: boolean, only?: ReadonlySet<string>) => {
  const base = pilot ? pilotFiles(s) : slotFiles(s);
  return only ? base.filter((f) => only.has(f)) : base;
};

/** 표 셀에 넣을 **한 줄 요약** — 첫 문장까지. 브리프 전문은 표 아래 자리별 절에 싣는다(줄바꿈이 표를 깬다). */
const briefLead = (s: ArtSlot): string => {
  const first = s.brief.split("\n")[0].trim();
  return first.length > 90 ? `${first.slice(0, 88)}…` : first;
};

const promptRow = (s: ArtSlot, pilot: boolean, only?: ReadonlySet<string>) =>
  `| ${s.id} | ${wantFiles(s, pilot, only).join(", ")} | ${s.nameKo} | ${s.seasons.map((k) => SEASON_KO[k]).join("·")} | ${viewTagOf(s)} | ${s.px[0]}×${s.px[1]} (${ratioOf(s.px)}) | ${dotGrid(s.px, s.grid)}칸 | ${dotBlock(s.px, s.grid)}px | ${dotsAcross(s.px, s.grid)}칸 | ${s.perScreen ?? "-"} | ${briefLead(s)} |`;

/** 자리별 상세 — 표 아래. 브리프 전문 + 동숲 참고. 여기가 실제 지시이고 표는 색인이다. */
const promptDetail = (s: ArtSlot, pilot: boolean, only?: ReadonlySet<string>, inputs?: readonly ArtPromptReference[]): string =>
  [
    `### ${s.nameKo} — ${wantFiles(s, pilot, only).join(", ")}`,
    `자리 ${s.px[0]}×${s.px[1]}(${ratioOf(s.px)}) · 카메라 ${viewTagOf(s)} · 격자 ${dotGrid(s.px, s.grid)}칸(블록 ${dotBlock(s.px, s.grid)}px) · 물체 가로 약 ${dotsAcross(s.px, s.grid)}칸${s.perScreen ? ` · **한 화면에 최대 ${s.perScreen}개 동시**` : ""}`,
    // 첨부되는 그림을 자리마다 **정확히** 적는다 — "<자리>를 넣어 유추하라"는 또 하나의 빈칸이고,
    // 3차가 메운 것이 바로 그런 빈칸이었다. 경로는 어느 첨부인지 가리키는 이름이지, 열라는 뜻이 아니다.
    inputs !== undefined
      ? `**이 자리에 첨부되는 고정 입력**(그림으로 온다) — ${inputs.filter((input) => !input.slotId || input.slotId === s.id).map((input) => `${referenceLabel(input.kind)} \`${input.path}\``).join(" · ") || "해당 승인 참고 없음: 스타일 파일럿으로 검토받는다."}`
      : `**그리기 전에 열어 볼 것** — 합격본 시트 \`docs/ambient/reference/${s.id}.png\`, 합격본 후보 \`public/ambient/art/${slotFiles(s)[0]}\` · 형태 발상 \`art-src/reference/${s.category}/\`(발상만). 해당 합격본이 없으면 범주·카메라에 맞는 스타일 파일럿으로 먼저 검토받는다.`,
    only ? "**아래는 전체 자리의 디자인 계획이다. 전체 변형 수·과거 반려 수량은 추가 납품 지시가 아니다. 이번 납품 범위는 위 파일 목록과 자리 표가 우선한다.**" : "",
    "",
    s.brief,
    s.acnhRef ? `\n(동물의 숲 참고 항목: ${s.acnhRef} — 스타일 참고만)` : ""
  ]
    .filter(Boolean)
    .join("\n");

/** 배치 프롬프트 — 아무 자리 묶음이나(보드의 필터 결과·파일럿·단계 전체) 코덱스에 통째로 넘길 한 장으로 만든다. */
export function batchPrompt(
  slots: readonly ArtSlot[],
  title: string,
  opts: { pilot?: boolean; note?: string; files?: readonly string[]; outputDir?: string; referenceInputs?: readonly ArtPromptReference[] } = {}
): string {
  if (slots.some(s => s.category !== "sky" || !artSlot(s.id))) throw new Error("Ecology art catalogue retired: sky slots only");
  const pilot = !!opts.pilot;
  // `files`가 오면 **그 파일들만** 표에 싣는다 — 이미 배달된 것을 다시 부탁하지 않기 위해서다(보드의 '남은 파일만').
  // 자리 단위가 아니라 **파일 단위**로 걸러야 한다: 변형이 둘인 자리는 한 장만 와 있을 수 있다(소나무 -1은 왔고 -2는 아직).
  const only = opts.files ? new Set(opts.files) : undefined;
  const rows = slots.filter((s) => wantFiles(s, pilot, only).length > 0);
  const count = rows.reduce((n, s) => n + wantFiles(s, pilot, only).length, 0);
  return `# VIC 계절 배경 아트 — 생성 의뢰(${title})

빅토리 일정표(스트리머 방송 일정 편집실)의 배경은 달력의 달을 따라 봄·여름·가을·겨울로 바뀌는 살아 있는 장면이다.
이번 요청은 현재 하늘·천체 자리만 다룬다. 식생·지형·물고기·곤충·동물 도감 계획은 철수했다.
아래 표의 **파일 이름마다 그림 한 장씩**을 만들어 달라 — ${opts.referenceInputs !== undefined ? "화풍 기준은 아래 「고정 입력」의 inputs 사본이다. 이번 납품 범위는 자리 표의 파일 목록으로만 정한다." : "스타일은 **합격본 시트**(`docs/ambient/reference/<자리>.png`)와 같은 픽셀아트다(그 시트가 이 의뢰의 정본이다)."}
너는 이 저장소 안에서 실행되므로 그 경로를 **직접 열어 볼 수 있다.** 자리마다 열어 볼 파일은 「자리별 상세」의 각 항목에 적혀 있다 — **그리기 전에 실제로 열고, 본 것을 한 줄로 적어라.**
만든 파일은 \`${opts.outputDir ?? "art-src/<범주>/<family>/runs/<run>/raw"}\`에 표의 이름 그대로 납품한다. \`public/ambient/art/\`는 합격본 전용이다. 검토 전 파일을 넣거나 기존 합격본을 덮어쓰지 않는다.
${opts.note ? `\n${opts.note}\n` : ""}
${opts.referenceInputs !== undefined ? `${ART_STYLE_HEADER}${fixedReferenceGuide(opts.referenceInputs)}${ART_STYLE_SPEC}` : ART_STYLE_GUIDE}

## 자리 표(파일 ${count}장 · 자리 ${rows.length}개)
| 자리 id | 파일 이름 | 이름 | 계절 | 카메라 | 화면 크기 | 격자 | 블록 | 가로 도트 | 한 화면 | 그릴 것 |
|---|---|---|---|---|---|---|---|---|---|---|
${rows.map((s) => promptRow(s, pilot, only)).join("\n")}

## 자리별 상세(실제 지시 — 위 표는 색인이다)

${rows.map((s) => promptDetail(s, pilot, only, opts.referenceInputs)).join("\n\n")}

## 납품
- 파일 하나에 물체 하나. 표의 이름을 그대로 파일 이름으로. **1024×1024 정사각 투명 PNG**, 품질 낮음/중간.
- **표의 격자·블록을 지킬 것**(예: 격자 64칸이면 도트 한 칸이 16×16px 블록). 이것이 이번 배치의 합격/불합격을 가르는 첫 기준이다.
- **픽셀아트 한 어법으로**: **합격본 시트**와 나란히 놓아도 한 세트로 보여야 한다(다 그린 뒤 시트 옆에 붙여 놓고 판정할 것).
  ${opts.referenceInputs !== undefined ? "이번 inputs 사본은 다시 굽거나 교체하지 않는다. 참고가 부족하면 새 요청에서 보완한다. 승인 참고가 없는 범주는 첫 화풍 검토 전 대량 생성하지 않는다." : "해당 합격본이 있으면 시트를 만들 수 있다(`node scripts/ambient-art-reference.mjs <자리>`). 합격본이 없는 범주는 **스타일 파일럿**부터 만든다. 참고가 없다는 사실을 밝히고 첫 승인 전 대량 생성하지 않는다."}
- **본 것을 적는다.** 납품에 한 줄씩 붙여라 — 연 파일 경로, 거기서 읽은 도트 굵기·색 단수, 그리고 취향 참고에서
  가져온 형태의 발상. 3차는 이 줄이 없었고, 수치를 다 통과하고도 화풍이 갈렸다.
- **단순하게**: 128px로 줄여도 읽히는 덩어리 2~3개. 잎·털·비늘 낱개, 붓 터치, 안티에일리어싱 금지.
- 하늘 물체는 기존 자리별 브리프·변형 규칙을 따른다.
- 색은 오행 규칙(선명한 빨강·주황·노랑 금지)을 어기지 않는다. 밝은 바탕(눈·모래)에 서는 줄기는 회갈색.`;
}

/** 마스터 프롬프트 — 코덱스에 통째로 붙여 넣는다(스타일 + 규칙 + 전체 표). phase로 좁힐 수 있다. */
/** Compatibility for existing local tooling; ecology generation is retired. */
export function codexMasterPrompt(phase?: 1 | 2): string {
  if (phase === 2) throw new Error("Ecology art catalogue retired");
  return batchPrompt(ART_SLOTS, "하늘·천체 전체");
}

/** Current sky pilot files only; historical ecology requests remain evidence. */
export function pilotPrompt(): string {
  return batchPrompt(pilotSlots(), "하늘·천체 파일럿", { pilot: true });
}
