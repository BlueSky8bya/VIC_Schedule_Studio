// 종 레지스트리(2026-09-04, Phase A) — 도감(소유자 결정 ③: 로그인 사용자만)과 스폰 감독이 공유하는 종 목록. 계획서 §8 종 카드의
// 코드 표현. 지금은 살아 있는 8종 + 우선 20종(계획서 §7 결정 ⑥)의 자리. 뷰 규칙: shadow = 물속 실루엣 · upright = 세워 그림(좌우만) ·
// topdown = 위에서 본 에셋(진행 방향 회전).

import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { Tier } from "./rarity";

export type ViewKind = "shadow" | "upright" | "topdown";
export type Species = {
  id: string;
  nameKo: string;
  seasons: readonly SeasonKey[];
  tier: Tier;
  view: ViewKind;
  /** 에셋 준비: noto = Noto Emoji 확보 · silhouette = PD top-view 실루엣 필요 · prop = 우리 SVG(무생물) */
  asset: "noto" | "silhouette" | "prop";
  /** 살아 있는 구현이 있는가(도감은 구현된 종만 센다) */
  live: boolean;
};

export const SPECIES: readonly Species[] = [
  // ── 살아 있는 8종 ──
  { id: "fish-slim", nameKo: "잉어 그림자", seasons: ["summer"], tier: "common", view: "shadow", asset: "silhouette", live: true },
  { id: "fish-fantail", nameKo: "붕어 그림자", seasons: ["summer"], tier: "common", view: "shadow", asset: "silhouette", live: true },
  { id: "duck", nameKo: "청둥오리", seasons: ["summer"], tier: "common", view: "upright", asset: "noto", live: true },
  { id: "rabbit", nameKo: "눈 토끼", seasons: ["winter"], tier: "uncommon", view: "upright", asset: "noto", live: true },
  { id: "chipmunk", nameKo: "다람쥐", seasons: ["autumn"], tier: "uncommon", view: "upright", asset: "noto", live: true },
  { id: "butterfly", nameKo: "나비", seasons: ["spring"], tier: "common", view: "topdown", asset: "noto", live: true },
  { id: "ladybug", nameKo: "무당벌레", seasons: ["spring"], tier: "common", view: "topdown", asset: "noto", live: true },
  { id: "bee", nameKo: "꿀벌", seasons: ["spring"], tier: "common", view: "upright", asset: "noto", live: true },
  // ── 우선 20종(계획서 §7 ⑥) — Phase B~D에서 live로 바뀐다 ──
  { id: "sparrow", nameKo: "참새", seasons: ["spring", "autumn", "winter"], tier: "common", view: "upright", asset: "noto", live: false },
  { id: "cat", nameKo: "고양이", seasons: ["spring", "autumn", "winter"], tier: "uncommon", view: "upright", asset: "noto", live: false },
  { id: "magpie", nameKo: "까치", seasons: ["spring", "autumn", "winter"], tier: "uncommon", view: "upright", asset: "noto", live: false },
  { id: "ant", nameKo: "개미 행렬", seasons: ["spring", "autumn"], tier: "common", view: "topdown", asset: "noto", live: false },
  { id: "treefrog", nameKo: "청개구리", seasons: ["spring"], tier: "uncommon", view: "upright", asset: "noto", live: false },
  { id: "snail", nameKo: "달팽이", seasons: ["spring"], tier: "uncommon", view: "upright", asset: "noto", live: false },
  { id: "earthworm", nameKo: "지렁이", seasons: ["spring"], tier: "common", view: "topdown", asset: "noto", live: false },
  { id: "turtle", nameKo: "붉은귀거북", seasons: ["summer"], tier: "uncommon", view: "topdown", asset: "silhouette", live: false },
  { id: "waterstrider", nameKo: "소금쟁이", seasons: ["summer"], tier: "common", view: "topdown", asset: "silhouette", live: false },
  { id: "dragonfly", nameKo: "잠자리", seasons: ["summer", "autumn"], tier: "uncommon", view: "topdown", asset: "silhouette", live: false },
  { id: "ducklings", nameKo: "새끼오리 행렬", seasons: ["summer", "spring"], tier: "rare", view: "upright", asset: "noto", live: false },
  { id: "heron", nameKo: "왜가리", seasons: ["summer"], tier: "rare", view: "shadow", asset: "silhouette", live: false },
  { id: "crow", nameKo: "까마귀", seasons: ["autumn", "winter"], tier: "uncommon", view: "upright", asset: "noto", live: false },
  { id: "squirrel-gray", nameKo: "청설모", seasons: ["autumn"], tier: "uncommon", view: "upright", asset: "silhouette", live: false },
  { id: "hedgehog", nameKo: "고슴도치", seasons: ["spring", "autumn"], tier: "rare", view: "upright", asset: "noto", live: false },
  { id: "fieldmouse", nameKo: "들쥐", seasons: ["autumn"], tier: "uncommon", view: "upright", asset: "noto", live: false },
  { id: "geese-v", nameKo: "기러기 편대", seasons: ["autumn"], tier: "rare", view: "shadow", asset: "silhouette", live: false },
  { id: "fox", nameKo: "여우", seasons: ["winter"], tier: "epic", view: "upright", asset: "noto", live: false },
  { id: "pheasant", nameKo: "꿩", seasons: ["winter", "spring"], tier: "uncommon", view: "upright", asset: "silhouette", live: false },
  { id: "eagle-shadow", nameKo: "독수리 그림자", seasons: ["winter"], tier: "epic", view: "shadow", asset: "silhouette", live: false },
  { id: "shark", nameKo: "상어", seasons: ["summer"], tier: "legend", view: "shadow", asset: "silhouette", live: false }
];

export const speciesById = (id: string): Species | undefined => SPECIES.find((s) => s.id === id);
export const speciesOf = (season: SeasonKey): Species[] => SPECIES.filter((s) => s.seasons.includes(season));
