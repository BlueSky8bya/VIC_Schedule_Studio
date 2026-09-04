// 앰비언트 아트 매니페스트(2026-09-04) — 계절 배경에 놓이는 **모든 그림 자리(slot)**의 단일 목록. 소유자: "나무·초목을 기본 도형
// 몇 개 붙여 만들면 어떻게 하냐(겨울 나무 = 말미잘, 봄 초목 = 껌딱지, 가을 = 정체불명 흙더미, 여름 연잎 = 입체감 없이 겹침) —
// 모여봐요 동물의 숲처럼 식물·동물을 이어서 디자인해 한 라우트에서 한꺼번에 관리".
//
// 규칙
//  · 자리 하나 = 파일 하나: `public/ambient/art/<id>.png`(변형은 `<id>-1.png … <id>-n.png`). 파일이 있으면 장면이 그 그림을 쓰고,
//    없으면 코드 도형(procedural)·Noto 이모지·실루엣 등 지금의 대체물을 그대로 쓴다(`art/load.ts`). 파일만 떨어뜨리면 바뀐다.
//  · 카메라: **땅에 납작한 것은 위에서(flat), 서 있는 것은 동물의 숲 카메라(stand — 높은 앵글 3/4 정면, 발밑 그림자는 엔진이
//    그린다), 물속·하늘 그림자는 실루엣(shadow)**. ADR-0017 ⑮.
//  · 생성 프롬프트는 이 목록에서 만든다(`codexMasterPrompt`·`slotPrompt`) — 표와 프롬프트가 어긋나지 않게 한 곳에서.
//  · 서버(라우트)와 클라이언트(장면) 둘 다 import — DOM 금지.

import type { SeasonKey } from "@/components/shared/ambient/registry";
import { SPECIES } from "@/components/shared/ambient/world/species";

export type ArtCategory = "tree" | "plant" | "ground" | "water" | "prop" | "fish" | "bug" | "animal";
export type ArtView = "stand" | "flat" | "shadow";
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
};

const ALL: readonly SeasonKey[] = ["spring", "summer", "autumn", "winter"];

// ── Phase 1: 나무·초목·지형·물 ──────────────────────────────────────────────────────────────────────────
const PHASE1: readonly ArtSlot[] = [
  // 나무(데뷔 나무·도토리에서 난 나무) — 계절마다 한 장, 크기는 엔진이 키에 맞춰 조절한다.
  { id: "tree-oak-spring", nameKo: "참나무(봄)", nameEn: "Oak, spring", category: "tree", seasons: ["spring"], view: "stand", px: [120, 150], brief: "동물의 숲 나무처럼 아주 단순하게: 연둣빛 **매끈한 공 모양 잎 덩이 3개**(위에 큰 것 하나, 아래 좌우에 작은 것 둘이 겹침)를 짧고 굵은 줄기가 받친다. 잎 낱개·잔가지·질감 없음. 덩이마다 위 왼쪽에 밝은 면, 오른쪽 아래에 그늘 면 한 번씩.", acnhRef: "활엽수(봄 새잎)", now: "procedural", phase: 1 },
  { id: "tree-oak-summer", nameKo: "참나무(여름)", nameEn: "Oak, summer", category: "tree", seasons: ["summer"], view: "stand", px: [120, 150], brief: "봄과 **같은 실루엣·같은 줄기**, 잎 덩이 3개만 짙은 초록으로(그늘 면은 청록). 잎 낱개·질감 없음.", acnhRef: "활엽수(여름)", now: "procedural", phase: 1 },
  { id: "tree-oak-autumn", nameKo: "참나무(가을)", nameEn: "Oak, autumn", category: "tree", seasons: ["autumn"], view: "stand", px: [120, 150], brief: "봄과 **같은 실루엣·같은 줄기**, 잎 덩이 3개가 갈색·황토·와인(갈색이 주, 붉은 기는 조금만 — 선명한 빨강·주황·노랑 금지). 잎 낱개·질감 없음. 발치의 떨어진 잎은 그리지 않는다(엔진이 흩뿌린다).", acnhRef: "활엽수(가을 단풍)", now: "procedural", phase: 1 },
  { id: "tree-oak-winter", nameKo: "참나무(겨울)", nameEn: "Oak, winter", category: "tree", seasons: ["winter"], view: "stand", px: [120, 150], brief: "봄과 **같은 줄기**에서 굵은 가지 4~5개가 둥글게 갈라져 올라간다(각 가지는 한두 번만 갈라짐 — 잔가지를 촘촘히 그리지 않는다, 128px에서 실루엣이 읽히게). 가지 위쪽에 눈이 두툼하게 한 겹.", acnhRef: "활엽수(겨울 나목)", now: "procedural", phase: 1 },
  { id: "sapling-green", nameKo: "어린 나무(잎)", nameEn: "Sapling, leafy", category: "tree", seasons: ["spring", "summer"], view: "stand", px: [40, 48], brief: "무릎 높이의 어린 참나무 — 가는 줄기 하나에 둥근 잎 3~4장(크게, 낱잎 그대로 단순하게). 밝은 초록.", acnhRef: "묘목", now: "emoji", phase: 1 },
  { id: "sapling-autumn", nameKo: "어린 나무(가을)", nameEn: "Sapling, autumn", category: "tree", seasons: ["autumn"], view: "stand", px: [40, 48], brief: "어린 참나무(같은 실루엣), 둥근 잎 2~3장이 갈색·와인.", acnhRef: "묘목", now: "emoji", phase: 1 },
  { id: "sapling-bare", nameKo: "어린 나무(겨울)", nameEn: "Sapling, bare", category: "tree", seasons: ["winter"], view: "stand", px: [40, 48], brief: "잎 없는 어린 참나무 — 가는 줄기와 잔가지 둘, 눈이 조금 얹힌다.", acnhRef: "묘목", now: "emoji", phase: 1 },
  { id: "sprout", nameKo: "새싹", nameEn: "Sprout", category: "plant", seasons: ["spring", "summer", "autumn"], view: "stand", px: [24, 28], brief: "흙을 막 뚫고 나온 떡잎 두 장. 통통하고 둥근 잎, 짧은 줄기, 발치에 흙 부스러기 조금.", acnhRef: "새싹", now: "emoji", phase: 1 },
  { id: "shrub-spring", nameKo: "관목(봄)", nameEn: "Shrub, spring", category: "tree", seasons: ["spring"], view: "stand", px: [70, 56], brief: "허리 높이의 둥근 관목, 연둣빛 새잎, 작은 흰 꽃 몇 송이.", acnhRef: "울타리 관목(진달래류)", now: "none", phase: 1 },
  { id: "shrub-summer", nameKo: "관목(여름)", nameEn: "Shrub, summer", category: "tree", seasons: ["summer"], view: "stand", px: [70, 56], brief: "짙은 초록 둥근 관목, 잎이 빽빽하다.", acnhRef: "울타리 관목(수국은 파랑 대신 연보라)", now: "none", phase: 1 },
  { id: "shrub-autumn", nameKo: "관목(가을)", nameEn: "Shrub, autumn", category: "tree", seasons: ["autumn"], view: "stand", px: [70, 56], brief: "갈색·와인으로 물든 둥근 관목, 잎이 성기다.", acnhRef: "울타리 관목(가을)", now: "none", phase: 1 },
  { id: "shrub-winter", nameKo: "관목(겨울)", nameEn: "Shrub, winter", category: "tree", seasons: ["winter"], view: "stand", px: [70, 56], brief: "잔가지만 남은 둥근 관목 위에 눈이 소복이 덮였다.", acnhRef: "울타리 관목(겨울)", now: "none", phase: 1 },
  // 풀·꽃
  { id: "grass-tuft", nameKo: "풀포기", nameEn: "Grass tuft", category: "plant", seasons: ["spring", "summer"], view: "stand", px: [22, 18], variants: 3, brief: "잔디 위에 솟은 풀포기 — 잎 5~7가닥이 부채꼴로 벌어지고 끝이 살짝 휜다. 밝은 초록, 뿌리 쪽은 어둡다. 변형 3개는 가닥 수와 휜 방향이 다르다.", acnhRef: "잡초(풀)", now: "procedural", phase: 1 },
  { id: "grass-dry", nameKo: "마른 풀", nameEn: "Dry grass", category: "plant", seasons: ["autumn", "winter"], view: "stand", px: [22, 18], variants: 3, brief: "시든 풀포기 — 황토·밀짚색 가닥이 옆으로 누웠다. 변형 3개.", acnhRef: "잡초(가을)", now: "procedural", phase: 1 },
  { id: "clover", nameKo: "클로버", nameEn: "Clover", category: "plant", seasons: ["spring", "summer"], view: "flat", px: [14, 12], variants: 2, brief: "위에서 본 세잎클로버 두세 포기가 모인 작은 무리. 둥근 하트 잎, 잎 가운데 옅은 흰 무늬.", acnhRef: "클로버(잡초)", now: "procedural", phase: 1 },
  { id: "daisy", nameKo: "데이지", nameEn: "Daisy", category: "plant", seasons: ["spring"], view: "stand", px: [16, 18], variants: 2, brief: "흰 꽃잎 8~10장에 옅은 노란 가운데(채도 낮은 크림 노랑)를 가진 데이지 한 송이, 짧은 줄기와 잎 두 장. 벌·나비가 앉는 자리라 꽃 얼굴이 위·앞을 본다.", acnhRef: "흰 꽃(데이지류)", now: "procedural", phase: 1 },
  { id: "dandelion-flower", nameKo: "민들레(꽃)", nameEn: "Dandelion, flower", category: "plant", seasons: ["spring"], view: "stand", px: [16, 22], brief: "채도 낮은 크림 노랑 민들레 꽃 한 송이(선명한 노랑 금지), 톱니 잎 셋.", acnhRef: "민들레", now: "none", phase: 1 },
  { id: "dandelion-puff", nameKo: "민들레(홀씨)", nameEn: "Dandelion, seed head", category: "plant", seasons: ["spring"], view: "stand", px: [20, 26], brief: "홀씨가 가득 찬 둥근 흰 솜 머리와 가는 줄기. 클릭하면 홀씨가 날아가므로 머리는 또렷한 흰 점들이 보이게.", acnhRef: "민들레 홀씨", now: "procedural", phase: 1 },
  { id: "mushroom", nameKo: "버섯", nameEn: "Mushroom", category: "plant", seasons: ["autumn"], view: "stand", px: [20, 22], variants: 2, brief: "갈색 갓에 크림색 점이 몇 개 찍힌 통통한 버섯(빨간 독버섯 금지 — 밤색·황토). 변형 2개: 하나는 작은 두 송이가 붙었다.", acnhRef: "버섯(가을)", now: "procedural", phase: 1 },
  { id: "reed", nameKo: "갈대·억새", nameEn: "Reed / silver grass", category: "plant", seasons: ["summer", "autumn", "winter"], view: "stand", px: [30, 70], variants: 4, brief: "물가에 선 갈대 서너 대 — 긴 잎과 갈색 이삭, 살짝 휘었다. 변형 2개.", acnhRef: "물가 풀", now: "none", phase: 1 },
  // 물
  { id: "lilypad", nameKo: "연잎", nameEn: "Lily pad", category: "water", seasons: ["summer"], view: "flat", px: [56, 56], variants: 3, brief: "위에서 본 연잎 — 둥근 잎에 V자 갈라짐 하나, 잎맥이 가운데서 퍼지고 가장자리가 살짝 말려 올라 **두께가 보인다**(가장자리에 옅은 밝은 테 + 아래쪽 어두운 띠). 변형 3개는 갈라진 방향·크기가 다르다.", acnhRef: "연못 연잎", now: "procedural", phase: 1 },
  { id: "lotus", nameKo: "연꽃", nameEn: "Lotus", category: "water", seasons: ["summer"], view: "stand", px: [26, 24], brief: "연잎 위에 핀 연분홍 연꽃 한 송이(채도 낮게).", acnhRef: "연꽃", now: "none", phase: 1 },
  // 지형·소품
  { id: "soil-mound", nameKo: "흙더미(저장소)", nameEn: "Soil mound", category: "ground", seasons: ALL, view: "flat", px: [28, 16], brief: "위에서 본 작은 흙더미 — 다람쥐가 도토리를 묻고 두드린 자리. 둥근 흙 덩이, 가운데 조금 어둡고 테는 흩어진 흙 알갱이.", acnhRef: "땅에 묻힌 자리(별 모양 갈라짐 말고 자연스러운 흙)", now: "procedural", phase: 1 },
  { id: "molehill", nameKo: "두더지 흙더미", nameEn: "Molehill", category: "ground", seasons: ["spring"], view: "stand", px: [34, 22], brief: "봉긋 솟은 새 흙더미(두더지가 밀어 올린 것). 따뜻한 갈색, 위쪽이 밝고 아래가 어둡다.", acnhRef: "흙더미", now: "procedural", phase: 1 },
  { id: "grass-patch", nameKo: "풀 얼룩", nameEn: "Grass patch", category: "ground", seasons: ["summer"], view: "flat", px: [40, 28], brief: "위에서 본, 주변보다 조금 진한 초록 풀 얼룩(두더지 흙더미가 여름에 풀로 덮인 자리). 가장자리가 부드럽게 번진다.", now: "procedural", phase: 1 },
  { id: "twig", nameKo: "잔가지", nameEn: "Twig", category: "ground", seasons: ["autumn", "winter"], view: "flat", px: [36, 14], variants: 2, brief: "땅에 떨어진 마른 잔가지 — 한 번 갈라지고, 껍질 결이 보인다. 변형 2개.", acnhRef: "나뭇가지(재료)", now: "procedural", phase: 1 },
  { id: "pebble", nameKo: "조약돌", nameEn: "Pebble", category: "ground", seasons: ALL, view: "flat", px: [12, 9], variants: 3, brief: "위에서 본 둥근 조약돌 — 회색·밝은 회갈색, 위쪽에 작은 하이라이트. 변형 3개.", now: "procedural", phase: 1 },
  { id: "rock", nameKo: "바위", nameEn: "Rock", category: "ground", seasons: ALL, view: "stand", px: [40, 30], variants: 4, brief: "무릎 높이의 둥글둥글한 바위, 이끼가 조금 앉았다. 변형 2개.", acnhRef: "바위", now: "none", phase: 1 },
  { id: "stump", nameKo: "그루터기", nameEn: "Stump", category: "ground", seasons: ALL, view: "stand", px: [36, 28], brief: "잘린 나무 그루터기 — 위에 나이테가 보이고 옆면은 껍질.", acnhRef: "그루터기", now: "none", phase: 1 },
  { id: "log", nameKo: "통나무", nameEn: "Log", category: "ground", seasons: ["summer", "autumn"], view: "stand", px: [70, 26], brief: "물가에 누운 통나무 한 토막, 한쪽 끝에 나이테.", acnhRef: "통나무", now: "none", phase: 1 },
  { id: "snowman-1", nameKo: "눈사람(공 하나)", nameEn: "Snowman, one ball", category: "prop", seasons: ["winter"], view: "stand", px: [44, 30], brief: "막 굴린 큰 눈덩이 하나(눈사람 1단계). 표면에 굴린 자국이 살짝.", acnhRef: "눈덩이", now: "procedural", phase: 1 },
  { id: "snowman-2", nameKo: "눈사람(공 둘)", nameEn: "Snowman, two balls", category: "prop", seasons: ["winter"], view: "stand", px: [44, 52], brief: "눈덩이 두 개를 쌓은 눈사람(2단계, 얼굴 없음).", acnhRef: "눈사람", now: "procedural", phase: 1 },
  { id: "snowman-3", nameKo: "눈사람(완성)", nameEn: "Snowman, complete", category: "prop", seasons: ["winter"], view: "stand", px: [44, 72], brief: "완성된 눈사람 — 공 셋, 나뭇가지 팔, 조약돌 눈과 단추(무채색), 작은 목도리는 채도 낮은 회청색.", acnhRef: "눈사람", now: "procedural", phase: 1 },
  { id: "snow-pile", nameKo: "눈 무더기", nameEn: "Snow pile", category: "ground", seasons: ["winter"], view: "stand", px: [40, 24], variants: 2, brief: "바람에 쌓인 부드러운 눈 무더기, 위쪽은 희고 그늘은 옅은 청회색. 변형 2개.", now: "none", phase: 1 },
  { id: "acorn", nameKo: "도토리", nameEn: "Acorn", category: "prop", seasons: ["autumn"], view: "flat", px: [20, 26], brief: "위에서 본 도토리 하나 — 갈색 열매와 까슬한 깍정이(모자), 꼭지 짧게.", acnhRef: "도토리", now: "svg", phase: 1 },
  { id: "swim-ring", nameKo: "튜브", nameEn: "Swim ring", category: "prop", seasons: ["summer"], view: "flat", px: [92, 92], brief: "위에서 본 도넛 튜브 — 채도 낮은 민트·크림 줄무늬(빨강·주황 금지), 옆면 두께가 보인다.", now: "svg", phase: 1 }
];

// ── Phase 2: 생물(종 레지스트리에서 파생 — 목록이 둘로 갈라지지 않게) ──────────────────────────────────────
const VIEW_OF: Record<(typeof SPECIES)[number]["view"], ArtView> = { shadow: "shadow", upright: "stand", topdown: "flat" };
const NOW_OF: Record<(typeof SPECIES)[number]["asset"], ArtNow> = { noto: "emoji", silhouette: "silhouette", prop: "svg" };
const CAT_OF = (id: string): ArtCategory =>
  /^fish|shark|heron|eagle|geese/.test(id) ? "fish" : /butterfly|ladybug|bee|ant|dragonfly|waterstrider|snail|earthworm/.test(id) ? "bug" : "animal";
const BRIEF_OF: Record<string, string> = {
  "fish-slim": "위에서 본 잉어의 실루엣(단색 진남색) — 물속 그림자로만 쓴다. 몸통·꼬리 윤곽만, 지느러미는 얇게.",
  "fish-fantail": "위에서 본 붕어(부채꼬리) 실루엣, 단색.",
  duck: "청둥오리(수컷: 초록 머리·회갈색 몸, 채도 낮게) — 3/4 정면, 물에 앉은 자세(발은 보이지 않는다, 수면선은 엔진이 자른다).",
  rabbit: "겨울 흰 토끼 — 3/4 정면, 귀를 세우고 앉은 자세.",
  chipmunk: "다람쥐 — 3/4 정면, 도토리를 두 손에 쥔 자세, 꼬리를 세웠다.",
  butterfly: "위에서 본 나비, 날개를 편 상태 — 흰 배추흰나비와 연보라 부전나비 두 종(채도 낮게).",
  ladybug: "위에서 본 무당벌레 — 검은 점 일곱, 채도 낮은 벽돌빨강(선명한 빨강 금지).",
  bee: "꿀벌 — 3/4 정면, 통통한 몸과 반투명 날개, 밀짚 노랑과 갈색 줄.",
  sparrow: "참새 — 3/4 정면, 통통하게 부푼 겨울 참새.",
  cat: "고양이(회색 줄무늬) — 3/4 정면, 걷는 자세.",
  magpie: "까치 — 3/4 정면, 검정·흰색·남보라 광택.",
  ant: "위에서 본 개미 한 마리(행렬은 엔진이 만든다), 진갈색.",
  treefrog: "청개구리 — 3/4 정면, 앉은 자세, 연초록.",
  snail: "달팽이 — 3/4 정면, 갈색 나선 껍데기.",
  earthworm: "위에서 본 지렁이, 살구빛 분홍(채도 낮게), 마디가 보인다.",
  turtle: "위에서 본 붉은귀거북 — 등딱지 무늬, 머리·발이 조금 나왔다.",
  waterstrider: "위에서 본 소금쟁이 — 긴 다리 넷이 수면에 닿는다(파문은 엔진).",
  dragonfly: "위에서 본 잠자리 — 투명 날개 넷, 몸은 채도 낮은 청록.",
  ducklings: "새끼오리 한 마리(행렬은 엔진) — 3/4 정면, 크림 노랑 솜털(채도 낮게).",
  heron: "위에서 본 왜가리의 실루엣(비행, 목을 접고 날개를 편다), 단색 — 물 위 그림자용.",
  crow: "까마귀 — 3/4 정면, 검정에 남색 광택.",
  "squirrel-gray": "청설모 — 3/4 정면, 회색 몸에 귀 끝 털.",
  hedgehog: "고슴도치 — 3/4 정면, 가시는 갈색·크림 두 톤.",
  fieldmouse: "들쥐 — 3/4 정면, 작고 둥근 귀, 갈색.",
  "geese-v": "위에서 본 기러기 한 마리의 비행 실루엣(편대는 엔진), 단색.",
  fox: "여우 — 3/4 정면, 채도 낮은 적갈색(주황 금지), 흰 가슴, 굵은 꼬리.",
  pheasant: "꿩(장끼) — 3/4 정면, 초록·갈색·흰 목테(채도 낮게), 긴 꼬리.",
  "eagle-shadow": "위에서 본 독수리 비행 실루엣, 단색 — 눈밭 위 그림자용.",
  shark: "위에서 본 상어 실루엣(등지느러미 포함), 단색 — 물속 그림자용."
};
const PHASE2: readonly ArtSlot[] = SPECIES.map((s) => ({
  id: s.id,
  nameKo: s.nameKo,
  nameEn: s.id,
  category: CAT_OF(s.id),
  seasons: s.seasons,
  view: VIEW_OF[s.view],
  px: s.view === "shadow" ? [64, 40] : s.view === "topdown" ? [24, 24] : [56, 56],
  brief: BRIEF_OF[s.id] ?? `${s.nameKo} — 동물의 숲 스타일.`,
  now: NOW_OF[s.asset],
  phase: 2
}));

export const ART_SLOTS: readonly ArtSlot[] = [...PHASE1, ...PHASE2];
export const artSlot = (id: string): ArtSlot | undefined => ART_SLOTS.find((s) => s.id === id);

/** 자리의 파일 이름들(변형 포함) — 라우트가 존재 여부를 검사하고, 로더가 무작위로 고른다. */
export function slotFiles(s: ArtSlot): string[] {
  return s.variants && s.variants > 1 ? Array.from({ length: s.variants }, (_, i) => `${s.id}-${i + 1}.png`) : [`${s.id}.png`];
}

export const ART_DIR = "/ambient/art"; // public/ambient/art

/** 자리의 저장 목표 변(px) — 화면 px 최대의 4배(DPR 2 × 확대 여유), 128~512. scripts/ambient-art-normalize.mjs와 같은 식. */
export const targetEdge = (px: readonly [number, number]) => Math.max(128, Math.min(512, Math.ceil((Math.max(px[0], px[1]) * 4) / 64) * 64));

/** 폴더에 실제로 있는 파일(서버가 읽어 보드에 넘긴다) */
export type ArtFileInfo = { file: string; bytes: number; w: number; h: number };
export type PresentArt = Record<string, ArtFileInfo[]>;

// ── 코덱스 프롬프트 ─────────────────────────────────────────────────────────────────────────────────────
export const SEASON_KO: Record<SeasonKey, string> = { spring: "봄", summer: "여름", autumn: "가을", winter: "겨울" };
export const VIEW_KO: Record<ArtView, string> = {
  stand: "서 있는 것 — 동물의 숲 카메라(높은 앵글 약 60°에서 내려다본 3/4 정면, 위·아래가 모두 보인다). 바닥 그림자는 그리지 않는다(엔진이 그린다).",
  flat: "땅·물 위에 납작 놓인 것 — 위에서 비스듬히(3/4 카메라) 내려다본 모습: 세로가 살짝 눌린 타원 느낌(엔진이 0.7배로 한 번 더 누른다). 앞 = 위. 바닥 그림자 없음.",
  shadow: "물속·하늘 그림자 — 정확히 위에서 본 단색 실루엣(진남색 #1c3a58 한 색, 안쪽 무늬 없음). 머리 = 왼쪽."
};
export const VIEW_SHORT: Record<ArtView, string> = { stand: "서 있음(3/4)", flat: "납작(3/4·눌림)", shadow: "실루엣" };
export const NOW_KO: Record<ArtNow, string> = { procedural: "코드 도형", emoji: "Noto 이모지", silhouette: "PD 실루엣", svg: "우리 SVG", none: "아직 없음" };
export const CATEGORY_KO: Record<ArtCategory, string> = { tree: "나무", plant: "풀·꽃", ground: "지형", water: "물", prop: "소품", fish: "물고기·그림자", bug: "곤충", animal: "동물" };

/** 스타일 가이드 — 모든 자리에 공통. 모여봐요 동물의 숲(참고 페이지: 물고기·곤충 도감)을 **스타일 참고**로만 쓴다. */
export const ART_STYLE_GUIDE = `## 스타일 가이드(모든 그림 공통)
- **확정 스타일 = 픽셀아트**(2026-09-04, 참나무 4장으로 확정). 굵은 픽셀 블록으로 그린 도트 그림 — 모여봐요 동물의 숲의 **소재·귀여움**에
  16비트 도트의 **또렷함**을 더한 것. 앞으로 만드는 자리는 **전부 같은 어법**이어야 한다(한 장면에 도트와 물감이 섞이면 깨진다).
  참고 이미지: public/ambient/art/tree-oak-*.png(이미 납품된 참나무 4장) — 새 그림은 이것들과 나란히 놓아도 한 세트로 보여야 한다.
  소재·귀여움의 참고는 모여봐요 동물의 숲 도감 — https://animalcrossing.soopoolleaf.com/ko/acnh/Fish/ · https://animalcrossing.soopoolleaf.com/ko/acnh/Bugs/ .
  닌텐도 원본을 복제·트레이스하지 말고, 같은 소재를 **새로 그린 원작**으로.
- 픽셀 규격: 논리 해상도 **64~96px 급**의 도트를 정수배로 키운 느낌(계단이 굵고 고르게 보인다). 안티에일리어싱·흐린 가장자리·에어브러시 금지.
  선명한 계단 픽셀만. 1픽셀짜리 잔점·노이즈·디더링 남발 금지.
- 색: 물체당 **6~10색 팔레트**. 면마다 밝은 톤·중간 톤·어두운 톤 3단, 위 왼쪽에서 오는 빛. 외곽선은 **그 부분 색보다 훨씬 어두운 같은 계열
  색**(순수 검정 금지 — 나무면 진한 밤색). 그라데이션·질감·붓 터치 없음.
- **단순하게.** 이 그림은 화면에서 12~170px로 놓인다 — **128px로 줄여도 형태가 읽혀야 한다.** 잎·깃털·털·비늘 하나하나를 그리지 않는다.
  물체 = 큰 덩어리 2~3개(예: 나무 = 뭉게뭉게한 잎 덩이 + 굵은 줄기·뿌리목). 실루엣이 먼저 읽히게, 비율은 통통하게.
- 색(오행 규칙): 채도 낮은 부드러운 색. **선명한 빨강·주황·노랑 금지** — 가을은 갈색·황토·와인(갈색이 주), 꽃의 노랑은 크림 노랑,
  무당벌레는 벽돌빨강. 초록은 연둣빛(봄)·짙은 초록(여름). 물빛은 #9cc4e0 계열. 흰색은 순백 대신 #f6f8fb.
  **눈밭·모래처럼 밝은 바탕에 놓이는 것(겨울 나무·관목의 줄기)은 붉은 갈색이 아니라 채도 낮은 회갈색**(붉은 줄기가 눈밭에서 제일 튀었다 — 실측 후 탈색).
- 배경: **완전 투명(알파 0)**. 바닥·그림자·풍경·글자·워터마크·테두리 없음. 한 장에 **한 물체만**, 캔버스 가운데, 긴 변이 캔버스의 85%를 채운다.
- 형식: PNG 투명 배경, **정사각**. 크기는 생성기의 최소(대개 1024×1024)로, **품질은 낮음/중간**(디테일이 필요 없고 우리가 128~512로 줄여
  저장한다 — scripts/ambient-art-normalize.mjs). 파일 이름은 표의 id 그대로(<id>.png, 변형은 <id>-1.png, <id>-2.png…).
- 카메라(자리마다 표기): stand = 동물의 숲 카메라(높은 앵글 3/4 정면) · flat = 정확히 위에서 · shadow = 위에서 본 단색 실루엣.
- 일관성: 같은 종의 계절 변형(예: 참나무 봄·여름·가을·겨울)은 **같은 실루엣·같은 줄기**에 잎만 바뀐다. 변형(-1, -2, -3)은 같은 크기·같은 스타일에 형태만 조금 다르다.`;

export function slotPrompt(s: ArtSlot): string {
  const files = slotFiles(s).join(", ");
  return [
    `# ${s.nameKo} (${s.nameEn}) — 파일: ${files}`,
    `- 계절: ${s.seasons.map((k) => SEASON_KO[k]).join("·")} · 화면 크기 약 ${s.px[0]}×${s.px[1]}px(작게 놓이므로 큰 덩어리 위주, 잔 디테일 금지)`,
    `- 카메라: ${VIEW_KO[s.view]}`,
    `- 그릴 것: ${s.brief}`,
    s.acnhRef ? `- 동물의 숲 참고 항목: ${s.acnhRef}(스타일 참고만)` : "",
    s.variants && s.variants > 1 ? `- 변형 ${s.variants}개를 각각 별도 PNG로(${files}).` : "",
    "",
    ART_STYLE_GUIDE
  ]
    .filter(Boolean)
    .join("\n");
}

/** 마스터 프롬프트 — 코덱스에 통째로 붙여 넣는다(스타일 + 규칙 + 전체 표). phase로 좁힐 수 있다. */
export function codexMasterPrompt(phase?: 1 | 2): string {
  const slots = ART_SLOTS.filter((s) => !phase || s.phase === phase);
  const rows = slots.map(
    (s) =>
      `| ${s.id} | ${s.nameKo} | ${s.seasons.map((k) => SEASON_KO[k]).join("·")} | ${s.view} | ${s.px[0]}×${s.px[1]} | ${s.variants && s.variants > 1 ? s.variants : 1} | ${s.brief}${s.acnhRef ? ` (동숲 참고: ${s.acnhRef})` : ""} |`
  );
  return `# VIC 계절 배경 아트 — 생성 의뢰(${phase === 1 ? "1차: 나무·초목·지형·물" : phase === 2 ? "2차: 생물" : "전체"})

빅토리 일정표(스트리머 방송 일정 편집실)의 배경은 달력의 달을 따라 봄·여름·가을·겨울로 바뀌는 살아 있는 장면이다.
나머지 자리는 아직 코드로 그린 기본 도형(원·선)이라 풀은 껌딱지, 흙더미는 정체불명으로 보인다.
아래 표의 자리마다 **그림 한 장씩**을 만들어 달라 — 스타일은 **이미 확정된 참나무 4장**(public/ambient/art/tree-oak-*.png)과 같은 픽셀아트.
만든 파일은 public/ambient/art/ 에 표의 id 이름으로 넣기만 하면 장면이 자동으로 그 그림을 쓴다(편집실 /studio/ambient-art 보드에서 자리별 상태를 확인한다).

${ART_STYLE_GUIDE}

## 자리 표(총 ${slots.length})
| id(파일 이름) | 이름 | 계절 | 카메라 | 화면 크기 | 변형 | 그릴 것 |
|---|---|---|---|---|---|---|
${rows.join("\n")}

## 납품
- 자리마다 PNG 투명 배경 정사각 한 장(변형은 <id>-1.png…). 한 장에 한 물체. 표의 id를 파일 이름으로. 크기는 생성기 최소, 품질 낮음/중간 — 저장은 우리가 줄인다.
- **픽셀아트 한 어법으로**: 이미 확정된 참나무 4장(public/ambient/art/tree-oak-*.png)과 나란히 놓아도 한 세트로 보여야 한다.
- **단순하게**: 128px로 줄여도 읽히는 덩어리 2~3개. 잎·털·비늘 낱개, 붓 터치, 안티에일리어싱 금지.
- 같은 종의 계절 변형은 같은 실루엣을 유지한다. 나무 4장은 확정 — 다음은 묘목·새싹·관목 4계절(같은 나무 계열)부터.
- 색은 오행 규칙(선명한 빨강·주황·노랑 금지)을 어기지 않는다. 밝은 바탕(눈·모래)에 서는 줄기는 회갈색.`;
}
