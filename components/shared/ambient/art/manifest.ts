// 앰비언트 아트 매니페스트(2026-09-04) — 계절 배경에 놓이는 **모든 그림 자리(slot)**의 단일 목록. 소유자: "나무·초목을 기본 도형
// 몇 개 붙여 만들면 어떻게 하냐(겨울 나무 = 말미잘, 봄 초목 = 껌딱지, 가을 = 정체불명 흙더미, 여름 연잎 = 입체감 없이 겹침) —
// 모여봐요 동물의 숲처럼 식물·동물을 이어서 디자인해 한 라우트에서 한꺼번에 관리".
//
// 규칙
//  · 자리 하나 = 파일 하나: `public/ambient/art/<id>.png`(변형은 `<id>-1.png … <id>-n.png`). 파일이 있으면 장면이 그 그림을 쓰고,
//    없으면 코드 도형(procedural)·Noto 이모지·실루엣 등 지금의 대체물을 그대로 쓴다(`art/load.ts`). 파일만 떨어뜨리면 바뀐다.
//  · 카메라: **땅에 납작한 것은 위에서(flat), 서 있는 것은 동물의 숲 카메라(stand — 높은 앵글 3/4 정면, 발밑 그림자는 엔진이
//    그린다), 물속·하늘 그림자는 실루엣(shadow)**. ADR-0017 ⑮.
//  · 생성 프롬프트는 이 목록에서 만든다(`batchPrompt`·`codexMasterPrompt`·`pilotPrompt`·`slotPrompt`) — 표와 프롬프트가 어긋나지 않게 한 곳에서.
//  · 서버(라우트)와 클라이언트(장면) 둘 다 import — DOM 금지.

import type { SeasonKey } from "@/components/shared/ambient/registry";
import { CODEX, type CodexEntry } from "@/components/shared/ambient/world/codex";

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
  /** 1 = 식물·지형(지금 요청), 2 = 생물(이어서) */
  phase: 1 | 2;
  /** 파일럿 배치(ENTITY_ART_PLAN §4)에서 **이번에 만들 장수**. 변형이 많아도 파일럿은 일부만 받는다(갈대 4변형 중 2장). */
  pilot?: number;
  /** 도트 격자를 자리 크기 대신 **손으로** 정한다(16·32·64·128 중). 격자는 크기만으로 정해지지 않는다 — 형태의 복잡도가 정한다.
   *  예: 참나무는 잎 덩이 가장자리의 울퉁불퉁한 요철이 그 나무의 인상이라 64칸으로는 표현할 칸이 모자란다(2026-09-07 소유자 판정). */
  grid?: 16 | 32 | 64 | 128;
};

const ALL: readonly SeasonKey[] = ["spring", "summer", "autumn", "winter"];

// ── Phase 1: 나무·초목·지형·물 ──────────────────────────────────────────────────────────────────────────
const PHASE1: readonly ArtSlot[] = [
  // 나무(데뷔 나무·도토리에서 난 나무) — 계절마다 한 장, 크기는 엔진이 키에 맞춰 조절한다.
  { id: "tree-oak-spring", variants: 2, grid: 128, nameKo: "참나무(봄)", nameEn: "Oak, spring", category: "tree", seasons: ["spring"], view: "stand", px: [120, 150], brief: "**뭉게뭉게한 잎 덩이**가 모여 하나의 둥근 수관을 이룬다 — 매끈한 원이 아니라, 가장자리가 **울퉁불퉁하게 튀어나오고 패인** 클러스터 여러 개(6~10덩이)가 서로 겹쳐 자란 모양이다. 덩이들의 크기·위치를 **고르지 않게** 흩어 좌우가 대칭이 되지 않게 하고, 수관 위쪽 실루엣에 굴곡이 두세 군데 보이게 한다. 잎 낱개는 그리지 않되 **덩이 경계의 요철이 이 나무의 인상**이다. 색은 연둣빛 3톤(밝은 면 왼쪽 위, 그늘 오른쪽 아래). 줄기는 **따뜻한 갈색**(회갈색 아님 — 밝은 바탕 규칙은 겨울에만 적용한다), 짧고 굵으며 **밑동에서 뿌리목이 3~4갈래로 갈라져 땅을 붙잡는다**. 수관 사이로 굵은 가지가 한두 개 비친다. **계절 크기 = 0.85(새잎)** — 여름보다 덩이가 작고 사이가 성기다. 네 계절 중 여름이 가장 커야 하므로 이 장이 여름보다 커지면 안 된다.", acnhRef: "활엽수(봄 새잎)", now: "procedural", phase: 1 },
  { id: "tree-oak-summer", variants: 2, grid: 128, nameKo: "참나무(여름)", nameEn: "Oak, summer", category: "tree", seasons: ["summer"], view: "stand", px: [120, 150], brief: "봄과 **같은 줄기·같은 뿌리목·같은 가지 뼈대**, 같은 뭉게뭉게한 클러스터 어법. 잎은 짙은 초록 3톤(그늘 면은 청록). **계절 크기 = 1.0(기준 — 한 해 중 가장 크고 빽빽하다)**: 덩이가 봄보다 뚜렷이 커지고 덩이 사이 틈이 메워져 가지가 거의 안 비친다. 그래도 수관 가장자리는 매끈해지지 않는다 — 요철은 유지하고 덩이만 불어난다. 네 장 중 이 장이 가장 풍성해야 한다.", acnhRef: "활엽수(여름)", now: "procedural", phase: 1 },
  { id: "tree-oak-autumn", variants: 2, grid: 128, nameKo: "참나무(가을)", nameEn: "Oak, autumn", category: "tree", seasons: ["autumn"], view: "stand", px: [120, 150], brief: "봄과 **같은 줄기·같은 뿌리목·같은 가지 뼈대**, 같은 뭉게뭉게한 클러스터 어법. 잎 덩이는 갈색·황토·와인 3톤(갈색이 주, 붉은 기는 조금만 — 선명한 빨강·주황·노랑 금지). **계절 크기 = 0.95(잎이 지기 시작)**: 여름보다 살짝 작고 가장자리 덩이가 성겨 가지 끝이 두세 군데 드러난다. 발치의 떨어진 잎은 그리지 않는다(엔진이 흩뿌린다).", acnhRef: "활엽수(가을 단풍)", now: "procedural", phase: 1 },
  { id: "tree-oak-winter", variants: 2, grid: 128, nameKo: "참나무(겨울)", nameEn: "Oak, winter", category: "tree", seasons: ["winter"], view: "stand", px: [120, 150], brief: "봄과 **같은 줄기·같은 뿌리목**에서 굵은 가지 4~5개가 둥글게 갈라져 올라간다. 가지는 **굵고 힘 있게**(가늘고 앙상한 잔가지 다발이 아니다), 각 가지가 한두 번만 다시 갈라지며 끝이 위를 향한다 — 128px로 줄여도 나무의 골격이 읽혀야 한다. 가지 **윗면마다 눈이 두툼하게 한 겹** 얹혀 하얀 선이 가지를 따라 이어진다. 줄기는 눈밭에서 튀지 않게 **채도 낮은 회갈색**(겨울만 이 규칙).", acnhRef: "활엽수(겨울 나목)", now: "procedural", phase: 1 },
  { id: "tree-pine", nameKo: "소나무", nameEn: "Pine", category: "tree", seasons: ["spring", "summer", "autumn"], view: "stand", px: [92, 168], variants: 2, brief: "동물의 숲 침엽수처럼 단순하게: **톱니 원뿔 3단**(아래가 가장 넓고 위로 갈수록 좁다)이 짧고 굵은 회갈색 줄기 위에 얹힌다. 색은 짙은 청록 초록 3톤(밝은 면은 왼쪽 위, 그늘은 오른쪽 아래), 솔잎 낱개는 그리지 않는다. 참나무보다 **좁고 키가 크다**. **변형 2개** — 색만 바꾼 복제 금지: 단 수(3단·4단)와 아래 단의 폭, 전체 키가 서로 달라야 한다(산 한 화면에 40여 그루가 선다).", acnhRef: "침엽수", now: "procedural", pilot: 2, phase: 1 },
  { id: "tree-pine-autumn", nameKo: "소나무(가을)", nameEn: "Pine, autumn", category: "tree", seasons: ["autumn"], view: "stand", px: [92, 168], variants: 2, brief: "봄·여름 소나무와 **같은 어법·같은 줄기**. 잎만 채도를 낮춘 올리브~암녹으로(가을 갈색 지면 위에서 민트빛 초록은 붙여넣은 것처럼 뜬다). **변형 2개는 `tree-pine-1`·`tree-pine-2`와 각각 짝을 이룬다** — 1은 1의 실루엣, 2는 2의 실루엣에 가을 색을 입힌 것. 같은 산에 두 그루가 나란히 서므로 형태가 갈려야 한다.", acnhRef: "침엽수(가을)", now: "procedural", pilot: 2, phase: 1 },
  { id: "tree-pine-winter", nameKo: "소나무(겨울)", nameEn: "Pine, winter", category: "tree", seasons: ["winter"], view: "stand", px: [92, 168], variants: 2, brief: "같은 어법·같은 줄기. 잎은 더 어둡고 채도가 낮으며, 각 단의 **윗면에만** 눈이 한 겹 얹힌다(아래 그늘은 옅은 청회색). 눈은 색이 아니라 **실루엣**을 바꾼다 — 단 위에 두툼하게 얹혀 윤곽이 둥글어진다. **변형 2개는 `tree-pine-1`·`tree-pine-2`와 각각 짝을 이룬다**(1은 1의 실루엣, 2는 2의 실루엣).", acnhRef: "침엽수(겨울)", now: "procedural", pilot: 2, phase: 1 },
  { id: "sapling-green", variants: 2, nameKo: "어린 나무(잎)", nameEn: "Sapling, leafy", category: "tree", seasons: ["spring", "summer"], view: "stand", px: [40, 48], brief: "무릎 높이의 어린 참나무 — 가는 줄기 하나에 둥근 잎 3~4장(크게, 낱잎 그대로 단순하게). 밝은 초록.", acnhRef: "묘목", now: "emoji", phase: 1 },
  { id: "sapling-autumn", variants: 2, nameKo: "어린 나무(가을)", nameEn: "Sapling, autumn", category: "tree", seasons: ["autumn"], view: "stand", px: [40, 48], brief: "어린 참나무(같은 실루엣), 둥근 잎 2~3장이 갈색·와인.", acnhRef: "묘목", now: "emoji", phase: 1 },
  { id: "sapling-bare", variants: 2, nameKo: "어린 나무(겨울)", nameEn: "Sapling, bare", category: "tree", seasons: ["winter"], view: "stand", px: [40, 48], brief: "잎 없는 어린 참나무 — 가는 줄기와 잔가지 둘, 눈이 조금 얹힌다.", acnhRef: "묘목", now: "emoji", phase: 1 },
  { id: "sprout", nameKo: "새싹", nameEn: "Sprout", category: "plant", seasons: ["spring", "summer", "autumn"], view: "stand", px: [24, 28], brief: "흙을 막 뚫고 나온 떡잎 두 장. 통통하고 둥근 잎, 짧은 줄기, 발치에 흙 부스러기 조금.", acnhRef: "새싹", now: "emoji", phase: 1 },
  { id: "shrub-spring", variants: 2, nameKo: "관목(봄)", nameEn: "Shrub, spring", category: "tree", seasons: ["spring"], view: "stand", px: [62, 66], brief: "허리 높이의 둥근 관목, 연둣빛 새잎, 작은 흰 꽃 몇 송이. **계절 크기 = 0.85(새잎)** — 여름보다 작고 성기다.", acnhRef: "울타리 관목(진달래류)", now: "procedural", phase: 1 },
  { id: "shrub-summer", variants: 2, nameKo: "관목(여름)", nameEn: "Shrub, summer", category: "tree", seasons: ["summer"], view: "stand", px: [62, 66], brief: "짙은 초록 둥근 관목, 잎이 빽빽하다. **계절 크기 = 1.0(기준 — 네 계절 중 가장 크고 빽빽하다)**: 봄보다 뚜렷이 크고 틈이 메워져 있다.", acnhRef: "울타리 관목(수국은 파랑 대신 연보라)", now: "procedural", phase: 1 },
  { id: "shrub-autumn", variants: 2, nameKo: "관목(가을)", nameEn: "Shrub, autumn", category: "tree", seasons: ["autumn"], view: "stand", px: [62, 66], brief: "갈색·와인으로 물든 둥근 관목, 잎이 성기다. **계절 크기 = 0.95** — 여름보다 살짝 작고 가장자리가 성겨 잔가지가 조금 드러난다.", acnhRef: "울타리 관목(가을)", now: "procedural", pilot: 1, phase: 1 },
  { id: "shrub-winter", nameKo: "관목(겨울)", nameEn: "Shrub, winter", category: "tree", seasons: ["winter"], view: "stand", px: [62, 66], brief: "잔가지만 남은 둥근 관목 위에 눈이 소복이 덮였다.", acnhRef: "울타리 관목(겨울)", now: "procedural", phase: 1 },
  // 풀·꽃
  { id: "grass-tuft", nameKo: "풀포기", nameEn: "Grass tuft", category: "plant", seasons: ["spring", "summer"], view: "stand", px: [22, 18], variants: 3, brief: "잔디 위에 솟은 풀포기 — 잎 5~7가닥이 부채꼴로 벌어지고 끝이 살짝 휜다. 밝은 초록, 뿌리 쪽은 어둡다. 변형 3개는 가닥 수와 휜 방향이 다르다.", acnhRef: "잡초(풀)", now: "procedural", phase: 1 },
  { id: "grass-tall", nameKo: "키큰 풀(강아지풀)", nameEn: "Tall grass / foxtail", category: "plant", seasons: ["summer"], view: "stand", px: [26, 46], variants: 3, brief: "무릎까지 오는 여름 풀 한 포기 — 길고 활처럼 휜 잎 4~6가닥 위로 **고개 숙인 원통 이삭**(강아지풀) 한두 대가 솟는다. 짙은 청록 초록에 이삭만 옅은 황록. 변형 3개는 이삭 수와 휜 방향이 다르다.", acnhRef: "여름 풀숲", now: "procedural", phase: 1 },
  { id: "grass-dry", nameKo: "마른 풀", nameEn: "Dry grass", category: "plant", seasons: ["autumn", "winter"], view: "stand", px: [22, 18], variants: 3, brief: "시든 풀포기 — 황토·밀짚색 가닥이 옆으로 누웠다. 변형 3개.", acnhRef: "잡초(가을)", now: "procedural", phase: 1 },
  { id: "clover", nameKo: "클로버", nameEn: "Clover", category: "plant", seasons: ["spring", "summer"], view: "flat", px: [14, 12], variants: 2, brief: "위에서 본 세잎클로버 두세 포기가 모인 작은 무리. 둥근 하트 잎, 잎 가운데 옅은 흰 무늬.", acnhRef: "클로버(잡초)", now: "procedural", phase: 1 },
  { id: "daisy", nameKo: "데이지", nameEn: "Daisy", category: "plant", seasons: ["spring"], view: "stand", px: [16, 18], variants: 2, brief: "흰 꽃잎 8~10장에 옅은 노란 가운데(채도 낮은 크림 노랑)를 가진 데이지 한 송이, 짧은 줄기와 잎 두 장. 벌·나비가 앉는 자리라 꽃 얼굴이 위·앞을 본다.", acnhRef: "흰 꽃(데이지류)", now: "procedural", phase: 1 },
  { id: "dandelion-flower", nameKo: "민들레(꽃)", nameEn: "Dandelion, flower", category: "plant", seasons: ["spring"], view: "stand", px: [16, 22], brief: "채도 낮은 크림 노랑 민들레 꽃 한 송이(선명한 노랑 금지), 톱니 잎 셋.", acnhRef: "민들레", now: "procedural", phase: 1 },
  { id: "dandelion-puff", nameKo: "민들레(홀씨)", nameEn: "Dandelion, seed head", category: "plant", seasons: ["spring"], view: "stand", px: [20, 26], brief: "홀씨가 가득 찬 둥근 흰 솜 머리와 가는 줄기. 클릭하면 홀씨가 날아가므로 머리는 또렷한 흰 점들이 보이게.", acnhRef: "민들레 홀씨", now: "procedural", phase: 1 },
  { id: "mushroom", nameKo: "버섯", nameEn: "Mushroom", category: "plant", seasons: ["autumn"], view: "stand", px: [20, 22], variants: 2, brief: "갈색 갓에 크림색 점이 몇 개 찍힌 통통한 버섯(빨간 독버섯 금지 — 밤색·황토). 변형 2개: 하나는 작은 두 송이가 붙었다.", acnhRef: "버섯(가을)", now: "procedural", phase: 1 },
  { id: "reed", nameKo: "갈대·억새", nameEn: "Reed / silver grass", category: "plant", seasons: ["summer", "autumn", "winter"], view: "stand", px: [30, 70], variants: 4, brief: "물가에 선 갈대 서너 대 — 긴 잎과 갈색 이삭, 살짝 휘었다. **변형 4개**(자리마다 대의 수·키·휜 방향이 달라야 한다 — 물가에 수십 대가 서므로 같은 실루엣 복제는 바로 벽지로 읽힌다). 이번 배치는 표의 파일만.", acnhRef: "물가 풀", now: "procedural", pilot: 2, phase: 1 },
  // 물
  { id: "lilypad", nameKo: "연잎", nameEn: "Lily pad", category: "water", seasons: ["summer"], view: "flat", px: [56, 56], variants: 3, brief: "위에서 본 연잎 — 둥근 잎에 V자 갈라짐 하나, 잎맥이 가운데서 퍼지고 가장자리가 살짝 말려 올라 **두께가 보인다**(가장자리에 옅은 밝은 테 + 아래쪽 어두운 띠). 변형 3개는 갈라진 방향·크기가 다르다.", acnhRef: "연못 연잎", now: "procedural", phase: 1 },
  { id: "lotus", nameKo: "연꽃", nameEn: "Lotus", category: "water", seasons: ["summer"], view: "stand", px: [26, 24], brief: "연잎 위에 핀 연분홍 연꽃 한 송이(채도 낮게).", acnhRef: "연꽃", now: "procedural", phase: 1 },
  // 지형·소품
  { id: "soil-mound", nameKo: "흙더미(저장소)", nameEn: "Soil mound", category: "ground", seasons: ALL, view: "flat", px: [28, 16], brief: "위에서 본 작은 흙더미 — 다람쥐가 도토리를 묻고 두드린 자리. 둥근 흙 덩이, 가운데 조금 어둡고 테는 흩어진 흙 알갱이.", acnhRef: "땅에 묻힌 자리(별 모양 갈라짐 말고 자연스러운 흙)", now: "procedural", phase: 1 },
  { id: "molehill", nameKo: "두더지 흙더미", nameEn: "Molehill", category: "ground", seasons: ["spring"], view: "stand", px: [34, 22], brief: "봉긋 솟은 새 흙더미(두더지가 밀어 올린 것). 따뜻한 갈색, 위쪽이 밝고 아래가 어둡다.", acnhRef: "흙더미", now: "procedural", phase: 1 },
  { id: "grass-patch", nameKo: "풀 얼룩", nameEn: "Grass patch", category: "ground", seasons: ["summer"], view: "flat", px: [40, 28], brief: "위에서 본, 주변보다 조금 진한 초록 풀 얼룩(두더지 흙더미가 여름에 풀로 덮인 자리). 가장자리가 부드럽게 번진다.", now: "procedural", phase: 1 },
  { id: "twig", nameKo: "잔가지", nameEn: "Twig", category: "ground", seasons: ["autumn", "winter"], view: "flat", px: [36, 14], variants: 2, brief: "땅에 떨어진 마른 잔가지 — 한 번 갈라지고, 껍질 결이 보인다. 변형 2개.", acnhRef: "나뭇가지(재료)", now: "procedural", phase: 1 },
  { id: "pebble", nameKo: "조약돌", nameEn: "Pebble", category: "ground", seasons: ALL, view: "flat", px: [12, 9], variants: 3, brief: "위에서 본 둥근 조약돌 — 회색·밝은 회갈색, 위쪽에 작은 하이라이트. 변형 3개.", now: "procedural", phase: 1 },
  { id: "rock", nameKo: "바위", nameEn: "Rock", category: "ground", seasons: ALL, view: "stand", px: [40, 30], variants: 4, brief: "무릎 높이의 둥글둥글한 바위, 이끼가 조금 앉았다. **변형 4개** — 실루엣 자체가 서로 달라야 한다(넓적·길쭉·모난·둥근). 이끼 자리와 갈라진 금도 각각 다르게. 색만 바꾼 복제 금지.", acnhRef: "바위", now: "procedural", pilot: 4, phase: 1 },
  { id: "stump", variants: 2, nameKo: "그루터기", nameEn: "Stump", category: "ground", seasons: ALL, view: "stand", px: [36, 28], brief: "잘린 나무 그루터기 — 위에 나이테가 보이고 옆면은 껍질.", acnhRef: "그루터기", now: "procedural", phase: 1 },
  { id: "log", variants: 2, nameKo: "통나무", nameEn: "Log", category: "ground", seasons: ["summer", "autumn"], view: "stand", px: [70, 26], brief: "물가에 누운 통나무 한 토막, 한쪽 끝에 나이테.", acnhRef: "통나무", now: "procedural", phase: 1 },
  { id: "snowman-1", nameKo: "눈사람(공 하나)", nameEn: "Snowman, one ball", category: "prop", seasons: ["winter"], view: "stand", px: [44, 30], brief: "막 굴린 큰 눈덩이 하나(눈사람 1단계). 표면에 굴린 자국이 살짝.", acnhRef: "눈덩이", now: "procedural", phase: 1 },
  { id: "snowman-2", nameKo: "눈사람(공 둘)", nameEn: "Snowman, two balls", category: "prop", seasons: ["winter"], view: "stand", px: [44, 52], brief: "눈덩이 두 개를 쌓은 눈사람(2단계, 얼굴 없음).", acnhRef: "눈사람", now: "procedural", phase: 1 },
  { id: "snowman-3", nameKo: "눈사람(완성)", nameEn: "Snowman, complete", category: "prop", seasons: ["winter"], view: "stand", px: [44, 72], brief: "완성된 눈사람 — 공 셋, 나뭇가지 팔, 조약돌 눈과 단추(무채색), 작은 목도리는 채도 낮은 회청색.", acnhRef: "눈사람", now: "procedural", phase: 1 },
  { id: "snow-pile", nameKo: "눈 무더기", nameEn: "Snow pile", category: "ground", seasons: ["winter"], view: "stand", px: [40, 24], variants: 2, brief: "바람에 쌓인 부드러운 눈 무더기, 위쪽은 희고 그늘은 옅은 청회색. 변형 2개.", now: "procedural", phase: 1 },
  { id: "acorn", nameKo: "도토리", nameEn: "Acorn", category: "prop", seasons: ["autumn"], view: "flat", px: [20, 26], brief: "위에서 본 도토리 하나 — 갈색 열매와 까슬한 깍정이(모자), 꼭지 짧게.", acnhRef: "도토리", now: "svg", phase: 1 },
  { id: "swim-ring", nameKo: "튜브", nameEn: "Swim ring", category: "prop", seasons: ["summer"], view: "flat", px: [92, 92], brief: "위에서 본 도넛 튜브 — 채도 낮은 민트·크림 줄무늬(빨강·주황 금지), 옆면 두께가 보인다.", now: "svg", phase: 1 },

  // ── 해안(2026-09-05) — 앞의 셋은 장면이 **이미 부르고 있는데 자리가 없어** 아무것도 안 그려지던 것들이다.
  { id: "driftwood", nameKo: "유목", nameEn: "Driftwood", category: "ground", seasons: ALL, view: "stand", px: [86, 30], variants: 3, brief: "파도에 씻겨 은회색으로 바랜 나무토막 — 껍질은 벗겨졌고 결이 길게 갈라졌다. 한쪽 끝이 부러져 뾰족하다. 변형 3개는 굽은 방향과 길이가 다르다.", acnhRef: "해변 유목", now: "procedural", phase: 1 },
  { id: "shell-clam", nameKo: "조개껍데기", nameEn: "Clam shell", category: "ground", seasons: ALL, view: "flat", px: [22, 16], variants: 3, brief: "위에서 본 조개껍데기 한 짝 — 크림빛 흰색에 부챗살 결이 방사로 뻗는다. 가장자리에 옅은 모래 그늘. 변형 3개는 크기와 결의 수가 다르다.", acnhRef: "조개(해변 재료)", now: "procedural", phase: 1 },
  { id: "starfish", nameKo: "불가사리", nameEn: "Starfish", category: "ground", seasons: ALL, view: "flat", px: [26, 26], brief: "위에서 본 불가사리 — 팔 다섯, 채도 낮은 살구·모래빛(선명한 주황 금지), 표면에 오톨도톨한 점.", acnhRef: "불가사리", now: "procedural", phase: 1 },
  { id: "sea-stack", nameKo: "시스택(갯바위 기둥)", nameEn: "Sea stack", category: "ground", seasons: ALL, view: "stand", px: [90, 130], variants: 2, brief: "파도가 깎다 남긴 바위 기둥 — 위로 갈수록 좁고 옆면에 가로 층리, 발치는 늘 젖어 어둡고 흰 따개비 띠가 한 줄. 변형 2개는 기울기가 다르다(이번 배치는 1개).", now: "none", pilot: 1, phase: 1 },
  { id: "seaweed-clump", nameKo: "해조 뭉치", nameEn: "Seaweed clump", category: "plant", seasons: ALL, view: "flat", px: [40, 26], variants: 2, brief: "물가에 밀려 올라온 미역·모자반 뭉치 — 젖어서 짙은 올리브·암갈색, 납작하게 눌려 있고 가닥이 몇 갈래 삐져나왔다.", now: "none", phase: 1 },
  { id: "dune-grass", nameKo: "통보리사초", nameEn: "Dune grass", category: "plant", seasons: ALL, view: "stand", px: [34, 44], variants: 3, brief: "모래언덕의 억센 사초 — 뻣뻣하고 곧은 잎 5~7가닥이 위로 벌어지고 끝이 살짝 마른 밀짚색. 밑동에 모래가 조금 쌓였다.", now: "none", phase: 1 },
  { id: "tide-pool", nameKo: "조수 웅덩이", nameEn: "Tide pool", category: "water", seasons: ALL, view: "flat", px: [70, 40], variants: 2, brief: "위에서 본 암반의 물웅덩이 — 주변 바위보다 **어둡고**, 가장자리는 젖은 검은 테, 안쪽에 하늘이 비친 밝은 조각 하나와 짙은 해조 몇 점.", now: "none", phase: 1 },
  { id: "gravel-patch", nameKo: "자갈밭", nameEn: "Gravel patch", category: "ground", seasons: ALL, view: "flat", px: [72, 46], variants: 2, brief: "위에서 본 자갈 무리 — 회색·회갈색 각진 돌 열댓 개가 모여 있다. 낱개가 아니라 **한 덩이 얼룩**으로 읽히게.", now: "none", phase: 1 },

  // ── 숲·초목(2026-09-05) — 수종·하층 식생을 넓힌다.
  { id: "tree-birch-spring", variants: 2, nameKo: "자작나무(봄)", nameEn: "Birch, spring", category: "tree", seasons: ["spring"], view: "stand", px: [96, 160], brief: "참나무보다 **가늘고 곧은 흰 줄기**(검은 가로 눈 무늬 몇 개)가 특징. 잎 덩이는 작고 성글게 3덩이, 연둣빛.", acnhRef: "활엽수", now: "none", phase: 1 },
  { id: "tree-birch-summer", variants: 2, nameKo: "자작나무(여름)", nameEn: "Birch, summer", category: "tree", seasons: ["summer"], view: "stand", px: [96, 160], brief: "봄과 같은 흰 줄기·같은 실루엣, 잎 덩이만 짙은 초록.", now: "none", phase: 1 },
  { id: "tree-birch-autumn", variants: 2, nameKo: "자작나무(가을)", nameEn: "Birch, autumn", category: "tree", seasons: ["autumn"], view: "stand", px: [96, 160], brief: "봄과 같은 흰 줄기, 잎 덩이는 탁한 황갈·베이지(선명한 노랑 금지).", now: "none", phase: 1 },
  { id: "tree-birch-winter", nameKo: "자작나무(겨울)", nameEn: "Birch, winter", category: "tree", seasons: ["winter"], view: "stand", px: [96, 160], brief: "잎 없는 흰 줄기와 가는 가지 몇 갈래. 가지 위에 눈이 얇게.", now: "none", phase: 1 },
  { id: "fern", nameKo: "고사리", nameEn: "Fern", category: "plant", seasons: ["spring", "summer", "autumn"], view: "stand", px: [44, 40], variants: 3, brief: "숲 바닥의 고사리 한 포기 — 깃 모양 잎 3~5장이 부채꼴로 눕는다. 봄은 연둣빛, 가을은 마른 갈색. 잎맥은 그리지 않는다(128px에서 안 보인다).", acnhRef: "양치식물", now: "none", phase: 1 },
  { id: "moss-patch", nameKo: "이끼", nameEn: "Moss patch", category: "ground", seasons: ["spring", "summer", "autumn"], view: "flat", px: [40, 26], variants: 2, brief: "위에서 본 이끼 얼룩 — 짙은 이끼초록, 가장자리가 들쭉날쭉하고 표면이 오톨도톨하다.", now: "none", phase: 1 },
  { id: "silver-grass", nameKo: "억새 포기", nameEn: "Silver grass tussock", category: "plant", seasons: ALL, view: "stand", px: [60, 78], variants: 3, brief: "억새 한 **포기** — 잎이 부채꼴로 크게 벌어지고 끝이 아래로 휜다. 9~2월에는 잎 덩이보다 위로 은빛 이삭 두세 대가 솟는다(여름 변형은 이삭 없음). 색은 은빛 베이지~마른 밀짚.", now: "none", phase: 1 },
  { id: "sedge", nameKo: "사초", nameEn: "Sedge", category: "plant", seasons: ["spring", "summer", "autumn"], view: "stand", px: [30, 34], variants: 2, brief: "물가·하안의 낮은 사초 포기 — 가는 잎이 촘촘히 곧게 서고 끝만 살짝 휜다. 짙은 청록.", now: "none", phase: 1 },
  { id: "cattail", nameKo: "부들", nameEn: "Cattail", category: "plant", seasons: ["summer", "autumn", "winter"], view: "stand", px: [26, 72], variants: 2, brief: "긴 곧은 줄기 끝에 **갈색 소시지 모양 이삭**. 잎은 줄기를 따라 두세 장, 칼처럼 곧다. 갈대(reed)와 실루엣이 확실히 달라야 한다.", acnhRef: "물가 풀", now: "none", phase: 1 },
  { id: "bramble", nameKo: "덤불(가시)", nameEn: "Bramble", category: "plant", seasons: ["summer", "autumn"], view: "stand", px: [56, 44], brief: "낮게 얽힌 가시덤불 — 가는 줄기가 서로 겹쳐 아치를 그리고 작은 잎이 드문드문. 가을 변형엔 검붉은 열매 몇 알(채도 낮게).", now: "none", phase: 1 },

  // ── 초원 야생화(2026-09-05) — 지금은 데이지 한 종뿐이라 봄 초원이 단조롭다.
  { id: "flower-white", nameKo: "흰 야생화", nameEn: "Wildflower, white", category: "plant", seasons: ["spring", "summer"], view: "stand", px: [18, 22], variants: 2, brief: "흰 꽃잎 다섯에 크림 노랑 가운데, 가는 줄기와 잎 두 장. 데이지보다 작고 여러 송이가 한 대에 달린다.", now: "none", phase: 1 },
  { id: "flower-violet", nameKo: "보랏빛 야생화", nameEn: "Wildflower, violet", category: "plant", seasons: ["spring", "summer"], view: "stand", px: [18, 24], variants: 2, brief: "연보라 꽃 두세 송이가 한 줄기에 층으로 달린다(제비꽃·꿀풀류). 잎은 아래에 넓게 두 장.", now: "none", phase: 1 },
  { id: "flower-cream", nameKo: "크림빛 야생화", nameEn: "Wildflower, cream", category: "plant", seasons: ["spring", "summer", "autumn"], view: "stand", px: [20, 26], brief: "크림·연노랑 작은 꽃이 우산처럼 모여 핀다(산형화). 줄기는 가늘고 곧다. 선명한 노랑 금지.", now: "none", phase: 1 },

  // ── 지형·소품(2026-09-05)
  { id: "boulder", nameKo: "큰 바위", nameEn: "Boulder", category: "ground", seasons: ALL, view: "stand", px: [96, 72], variants: 3, brief: "사람 키만 한 바위 — `rock`(무릎 높이)보다 훨씬 크고 각이 뚜렷하다. 윗면은 밝고 아래·오른쪽은 그늘, 갈라진 금 두어 줄과 이끼 얼룩. 변형 3개는 실루엣이 다르다.", acnhRef: "바위", now: "none", phase: 1 },
  { id: "snow-drift", nameKo: "눈 이랑", nameEn: "Snow drift", category: "ground", seasons: ["winter"], view: "flat", px: [120, 44], variants: 2, brief: "바람이 쌓아 올린 눈 이랑 — 바람 맞는 쪽은 완만하고 반대쪽은 급하게 떨어진다(비대칭). 마루는 희고 그늘은 옅은 청회색, 가장자리는 지면으로 스민다.", now: "none", phase: 1 },
  { id: "icicle", nameKo: "고드름", nameEn: "Icicle", category: "prop", seasons: ["winter"], view: "stand", px: [18, 40], variants: 2, brief: "바위 턱·가지 끝에 달린 고드름 두세 개 — 투명한 청백색, 끝으로 갈수록 가늘다.", now: "none", phase: 1 },
  { id: "pinecone", nameKo: "솔방울", nameEn: "Pine cone", category: "prop", seasons: ["autumn", "winter"], view: "flat", px: [18, 24], variants: 2, brief: "위에서 본 솔방울 — 갈색 비늘이 나선으로 벌어졌다. 도토리와 실루엣이 헷갈리지 않게 길쭉하게.", now: "none", phase: 1 },
  { id: "feather", nameKo: "깃털", nameEn: "Feather", category: "prop", seasons: ALL, view: "flat", px: [28, 12], variants: 2, brief: "땅에 떨어진 깃털 한 장 — 회백·회갈, 깃대와 갈라진 깃가지가 보인다.", now: "none", phase: 1 },
  { id: "berry-bush", nameKo: "열매 관목", nameEn: "Berry bush", category: "plant", seasons: ["summer", "autumn"], view: "stand", px: [58, 54], brief: "둥근 관목에 검붉은 작은 열매가 무리로 달렸다(채도 낮게, 선명한 빨강 금지). 잎은 짙은 초록·가을엔 와인.", now: "none", phase: 1 },
  { id: "puddle", nameKo: "물웅덩이", nameEn: "Puddle", category: "water", seasons: ["spring", "summer", "autumn"], view: "flat", px: [56, 30], variants: 2, brief: "비 온 뒤 땅에 고인 얕은 물 — 가장자리는 젖은 흙으로 어둡고, 안쪽에 하늘이 비쳐 밝다. 아주 얕아 바닥이 비친다.", now: "none", phase: 1 },
  // ── 천체·구름(2026-09-07, PLAN-008) — 지금은 전부 `world/sky.ts`가 코드로 굽는다. 하늘은 화면의 26%인데
  //    "같은 원반 하나 + 같은 얼룩"이라 계절이 바뀌어도 하늘만 늘 같다. 달은 위상 여덟 장이 곧 **날짜의 표정**이고,
  //    혜성·유성은 도감처럼 "그날 밤에만 본 것"이 된다.
  { id: "sun-disc", nameKo: "해", nameEn: "Sun", category: "sky", seasons: ALL, view: "flat", px: [96, 96], variants: 2, grid: 32, brief: "해 원반 — 정면. 변형 2개: ① 한낮(크림 흰빛 #f6f8fb 중심에 옅은 미색 테) ② 노을(회장미~살구, 채도 .3 이하 — 선명한 주황 금지). 광선·별빛 십자 금지, 원반과 아주 옅은 후광만.", now: "procedural", phase: 1 },
  { id: "moon-phase", nameKo: "달(위상)", nameEn: "Moon phases", category: "sky", seasons: ALL, view: "flat", px: [80, 80], variants: 8, grid: 32, brief: "달 여덟 위상을 **한 장씩**: 1 삭(거의 안 보이는 검푸른 원반) · 2 초승 · 3 상현 · 4 차오르는 볼록 · 5 보름 · 6 기우는 볼록 · 7 하현 · 8 그믐. 밝은 쪽은 크림 흰빛(#f6f8fb), 어두운 쪽은 밤하늘보다 살짝 밝은 검푸름. **바다(어두운 얼룩) 무늬는 보름에 가장 또렷하고 초승엔 거의 안 보인다.** 경계(터미네이터)는 톱니 픽셀로 또렷하게 — 흐린 그라데이션 금지.", now: "procedural", phase: 1 },
  { id: "comet", nameKo: "혜성", nameEn: "Comet", category: "sky", seasons: ALL, view: "flat", px: [140, 60], variants: 2, grid: 64, brief: "혜성 — 밝은 핵과 뒤로 길게 퍼지는 꼬리(왼쪽 아래로). 변형 2개는 꼬리 길이·각도가 다르다. 색은 청백~연보라, 꼬리는 끝으로 갈수록 성긴 점으로 흩어진다.", now: "none", phase: 1 },
  { id: "shooting-star", nameKo: "별똥별", nameEn: "Shooting star", category: "sky", seasons: ALL, view: "flat", px: [64, 24], variants: 2, grid: 16, brief: "별똥별 한 줄기 — 앞은 밝은 점, 뒤로 짧게 사라지는 꼬리. 아주 단순하게(점 하나에 꼬리 서너 칸).", now: "none", phase: 1 },
  { id: "cloud-low", nameKo: "구름(낮은)", nameEn: "Cloud, low", category: "sky", seasons: ALL, view: "flat", px: [190, 80], variants: 4, grid: 64, brief: "뭉게구름 — 아래는 평평하고 위로 덩이가 부풀어 오른다. 흰빛 #f6f8fb 3톤(윗면 밝고 밑면은 회청). 변형 4개는 덩이 수(2~5)와 너비가 확실히 다르게 — 같은 구름이 반복되면 하늘이 벽지가 된다.", now: "procedural", phase: 1 },
  { id: "cloud-mid", nameKo: "구름(중간)", nameEn: "Cloud, mid", category: "sky", seasons: ALL, view: "flat", px: [230, 60], variants: 3, grid: 64, brief: "중간 높이의 구름 — 낮은 구름보다 옆으로 길고 납작하다, 덩이 경계가 부드럽지만 여전히 픽셀 계단. 변형 3개.", now: "procedural", phase: 1 },
  { id: "cloud-high", nameKo: "새털구름", nameEn: "Cirrus", category: "sky", seasons: ALL, view: "flat", px: [260, 40], variants: 3, grid: 128, brief: "새털구름 — 붓으로 쓸어놓은 듯 가늘고 긴 획 서넛, 한쪽 끝이 갈고리처럼 굽는다. 아주 옅게(알파 낮게 그리지 말고 **밝은 회백 한 톤**으로).", now: "procedural", phase: 1 },
  { id: "cloud-storm", nameKo: "비구름", nameEn: "Rain cloud", category: "sky", seasons: ALL, view: "flat", px: [250, 110], variants: 2, grid: 64, brief: "비구름 — 밑면이 어둡고 평평하며(회청) 위로 두껍게 솟는다. 아래로 늘어진 자락 두엇. 변형 2개는 두께가 다르다.", now: "procedural", phase: 1 },
  { id: "footlog", nameKo: "쓰러진 나무", nameEn: "Fallen trunk", category: "ground", seasons: ALL, view: "stand", px: [140, 40], brief: "통째로 쓰러진 큰 나무 — `log`(토막)보다 훨씬 길고 이끼가 앉았다. 부러진 가지 그루터기 두어 개, 한쪽 끝에 나이테.", now: "none", phase: 1 }
];

// ── Phase 2: 생물 — **도감에서 파생**(2026-09-07, PLAN-008) ────────────────────────────────────────────
// 목록을 여기 또 적지 않는다. `world/codex.ts`가 정본이고 자리는 거기서 만들어진다 — 두 곳에 적으면
// "도감에는 있는데 그릴 자리가 없는 종"이 생긴다(옛 `world/species.ts`가 그 상태였다).
const VIEW_OF: Record<CodexEntry["view"], ArtView> = { shadow: "shadow", upright: "stand", topdown: "flat", side: "side" };
/** 도감 크기(cm) → 화면 px. 실제 비례를 그대로 쓰면 무당벌레 1cm와 고래 1600cm가 한 화면에 못 산다 —
 *  동물의 숲 축척(가장 큰 것 : 가장 작은 것 ≤ 12, PLAN-004 §1)에 맞춰 **계단으로** 접는다. */
const pxWidth = (cm: number): number =>
  cm <= 2 ? 16 : cm <= 5 ? 22 : cm <= 15 ? 30 : cm <= 30 ? 42 : cm <= 60 ? 56 : cm <= 120 ? 76 : cm <= 300 ? 104 : 150;
const pxOf = (e: CodexEntry): [number, number] => {
  const w = pxWidth(e.sizeCm[1]);
  // 실루엣·위에서 본 몸은 가로가 길고, 서 있는 것은 세로가 길다. 옆모습(깊은 바다)은 가장 납작하다.
  if (e.view === "shadow" || e.view === "topdown") return [w, Math.round(w * 0.62)];
  if (e.view === "side") return [w, Math.round(w * 0.55)];
  return [Math.round(w * 0.85), w];
};
const SEASON_OF_MONTH: readonly SeasonKey[] = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
const seasonsOf = (e: CodexEntry): SeasonKey[] => {
  const set = new Set<SeasonKey>(e.months.map((mo) => SEASON_OF_MONTH[mo - 1]));
  return (["spring", "summer", "autumn", "winter"] as const).filter((k) => set.has(k));
};
/** 지금 화면에 무엇으로 보이는가 — 아트가 오기 전의 대체물. 살아 있는 종만 무언가로 그려지고 있다. */
const NOW_OF: Record<string, ArtNow> = {
  "fish-palechub": "silhouette",
  "fish-crucian": "silhouette",
  "fish-carp": "silhouette",
  "animal-mallard": "emoji",
  "animal-hare": "emoji",
  "animal-chipmunk": "emoji",
  "bug-cabbagewhite": "emoji",
  "bug-blue": "emoji",
  "bug-ladybug": "emoji",
  "bug-honeybee": "emoji",
  "bug-firefly": "procedural"
};
const PHASE2: readonly ArtSlot[] = CODEX.map((e) => ({
  id: e.id,
  nameKo: e.nameKo,
  nameEn: e.nameEn,
  category: e.kind as ArtCategory,
  seasons: seasonsOf(e),
  view: VIEW_OF[e.view],
  px: pxOf(e),
  variants: e.variants,
  brief: e.brief,
  now: NOW_OF[e.id] ?? "none",
  phase: 2
}));

export const ART_SLOTS: readonly ArtSlot[] = [...PHASE1, ...PHASE2];
export const artSlot = (id: string): ArtSlot | undefined => ART_SLOTS.find((s) => s.id === id);

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
/** 도트 한 칸의 원본 px(1024 ÷ 격자) — 코덱스가 지킬 블록 크기. */
export const dotBlock = (px: readonly [number, number], override?: number): number => SOURCE_EDGE / dotGrid(px, override);

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
export const NOW_KO: Record<ArtNow, string> = { procedural: "코드 도형", emoji: "Noto 이모지", silhouette: "PD 실루엣", svg: "우리 SVG", none: "아무것도 안 그려짐" };
export const CATEGORY_KO: Record<ArtCategory, string> = { tree: "나무", plant: "풀·꽃", ground: "지형", water: "물", prop: "소품", sky: "하늘·천체", fish: "물고기", bug: "곤충", animal: "동물" };

/** 스타일 가이드 — 모든 자리에 공통. 모여봐요 동물의 숲(참고 페이지: 물고기·곤충 도감)을 **스타일 참고**로만 쓴다. */
export const ART_STYLE_GUIDE = `## 스타일 가이드(모든 그림 공통)
- **확정 스타일 = 픽셀아트**(2026-09-04 확정). 굵은 픽셀 블록으로 그린 도트 그림 — 모여봐요 동물의 숲의 **소재·귀여움**에
  16비트 도트의 **또렷함**을 더한 것. 앞으로 만드는 자리는 **전부 같은 어법**이어야 한다(한 장면에 도트와 물감이 섞이면 깨진다).
  **기준선 = public/ambient/art/ 에 있는 일곱 장 전부**(2026-09-07 실측) — 참나무 4장(색 8개·가로 연속 평균 9.4px)과
  소나무 3장(색 7~9개·9.5~9.9px)이 모두 이 규격으로 다시 만들어져 있다. 새 그림은 이들과 나란히 놓아도 한 세트로 보여야 한다.
  (옛 문구 "참나무는 기준이 아니다 · 재작업 대상"은 **철회한다** — 재작업본이 이미 들어왔는데 안내가 낡아 있었다.)
  소재·귀여움의 참고는 모여봐요 동물의 숲 도감 — https://animalcrossing.soopoolleaf.com/ko/acnh/Fish/ · https://animalcrossing.soopoolleaf.com/ko/acnh/Bugs/ .
  닌텐도 원본을 복제·트레이스하지 말고, 같은 소재를 **새로 그린 원작**으로.
- 픽셀 규격(**가장 중요 — 2026-09-07 개정**): 1024 캔버스를 **논리 격자**로 보고 그린다. 격자 크기는 자리마다 다르고 **표의 '격자' 칸**에
  적혀 있다(작은 자리는 굵게 16~32칸, 큰 자리는 64~128칸). 도트 한 칸 = 표의 '블록' px 정사각, 격자에 딱 맞춰 정렬.
  **블록 경계를 넘는 색 변화 금지**(한 블록 안은 완전히 같은 한 색). 안티에일리어싱·흐린 가장자리·에어브러시·그림자 번짐 금지 —
  선명한 계단 픽셀만. 1픽셀짜리 잔점·노이즈·디더링 남발 금지.
  이유: 우리는 저장할 때 이 그림을 **정수배로 줄이고**(1024 → 512·256·128, nearest) 화면에도 보간 없이 얹는다. 격자가 맞으면 줄여도
  도트가 그대로 남고, 안 맞으면 화면에서 도트가 사라져 옆의 그림들과 어법이 갈린다(실측: 격자 없는 축소는 색 76 → 3,723,
  도트 2.75px → 1.10px, 95%가 1px).
- 색: 물체당 **6~10색 팔레트**. 면마다 밝은 톤·중간 톤·어두운 톤 3단, 위 왼쪽에서 오는 빛. 외곽선은 **그 부분 색보다 훨씬 어두운 같은 계열
  색**(순수 검정 금지 — 나무면 진한 밤색). 그라데이션·질감·붓 터치 없음.
- **단순하게.** 이 그림은 화면에서 12~170px로 놓인다 — **128px로 줄여도 형태가 읽혀야 한다.** 잎·깃털·털·비늘 하나하나를 그리지 않는다.
  물체 = 큰 덩어리 2~3개(예: 나무 = 뭉게뭉게한 잎 덩이 + 굵은 줄기·뿌리목). 실루엣이 먼저 읽히게, 비율은 통통하게.
- 색(오행 규칙): 채도 낮은 부드러운 색. **선명한 빨강·주황·노랑 금지** — 가을은 갈색·황토·와인(갈색이 주), 꽃의 노랑은 크림 노랑,
  무당벌레는 벽돌빨강. 초록은 연둣빛(봄)·짙은 초록(여름). 물빛은 #9cc4e0 계열. 흰색은 순백 대신 #f6f8fb.
  **눈밭·모래처럼 밝은 바탕에 놓이는 것(겨울 나무·관목의 줄기)은 붉은 갈색이 아니라 채도 낮은 회갈색**(붉은 줄기가 눈밭에서 제일 튀었다 — 실측 후 탈색).
- 배경: **완전 투명(알파 0)**. 바닥·그림자·풍경·글자·워터마크·테두리 없음. 한 장에 **한 물체만**, 캔버스 가운데, 긴 변이 캔버스의 85%를 채운다.
- 형식: PNG 투명 배경, **정사각 1024×1024**(생성기의 최소 — 더 작게 뽑아도 요금이 안 싸고, 격자만 맞으면 줄일 때 손실이 없다).
  **품질은 낮음/중간**(디테일이 필요 없다 — 우리가 128·256·512로 정수배 축소해 저장한다, scripts/ambient-art-normalize.mjs).
  파일 이름은 표의 id 그대로(<id>.png, 변형은 <id>-1.png, <id>-2.png…).
- 검수 기준(우리가 기계로 잰다): 총 색 수 ≤ 48 · 가로 연속 길이 최빈값이 표의 **블록 px와 같을 것** · 알파 가장자리에 반투명 계조 없음.
  소나무 3장(tree-pine-*)이 이 기준의 회귀 기준선이다 — 실측 색 7~9개 · 가로 연속 최빈 16px · 반투명 0.
- 카메라(자리마다 표기): stand = 동물의 숲 카메라(높은 앵글 3/4 정면) · flat = 정확히 위에서 · shadow = 위에서 본 단색 실루엣.
- 일관성(**2026-09-07 개정**): 같은 종의 계절 변형은 **같은 줄기·같은 가지 뼈대·같은 실루엣 윤곽**을 쓴다. 다만 —
  · **낙엽수·관목(잎이 지는 것)**: 잎 덩이의 **크기와 빽빽함이 계절마다 다르다.** 봄 = 새잎이라 덩이가 작고 성기다(여름의 약 0.85배,
    사이로 가지가 조금 비친다) · **여름 = 한 해 중 가장 크고 빽빽하다(1.0 = 기준)** · 가을 = 잎이 지기 시작해 여름보다 조금 작고
    성기다(0.95배) · 겨울 = 잎이 없다(나목). **봄이 여름보다 커 보이면 안 된다** — 색만 바꾼 네 장은 계절이 지나가는 것으로 안 읽힌다.
  · **침엽수·상록(잎이 지지 않는 것)**: 네 계절 **크기·빽빽함이 같다.** 색과 눈만 바뀐다.
- 변형(-1, -2, -3)은 같은 크기·같은 스타일에 형태만 조금 다르다.`;

/** 파일럿 배치에서 실제로 받을 파일들(자리의 변형 중 앞의 `pilot`장만). */
export const pilotFiles = (s: ArtSlot): string[] => (s.pilot ? slotFiles(s).slice(0, s.pilot) : []);
/** 파일럿 자리들(ENTITY_ART_PLAN §4 — 12장) */
export const pilotSlots = (): ArtSlot[] => ART_SLOTS.filter((s) => s.pilot);

export function slotPrompt(s: ArtSlot): string {
  const files = slotFiles(s).join(", ");
  return [
    `# ${s.nameKo} (${s.nameEn}) — 파일: ${files}`,
    `- 계절: ${s.seasons.map((k) => SEASON_KO[k]).join("·")} · 화면 크기 약 ${s.px[0]}×${s.px[1]}px(작게 놓이므로 큰 덩어리 위주, 잔 디테일 금지)`,
    `- 카메라: ${VIEW_KO[s.view]}`,
    `- 그릴 것: ${s.brief}`,
    s.acnhRef ? `- 동물의 숲 참고 항목: ${s.acnhRef}(스타일 참고만)` : "",
    s.variants && s.variants > 1 ? `- 변형 ${s.variants}개를 각각 별도 PNG로(${files}).` : "",
    s.pilot ? `- **파일럿 배치**: 이번에는 앞의 ${s.pilot}장만 만든다(${pilotFiles(s).join(", ")}).` : "",
    `- 도트 격자: **${dotGrid(s.px, s.grid)}칸** — 도트 한 칸 = ${dotBlock(s.px, s.grid)}×${dotBlock(s.px, s.grid)}px 블록(1024 안에서). 블록 경계를 넘는 색 변화 금지.`,
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

const promptRow = (s: ArtSlot, pilot: boolean, only?: ReadonlySet<string>) =>
  `| ${s.id} | ${wantFiles(s, pilot, only).join(", ")} | ${s.nameKo} | ${s.seasons.map((k) => SEASON_KO[k]).join("·")} | ${s.view} | ${s.px[0]}×${s.px[1]} | ${dotGrid(s.px, s.grid)}칸 | ${dotBlock(s.px, s.grid)}px | ${s.brief}${s.acnhRef ? ` (동숲 참고: ${s.acnhRef})` : ""} |`;

/** 배치 프롬프트 — 아무 자리 묶음이나(보드의 필터 결과·파일럿·단계 전체) 코덱스에 통째로 넘길 한 장으로 만든다. */
export function batchPrompt(
  slots: readonly ArtSlot[],
  title: string,
  opts: { pilot?: boolean; note?: string; files?: readonly string[] } = {}
): string {
  const pilot = !!opts.pilot;
  // `files`가 오면 **그 파일들만** 표에 싣는다 — 이미 배달된 것을 다시 부탁하지 않기 위해서다(보드의 '남은 파일만').
  // 자리 단위가 아니라 **파일 단위**로 걸러야 한다: 변형이 둘인 자리는 한 장만 와 있을 수 있다(소나무 -1은 왔고 -2는 아직).
  const only = opts.files ? new Set(opts.files) : undefined;
  const rows = slots.filter((s) => wantFiles(s, pilot, only).length > 0);
  const count = rows.reduce((n, s) => n + wantFiles(s, pilot, only).length, 0);
  return `# VIC 계절 배경 아트 — 생성 의뢰(${title})

빅토리 일정표(스트리머 방송 일정 편집실)의 배경은 달력의 달을 따라 봄·여름·가을·겨울로 바뀌는 살아 있는 장면이다.
자리의 대부분은 아직 코드로 그린 기본 도형(원·선)이라 풀은 껌딱지, 흙더미는 정체불명으로 보인다.
아래 표의 **파일 이름마다 그림 한 장씩**을 만들어 달라 — 스타일은 **이미 합격한 소나무 3장**(public/ambient/art/tree-pine-*.png)과 같은 픽셀아트.
만든 파일은 public/ambient/art/ 에 표의 이름 그대로 넣기만 하면 장면이 자동으로 그 그림을 쓴다(편집실 /studio/ambient-art 보드에서 자리별 상태를 확인한다).
${opts.note ? `\n${opts.note}\n` : ""}
${ART_STYLE_GUIDE}

## 자리 표(파일 ${count}장 · 자리 ${rows.length}개)
| 자리 id | 파일 이름 | 이름 | 계절 | 카메라 | 화면 크기 | 격자 | 블록 | 그릴 것 |
|---|---|---|---|---|---|---|---|---|
${rows.map((s) => promptRow(s, pilot, only)).join("\n")}

## 납품
- 파일 하나에 물체 하나. 표의 이름을 그대로 파일 이름으로. **1024×1024 정사각 투명 PNG**, 품질 낮음/중간.
- **표의 격자·블록을 지킬 것**(예: 격자 64칸이면 도트 한 칸이 16×16px 블록). 이것이 이번 배치의 합격/불합격을 가르는 첫 기준이다.
- **픽셀아트 한 어법으로**: 소나무 3장(public/ambient/art/tree-pine-*.png)과 나란히 놓아도 한 세트로 보여야 한다.
- **단순하게**: 128px로 줄여도 읽히는 덩어리 2~3개. 잎·털·비늘 낱개, 붓 터치, 안티에일리어싱 금지.
- 같은 종의 계절 변형은 줄기·가지 뼈대를 유지하되, **낙엽수·관목은 잎 덩이 크기가 계절마다 다르다**(봄 .85 · 여름 1.0 · 가을 .95 · 겨울 나목).
  침엽수·상록은 네 계절 크기가 같다. 변형(-1, -2)은 색만 바꾼 복제 금지 — 실루엣 면적비 1.4배 이상.
- 색은 오행 규칙(선명한 빨강·주황·노랑 금지)을 어기지 않는다. 밝은 바탕(눈·모래)에 서는 줄기는 회갈색.`;
}

/** 마스터 프롬프트 — 코덱스에 통째로 붙여 넣는다(스타일 + 규칙 + 전체 표). phase로 좁힐 수 있다. */
export function codexMasterPrompt(phase?: 1 | 2): string {
  return batchPrompt(
    ART_SLOTS.filter((s) => !phase || s.phase === phase),
    phase === 1 ? "1차: 나무·초목·지형·물" : phase === 2 ? "2차: 생물" : "전체"
  );
}

/** 파일럿 프롬프트 — 12장(ENTITY_ART_PLAN §4). 소나무 3장을 먼저 보고 화풍만 승인한 뒤 나머지로 간다(§10 결정 5). */
export function pilotPrompt(): string {
  return batchPrompt(pilotSlots(), "파일럿 배치 — 12장", {
    pilot: true,
    note: `**이 배치는 화풍 검증용이다.** 먼저 소나무 3장(tree-pine-1, tree-pine-autumn, tree-pine-winter)을 보내 주면 화풍만 판정하고,
통과한 뒤에 나머지를 이어서 받는다. 소나무가 1순위인 이유: 지금 화면에서 청키 픽셀 참나무 바로 옆에 매끈한 벡터 소나무가 서 있어
**두 화풍이 만나는 유일한 지점**이다.`
  });
}
