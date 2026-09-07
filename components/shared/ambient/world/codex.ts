// 도감(2026-09-07, PLAN-20260907-008) — **물고기 · 곤충 · 동물** 세 권. 이 파일이 정본이고, 스폰 감독·아트 매니페스트·
// 도감 화면이 전부 여기서 파생한다(목록이 둘로 갈라지면 "표에 있는데 안 나오는 종"이 생긴다 — 옛 `world/species.ts`가 그랬다).
//
// 왜 만드나(소유자 2026-09-07): "모여봐요 동물의 숲처럼 도감 수집하는 맛. 피라미는 강에 나오고 계절 안 타고 1년 내내 출몰하니까
// 진짜 도감작을 하게 하는 거지. 동물도 다람쥐 돌아다니는 거 클릭하면 도감 채우고 — 그런데 다람쥐도 우리가 직접 생성하고."
// 두 가지가 여기서 바뀐다:
//  ① **종이 조건을 갖는다.** 어느 바이옴 · 몇 월 · 어느 시간대 · (때로) 어느 날씨에만 나온다. 조건이 없으면 도감이 아니라 목록이다 —
//     "지금 여기 아니면 못 본다"가 수집의 동력이고, 그게 곧 **달력을 넘기고 바이옴을 걸어 다닐 이유**가 된다.
//  ② **동물도 우리가 그린다.** 옛 규칙 "동물은 Noto 이모지만"(ADR-0017 ⑧)은 소유자 결정으로 철회됐다(ADR-0019). 이모지는 광택·비율이
//     픽셀아트와 갈려 오리 한 마리가 늘 화면에서 튀었고, 무엇보다 **도감의 주인공을 남의 그림으로 채울 수는 없다.**
//
// 종은 **실재하는 한국의 생물**이다. 닌텐도의 종 목록·수치를 옮기지 않는다(그건 그 게임의 데이터다) — 참고하는 것은 "도감이라는 형식"뿐이고,
// 내용은 우리 열한 바이옴에 실제로 살 법한 것들로 채운다. 출현 달·시간대는 국내 도감·관찰 기록의 통념을 따랐다(정밀한 생태 자료가 아니라
// **놀이의 규칙**이므로, 어긋나면 재미 쪽으로 조정한다).

import type { BiomeKey } from "./biomes";
import type { Tier } from "./rarity";
import type { DayBand } from "./time";
import type { Weather } from "./weather";

export type CodexKind = "fish" | "bug" | "animal";
export const CODEX_KINDS: readonly CodexKind[] = ["fish", "bug", "animal"];
export const KIND_LABEL: Record<CodexKind, string> = { fish: "물고기", bug: "곤충", animal: "동물" };

/** 어디에 붙어 사는가 — 도감 표시 + 스폰 표면(물 위/물속/땅 위는 그리는 층이 다르다). */
export type Habitat = "water" | "surface" | "mud" | "shore" | "ground" | "air" | "tree" | "flower" | "rock" | "sky";
export const HABITAT_LABEL: Record<Habitat, string> = {
  water: "물속",
  surface: "수면",
  mud: "뻘",
  shore: "물가",
  ground: "땅 위",
  air: "공중",
  tree: "나무",
  flower: "꽃",
  rock: "바위",
  sky: "하늘 높이"
};

/** 그림 규격 — shadow = 물속 실루엣(위에서) · upright = 세워 그림(3/4, 좌우 뒤집기만) · topdown = 위에서 본 몸(진행 방향 회전) ·
 *  side = 옆모습(깊은 바다 전용 — 그 장면만 카메라가 다르다, CLAUDE.md 깊은 바다 예외). */
export type ViewKind = "shadow" | "upright" | "topdown" | "side";

export type CodexEntry = {
  id: string;
  kind: CodexKind;
  nameKo: string;
  nameEn: string;
  /** 나오는 바이옴(열한 화면 중). */
  biomes: readonly BiomeKey[];
  habitat: Habitat;
  /** 나오는 달 1~12. */
  months: readonly number[];
  /** 나오는 시간대. */
  bands: readonly DayBand[];
  /** 날씨 조건 — 없으면 무관. (비 온 뒤에만 나오는 것은 `afterRain`) */
  weather?: readonly Weather[];
  /** 직전 마디가 비였을 때만(달팽이·지렁이). */
  afterRain?: boolean;
  tier: Tier;
  /** 도감에 적는 크기(cm) — 최소·최대. */
  sizeCm: readonly [number, number];
  view: ViewKind;
  /** 아트 변형 수(기본 1). 무리로 여럿이 동시에 보이는 종만 올린다. */
  variants?: number;
  /** 생성 차수 — 1 = 바이옴 정체성(먼저), 2 = 살을 붙이는 것, 3 = 마지막. */
  wave: 1 | 2 | 3;
  /** 살아 움직이는 구현이 이미 있는가(도감 진행률은 구현된 종만 센다). */
  live?: boolean;
  /** 그릴 것 — 코덱스 프롬프트 본문. */
  brief: string;
  /** 처음 만났을 때 한 줄(도감 카드) — 정보 반, 애정 반. */
  blurb: string;
};

export const MONTHS_ALL: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const m = (a: number, b: number): number[] => (a <= b ? Array.from({ length: b - a + 1 }, (_, i) => a + i) : [...m(a, 12), ...m(1, b)]);
export const BANDS_ALL: readonly DayBand[] = ["dawn", "morning", "noon", "dusk", "evening", "night"];
/** 낮 — 아침·점심·노을. */
const DAY: readonly DayBand[] = ["morning", "noon", "dusk"];
/** 밤 — 저녁·밤·새벽. */
const NIGHT: readonly DayBand[] = ["evening", "night", "dawn"];
/** 해 뜰 녘·질 녘 — 포유류가 가장 잘 나오는 두 띠. */
const TWILIGHT: readonly DayBand[] = ["dawn", "dusk"];

// ── 물고기 40종 ────────────────────────────────────────────────────────────────────────────────────
// 민물(계곡·민물) → 갯벌·모래·암석해안 → 먼바다 → 깊은 바다. 물고기는 원칙적으로 **물속 실루엣**이다
// (CLAUDE.md: 3/4 카메라에서 물고기는 위에서 본 그림자) — 예외는 깊은 바다뿐이고 거긴 옆모습이다.
const FISH: readonly CodexEntry[] = [
  { id: "fish-palechub", kind: "fish", nameKo: "피라미", nameEn: "Pale chub", biomes: ["valley", "pond"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "common", sizeCm: [8, 14], view: "shadow", variants: 2, wave: 1, live: true, brief: "위에서 본 피라미의 실루엣(단색 진남색) — 가늘고 긴 방추형, 꼬리는 깊게 갈라진다. 지느러미는 얇게, 몸통 윤곽만.", blurb: "여울 어디에나 있는 작은 물고기. 떼로 몰려다니며 햇빛에 옆구리가 반짝인다." },
  { id: "fish-chinesemin", kind: "fish", nameKo: "버들치", nameEn: "Chinese minnow", biomes: ["valley"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "common", sizeCm: [6, 12], view: "shadow", wave: 1, brief: "위에서 본 버들치 실루엣 — 피라미보다 통통하고 짧다, 꼬리 갈라짐이 얕다.", blurb: "차고 맑은 계곡물에만 산다. 이 녀석이 있으면 물이 좋다는 뜻." },
  { id: "fish-darkchub", kind: "fish", nameKo: "갈겨니", nameEn: "Dark chub", biomes: ["valley"], habitat: "water", months: m(4, 10), bands: DAY, tier: "common", sizeCm: [10, 18], view: "shadow", wave: 2, brief: "위에서 본 갈겨니 실루엣 — 피라미와 같은 방추형이되 머리가 크고 눈이 크다.", blurb: "피라미와 같은 여울을 나눠 쓴다. 눈이 커서 이름을 붙이기 전부터 구별했다." },
  { id: "fish-crucian", kind: "fish", nameKo: "붕어", nameEn: "Crucian carp", biomes: ["pond"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "common", sizeCm: [15, 30], view: "shadow", variants: 2, wave: 1, live: true, brief: "위에서 본 붕어(부채꼬리) 실루엣, 단색 — 몸이 넓고 납작하다.", blurb: "연못의 터줏대감. 사람 그림자가 지면 천천히 깊은 쪽으로 물러난다." },
  { id: "fish-carp", kind: "fish", nameKo: "잉어", nameEn: "Common carp", biomes: ["pond"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "uncommon", sizeCm: [40, 90], view: "shadow", wave: 1, live: true, brief: "위에서 본 잉어 실루엣(단색 진남색) — 크고 길다, 입가에 수염 두 쌍이 얇게 보인다.", blurb: "연못에서 가장 큰 그림자. 느릿느릿 지나가는데 물이 밀려 보인다." },
  { id: "fish-loach", kind: "fish", nameKo: "미꾸라지", nameEn: "Loach", biomes: ["pond"], habitat: "mud", months: m(4, 10), bands: BANDS_ALL, tier: "common", sizeCm: [10, 20], view: "shadow", wave: 2, brief: "위에서 본 미꾸라지 실루엣 — 뱀처럼 길고 가늘다, 수염이 짧게 여러 개.", blurb: "바닥 진흙에 몸을 반쯤 묻고 있다. 흙탕이 일면 거기 있었던 것." },
  { id: "fish-catfish", kind: "fish", nameKo: "메기", nameEn: "Far Eastern catfish", biomes: ["pond"], habitat: "water", months: m(5, 9), bands: NIGHT, tier: "rare", sizeCm: [40, 80], view: "shadow", wave: 2, brief: "위에서 본 메기 실루엣 — 머리가 넓적하고 몸은 뒤로 갈수록 가늘다, 긴 수염 두 쌍.", blurb: "밤에만 바닥에서 올라온다. 그림자가 유난히 넓적해서 멀리서도 안다." },
  { id: "fish-mandarin", kind: "fish", nameKo: "쏘가리", nameEn: "Mandarin fish", biomes: ["valley"], habitat: "rock", months: m(5, 9), bands: NIGHT, tier: "rare", sizeCm: [25, 50], view: "shadow", wave: 2, brief: "위에서 본 쏘가리 실루엣 — 등지느러미에 가시가 서 있고 몸에 얼룩무늬가 진하다.", blurb: "바위 그늘에 숨어 지나가는 것을 노린다. 계곡에서 가장 사나운 물고기." },
  { id: "fish-bitterling", kind: "fish", nameKo: "각시붕어", nameEn: "Korean rosy bitterling", biomes: ["pond"], habitat: "water", months: m(4, 9), bands: DAY, tier: "uncommon", sizeCm: [4, 6], view: "shadow", wave: 3, brief: "위에서 본 각시붕어 실루엣 — 아주 작고 몸이 높다(마름모에 가깝다).", blurb: "손톱만 한 붕어. 봄엔 조개 속에 알을 맡기고 간다." },
  { id: "fish-bullhead", kind: "fish", nameKo: "동자개", nameEn: "Korean bullhead", biomes: ["pond"], habitat: "mud", months: m(6, 9), bands: NIGHT, tier: "uncommon", sizeCm: [15, 25], view: "shadow", wave: 3, brief: "위에서 본 동자개 실루엣 — 메기를 줄인 몸에 수염 네 쌍, 등에 가시 한 대.", blurb: "잡으면 '빠각' 소리를 낸다고 빠가사리. 밤에 바닥을 훑는다." },
  { id: "fish-sweetfish", kind: "fish", nameKo: "은어", nameEn: "Ayu", biomes: ["valley"], habitat: "water", months: m(6, 9), bands: DAY, tier: "rare", sizeCm: [15, 30], view: "shadow", wave: 2, brief: "위에서 본 은어 실루엣 — 날씬하고 곧다, 등에 작은 기름지느러미가 하나 더 있다.", blurb: "수박 냄새가 난다고 한다. 자기 돌을 정해 두고 다른 은어를 쫓아낸다." },
  { id: "fish-lenok", kind: "fish", nameKo: "열목어", nameEn: "Lenok", biomes: ["valley"], habitat: "water", months: m(11, 4), bands: DAY, tier: "epic", sizeCm: [30, 60], view: "shadow", wave: 3, brief: "위에서 본 열목어 실루엣 — 연어를 닮은 방추형, 등에 기름지느러미.", blurb: "가장 차가운 상류에만 남았다. 만나면 그 물이 아주 깨끗하다는 증거." },
  { id: "fish-cherrytrout", kind: "fish", nameKo: "산천어", nameEn: "Cherry trout", biomes: ["valley"], habitat: "water", months: m(3, 6), bands: DAY, tier: "rare", sizeCm: [20, 40], view: "shadow", wave: 3, brief: "위에서 본 산천어 실루엣 — 송어형, 옆줄을 따라 둥근 얼룩(파마크)이 늘어선다.", blurb: "바다로 안 내려간 송어. 계곡에 남기로 한 쪽이다." },
  { id: "fish-eel", kind: "fish", nameKo: "뱀장어", nameEn: "Japanese eel", biomes: ["pond"], habitat: "mud", months: m(5, 10), bands: NIGHT, tier: "rare", sizeCm: [40, 100], view: "shadow", wave: 3, brief: "위에서 본 뱀장어 실루엣 — 아주 길고 리본처럼 굽는다, 지느러미가 등에서 꼬리까지 이어진다.", blurb: "먼바다에서 태어나 강을 거슬러 왔다. 다시 그 바다로 돌아가 알을 낳는다." },
  { id: "fish-snakehead", kind: "fish", nameKo: "가물치", nameEn: "Snakehead", biomes: ["pond"], habitat: "water", months: m(6, 9), bands: DAY, tier: "rare", sizeCm: [40, 80], view: "shadow", wave: 3, brief: "위에서 본 가물치 실루엣 — 뱀 같은 머리와 굵고 긴 몸, 등지느러미가 길게 이어진다.", blurb: "숨을 쉬러 수면으로 올라온다. 새끼 떼를 몰고 다니는 것을 보면 비켜 주자." },
  { id: "fish-mudskipper", kind: "fish", nameKo: "짱뚱어", nameEn: "Mudskipper", biomes: ["tidal"], habitat: "mud", months: m(5, 9), bands: DAY, tier: "uncommon", sizeCm: [10, 18], view: "upright", variants: 2, wave: 1, brief: "짱뚱어 — **물 밖 뻘 위에 앉은** 3/4 정면. 눈이 머리 위로 튀어나왔고 가슴지느러미로 몸을 받쳐 세운다. 회갈색에 푸른 점.", blurb: "물고기인데 뻘 위를 뛰어다닌다. 눈이 머리 꼭대기에 있어 사방을 본다." },
  { id: "fish-goby", kind: "fish", nameKo: "망둑어", nameEn: "Goby", biomes: ["tidal", "sandy"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "common", sizeCm: [10, 20], view: "shadow", wave: 1, brief: "위에서 본 망둑어 실루엣 — 머리가 크고 몸이 뒤로 가늘어진다, 배지느러미가 붙어 빨판처럼.", blurb: "물골 어디에나 있다. 썰물에 남은 웅덩이에서도 잘 견딘다." },
  { id: "fish-mullet", kind: "fish", nameKo: "숭어", nameEn: "Flathead mullet", biomes: ["tidal", "sandy"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "uncommon", sizeCm: [30, 60], view: "shadow", wave: 2, brief: "위에서 본 숭어 실루엣 — 굵은 방추형, 머리가 납작하고 넓다.", blurb: "가끔 이유 없이 물 밖으로 튀어오른다. 아무도 왜인지 확실히 모른다." },
  { id: "fish-rockfish", kind: "fish", nameKo: "볼락", nameEn: "Korean rockfish", biomes: ["rocky"], habitat: "rock", months: MONTHS_ALL, bands: NIGHT, tier: "uncommon", sizeCm: [15, 30], view: "shadow", wave: 1, brief: "위에서 본 볼락 실루엣 — 몸이 높고 등지느러미 가시가 촘촘하다, 눈이 크다.", blurb: "바위 틈에 머리를 두고 떠 있다. 밤에 불빛을 비추면 눈이 먼저 보인다." },
  { id: "fish-seabass", kind: "fish", nameKo: "우럭", nameEn: "Jacopever", biomes: ["rocky"], habitat: "rock", months: MONTHS_ALL, bands: BANDS_ALL, tier: "uncommon", sizeCm: [25, 45], view: "shadow", wave: 2, brief: "위에서 본 우럭(조피볼락) 실루엣 — 볼락보다 크고 두툼하다, 머리가 각졌다.", blurb: "제자리를 잘 지킨다. 한 바위에 한 마리씩 세 들어 산다." },
  { id: "fish-wrasse", kind: "fish", nameKo: "놀래기", nameEn: "Wrasse", biomes: ["rocky"], habitat: "rock", months: m(5, 10), bands: DAY, tier: "common", sizeCm: [10, 20], view: "shadow", wave: 2, brief: "위에서 본 놀래기 실루엣 — 길쭉하고 입이 앞으로 뾰족하다.", blurb: "해가 지면 모래에 파고들어 잔다. 아침에 같은 바위로 돌아온다." },
  { id: "fish-flounder", kind: "fish", nameKo: "넙치", nameEn: "Olive flounder", biomes: ["sandy"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "rare", sizeCm: [40, 80], view: "shadow", wave: 1, brief: "위에서 본 넙치 실루엣 — 타원형으로 아주 납작하다, 가장자리 지느러미가 물결친다. 두 눈이 한쪽에 몰려 있다.", blurb: "모래에 몸을 덮고 눈만 내놓는다. 지나가고 나서야 모래가 부풀어 오른다." },
  { id: "fish-halibut", kind: "fish", nameKo: "가자미", nameEn: "Righteye flounder", biomes: ["sandy"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "uncommon", sizeCm: [20, 40], view: "shadow", wave: 2, brief: "위에서 본 가자미 실루엣 — 넙치와 같은 납작한 타원이되 작고 몸이 더 둥글다.", blurb: "넙치와 눈 쏠린 방향이 반대다. 나란히 두면 바로 안다." },
  { id: "fish-halfbeak", kind: "fish", nameKo: "학공치", nameEn: "Halfbeak", biomes: ["sandy"], habitat: "surface", months: m(4, 10), bands: DAY, tier: "uncommon", sizeCm: [20, 35], view: "shadow", wave: 3, brief: "위에서 본 학공치 실루엣 — 바늘처럼 가늘고 **아랫턱만 길게 뻗었다**.", blurb: "수면 바로 아래를 줄지어 다닌다. 아래턱이 바늘처럼 길다." },
  { id: "fish-shad", kind: "fish", nameKo: "전어", nameEn: "Gizzard shad", biomes: ["sandy", "tidal"], habitat: "water", months: m(8, 11), bands: DAY, tier: "uncommon", sizeCm: [15, 25], view: "shadow", wave: 2, brief: "위에서 본 전어 실루엣 — 몸이 높고 옆으로 납작하다, 등에 검은 점 하나.", blurb: "가을이 되면 떼로 들어온다. 굽는 냄새에 집 나간 사람이 돌아온다는 그 물고기." },
  { id: "fish-mackerel", kind: "fish", nameKo: "고등어", nameEn: "Chub mackerel", biomes: ["sea"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "common", sizeCm: [25, 45], view: "shadow", variants: 2, wave: 1, brief: "위에서 본 고등어 실루엣 — 매끈한 방추형, 꼬리 앞에 작은 토막지느러미가 줄지어 있다.", blurb: "바다에서 가장 흔한 은빛. 한 무리가 통째로 방향을 바꾼다." },
  { id: "fish-yellowtail", kind: "fish", nameKo: "방어", nameEn: "Yellowtail", biomes: ["sea"], habitat: "water", months: m(11, 2), bands: BANDS_ALL, tier: "rare", sizeCm: [60, 120], view: "shadow", wave: 2, brief: "위에서 본 방어 실루엣 — 크고 두툼한 방추형, 꼬리가 초승달처럼 깊게 갈라진다.", blurb: "겨울에 살이 오른다. 큰 것 한 마리가 지나가면 작은 물고기가 흩어진다." },
  { id: "fish-spanishmack", kind: "fish", nameKo: "삼치", nameEn: "Spanish mackerel", biomes: ["sea"], habitat: "water", months: m(9, 11), bands: DAY, tier: "uncommon", sizeCm: [50, 100], view: "shadow", wave: 3, brief: "위에서 본 삼치 실루엣 — 길고 날씬하다, 입이 뾰족하고 이가 보일 만큼 크다.", blurb: "빠르다. 그림자가 지나갔다고 생각한 순간 이미 없다." },
  { id: "fish-dolphinfish", kind: "fish", nameKo: "만새기", nameEn: "Mahi-mahi", biomes: ["sea"], habitat: "water", months: m(6, 9), bands: DAY, tier: "rare", sizeCm: [80, 150], view: "shadow", wave: 3, brief: "위에서 본 만새기 실루엣 — 이마가 각지게 솟았고 등지느러미가 머리부터 꼬리까지 이어진다.", blurb: "여름 먼바다의 사냥꾼. 이마가 네모나서 옆에서 보면 더 크다." },
  { id: "fish-tuna", kind: "fish", nameKo: "참다랑어", nameEn: "Bluefin tuna", biomes: ["sea"], habitat: "water", months: m(11, 3), bands: BANDS_ALL, tier: "epic", sizeCm: [150, 300], view: "shadow", wave: 3, brief: "위에서 본 참다랑어 실루엣 — 아주 크고 완벽한 방추형, 꼬리가 낫처럼 좁고 깊다.", blurb: "평생 헤엄을 멈추지 않는다. 멈추면 숨을 못 쉬기 때문에." },
  { id: "fish-sunfish", kind: "fish", nameKo: "개복치", nameEn: "Ocean sunfish", biomes: ["sea"], habitat: "surface", months: m(7, 9), bands: DAY, tier: "epic", sizeCm: [180, 300], view: "shadow", wave: 2, brief: "위에서 본 개복치 실루엣 — 거의 원반, 꼬리가 없고 등·배 지느러미가 위아래로 길게 뻗었다.", blurb: "수면에 옆으로 누워 해를 쬔다. 큰 몸으로 아주 느리게." },
  { id: "fish-ray", kind: "fish", nameKo: "가오리", nameEn: "Ray", biomes: ["sea", "sandy"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "rare", sizeCm: [50, 120], view: "shadow", wave: 2, brief: "위에서 본 가오리 실루엣 — 넓은 마름모 날개와 가늘고 긴 꼬리.", blurb: "날개를 물결처럼 저어 간다. 모래 위를 지나면 자국이 남는다." },
  { id: "fish-shark", kind: "fish", nameKo: "청상아리", nameEn: "Mako shark", biomes: ["sea"], habitat: "water", months: m(6, 9), bands: BANDS_ALL, tier: "legend", sizeCm: [200, 350], view: "shadow", wave: 2, brief: "위에서 본 상어 실루엣 — 뾰족한 주둥이, 삼각 등지느러미가 몸 밖으로 하나 더 튀어나온 윤곽.", blurb: "등지느러미가 먼저 보인다. 그러고 나서야 얼마나 큰지 안다." },
  { id: "fish-anglerfish", kind: "fish", nameKo: "아귀", nameEn: "Anglerfish", biomes: ["deep"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "rare", sizeCm: [40, 90], view: "side", wave: 1, brief: "**옆모습** 아귀(깊은 바다는 옆에서 본다) — 머리와 입이 몸의 절반, 이마에서 낚싯대 같은 돌기가 앞으로 뻗고 끝에 작은 발광 구슬.", blurb: "이마의 등불로 부른다. 온 것이 무엇인지는 보지도 않고 삼킨다." },
  { id: "fish-lanternfish", kind: "fish", nameKo: "샛비늘치", nameEn: "Lanternfish", biomes: ["deep"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "common", sizeCm: [5, 12], view: "side", variants: 2, wave: 1, brief: "**옆모습** 샛비늘치 — 손가락만 한 물고기, 배와 옆구리에 발광점이 점선처럼 늘어선다. 눈이 크다.", blurb: "바다에서 가장 수가 많은 물고기. 밤이면 다 같이 위로 올라온다." },
  { id: "fish-viperfish", kind: "fish", nameKo: "독사고기", nameEn: "Viperfish", biomes: ["deep"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "rare", sizeCm: [20, 35], view: "side", wave: 2, brief: "**옆모습** 독사고기 — 가늘고 긴 몸, 입 밖으로 삐져나온 바늘 같은 이빨, 등지느러미 첫 가시가 낚싯대처럼 길다.", blurb: "이빨이 입에 다 안 들어간다. 그래서 늘 웃는 것처럼 보인다." },
  { id: "fish-gulpereel", kind: "fish", nameKo: "풍선장어", nameEn: "Gulper eel", biomes: ["deep"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "epic", sizeCm: [60, 180], view: "side", wave: 3, brief: "**옆모습** 풍선장어 — 몸은 채찍처럼 가늘고 **입만 자루처럼 크게 벌어진다**, 꼬리 끝에 작은 발광점.", blurb: "몸보다 큰 입. 무엇이 올지 모르니 다 삼킬 수 있게." },
  { id: "fish-squid", kind: "fish", nameKo: "대왕오징어", nameEn: "Giant squid", biomes: ["deep"], habitat: "water", months: MONTHS_ALL, bands: NIGHT, tier: "legend", sizeCm: [400, 900], view: "side", wave: 3, brief: "**옆모습** 대왕오징어 — 원뿔 몸통과 지느러미 둘, 팔 여덟에 아주 긴 촉완 둘. 눈이 접시만 하다.", blurb: "눈이 사람 얼굴만 하다. 이 어둠에서 무엇을 보려고." },
  { id: "fish-jelly", kind: "fish", nameKo: "관해파리", nameEn: "Siphonophore", biomes: ["deep"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "uncommon", sizeCm: [30, 200], view: "side", variants: 2, wave: 1, brief: "**옆모습** 관해파리 — 반투명한 종 아래로 실 같은 촉수가 길게 늘어진다. 몸을 따라 푸른 발광이 번진다.", blurb: "한 마리가 아니라 여럿이 붙어 하나처럼 산다. 빛이 몸을 따라 흐른다." },
  { id: "fish-whale-shadow", kind: "fish", nameKo: "향고래 그림자", nameEn: "Sperm whale", biomes: ["deep"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "legend", sizeCm: [1100, 1600], view: "side", wave: 3, brief: "**옆모습** 향고래의 큰 실루엣(단색, 반투명) — 네모난 머리가 몸의 3분의 1, 아래턱이 가늘다. 화면을 가로지를 만큼 크게.", blurb: "머리가 네모나다. 지나가는 데 한참 걸리고, 지나가고 나면 물이 한참 흔들린다." }
];

// ── 곤충 40종 ──────────────────────────────────────────────────────────────────────────────────────
// 초원·숲·들판·산 + 물가(민물·계곡). 나비·잠자리는 위에서(topdown), 나머지 대부분은 세워서(3/4).
const BUGS: readonly CodexEntry[] = [
  { id: "bug-cabbagewhite", kind: "bug", nameKo: "배추흰나비", nameEn: "Cabbage white", biomes: ["meadow", "hill"], habitat: "flower", months: m(3, 11), bands: DAY, weather: ["clear", "cloud", "wind"], tier: "common", sizeCm: [4, 5], view: "topdown", variants: 2, wave: 1, live: true, brief: "위에서 본 배추흰나비, 날개를 편 상태 — 흰 날개 끝에 검은 얼룩, 채도 낮게.", blurb: "봄에 가장 먼저 보이는 나비. 밭이든 풀밭이든 가리지 않는다." },
  { id: "bug-swallowtail", kind: "bug", nameKo: "호랑나비", nameEn: "Swallowtail", biomes: ["meadow", "forest"], habitat: "flower", months: m(4, 9), bands: DAY, weather: ["clear", "cloud"], tier: "uncommon", sizeCm: [8, 12], view: "topdown", wave: 1, brief: "위에서 본 호랑나비 — 크림 노랑 바탕에 검은 줄, 뒷날개에 꼬리 돌기와 남보라 점(선명한 노랑 금지, 크림 톤).", blurb: "크고 느리게 난다. 꽃 위에서 날개를 접지 않고 계속 떤다." },
  { id: "bug-blackswallow", kind: "bug", nameKo: "제비나비", nameEn: "Black swallowtail", biomes: ["forest", "valley"], habitat: "flower", months: m(5, 8), bands: DAY, tier: "uncommon", sizeCm: [8, 11], view: "topdown", wave: 2, brief: "위에서 본 제비나비 — 검은 날개에 청록·남보라 비늘가루 광택, 뒷날개 꼬리 돌기.", blurb: "그늘에서 보면 검고 볕에서 보면 푸르다. 물가에 모여 물을 빤다." },
  { id: "bug-blue", kind: "bug", nameKo: "부전나비", nameEn: "Blue butterfly", biomes: ["meadow", "hill"], habitat: "flower", months: m(4, 10), bands: DAY, tier: "common", sizeCm: [2, 3], view: "topdown", variants: 2, wave: 1, live: true, brief: "위에서 본 부전나비 — 아주 작다, 연보라·회청 날개(채도 낮게), 가장자리에 흰 테.", blurb: "손톱만 한 나비. 낮게 날아 풀 사이로 사라진다." },
  { id: "bug-comma", kind: "bug", nameKo: "네발나비", nameEn: "Comma butterfly", biomes: ["hill", "forest"], habitat: "flower", months: m(3, 11), bands: DAY, tier: "common", sizeCm: [4, 6], view: "topdown", wave: 2, brief: "위에서 본 네발나비 — 날개 가장자리가 톱니처럼 들쭉날쭉, 갈색·황토에 검은 점.", blurb: "날개를 접으면 마른 잎과 구별이 안 된다. 어른벌레로 겨울을 난다." },
  { id: "bug-ladybug", kind: "bug", nameKo: "무당벌레", nameEn: "Ladybug", biomes: ["meadow", "hill"], habitat: "ground", months: m(3, 10), bands: DAY, tier: "common", sizeCm: [1, 1], view: "topdown", wave: 1, live: true, brief: "위에서 본 무당벌레 — 검은 점 일곱, 채도 낮은 벽돌빨강(선명한 빨강 금지).", blurb: "위험하면 다리를 접고 죽은 척한다. 잠시 뒤 아무 일 없었다는 듯 날아간다." },
  { id: "bug-honeybee", kind: "bug", nameKo: "꿀벌", nameEn: "Honeybee", biomes: ["meadow", "hill"], habitat: "flower", months: m(3, 10), bands: DAY, weather: ["clear", "cloud"], tier: "common", sizeCm: [1, 2], view: "upright", wave: 1, live: true, brief: "꿀벌 — 3/4 정면, 통통한 몸과 반투명 날개, 밀짚 노랑과 갈색 줄.", blurb: "꽃을 순서대로 돈다. 어제 돈 순서를 오늘도 기억한다." },
  { id: "bug-bumblebee", kind: "bug", nameKo: "호박벌", nameEn: "Bumblebee", biomes: ["meadow", "hill"], habitat: "flower", months: m(4, 9), bands: DAY, tier: "uncommon", sizeCm: [2, 3], view: "upright", wave: 2, brief: "호박벌 — 3/4 정면, 꿀벌보다 두 배 통통하고 털이 북슬북슬하다, 검정·황토 줄.", blurb: "몸에 비해 날개가 작은데도 잘 난다. 소리가 낮고 굵다." },
  { id: "bug-hornet", kind: "bug", nameKo: "말벌", nameEn: "Hornet", biomes: ["forest"], habitat: "tree", months: m(6, 9), bands: DAY, tier: "rare", sizeCm: [3, 4], view: "upright", wave: 3, brief: "말벌 — 3/4 정면, 허리가 잘록하고 몸이 길다, 황토·검정 줄에 턱이 크다.", blurb: "가까이 가면 먼저 경고한다. 그 경고를 무시하지 않는 게 좋다." },
  { id: "bug-reddragonfly", kind: "bug", nameKo: "고추잠자리", nameEn: "Red dragonfly", biomes: ["hill", "pond"], habitat: "air", months: m(6, 10), bands: DAY, tier: "common", sizeCm: [4, 5], view: "topdown", variants: 2, wave: 1, brief: "위에서 본 고추잠자리 — 투명 날개 넷, 몸은 채도 낮은 벽돌빛(선명한 빨강 금지).", blurb: "가을 하늘을 가득 채운다. 막대 끝에 앉는 걸 좋아한다." },
  { id: "bug-emperordragon", kind: "bug", nameKo: "왕잠자리", nameEn: "Emperor dragonfly", biomes: ["pond"], habitat: "air", months: m(5, 9), bands: DAY, tier: "uncommon", sizeCm: [7, 9], view: "topdown", wave: 2, brief: "위에서 본 왕잠자리 — 크다, 가슴은 초록 배는 청록·남색, 날개 넷이 넓다.", blurb: "연못 위를 자기 구역처럼 돈다. 다른 잠자리가 들어오면 쫓아낸다." },
  { id: "bug-damselfly", kind: "bug", nameKo: "실잠자리", nameEn: "Damselfly", biomes: ["pond", "valley"], habitat: "shore", months: m(5, 8), bands: DAY, tier: "common", sizeCm: [3, 4], view: "topdown", wave: 2, brief: "위에서 본 실잠자리 — 실처럼 가는 몸, 날개가 좁고 앉으면 등 위로 모은다. 청록 또는 연보라.", blurb: "잠자리보다 훨씬 가늘다. 앉을 때 날개를 접는 것으로 구별한다." },
  { id: "bug-goldendragon", kind: "bug", nameKo: "장수잠자리", nameEn: "Golden-ringed dragonfly", biomes: ["valley"], habitat: "air", months: m(6, 9), bands: DAY, tier: "epic", sizeCm: [9, 11], view: "topdown", wave: 3, brief: "위에서 본 장수잠자리 — 우리나라에서 가장 큰 잠자리, 검은 배에 황토 고리 줄, 눈이 초록.", blurb: "계곡을 따라 오르내린다. 지나갈 때 날개 소리가 들린다." },
  { id: "bug-stagbeetle", kind: "bug", nameKo: "사슴벌레", nameEn: "Stag beetle", biomes: ["forest"], habitat: "tree", months: m(6, 9), bands: NIGHT, tier: "rare", sizeCm: [4, 8], view: "topdown", variants: 2, wave: 1, brief: "위에서 본 사슴벌레 — 광택 나는 흑갈색, 사슴뿔처럼 벌어진 큰 턱 한 쌍.", blurb: "참나무 진에 모인다. 밤에 손전등을 비추면 턱부터 든다." },
  { id: "bug-rhinobeetle", kind: "bug", nameKo: "장수풍뎅이", nameEn: "Rhinoceros beetle", biomes: ["forest"], habitat: "tree", months: m(7, 8), bands: NIGHT, tier: "epic", sizeCm: [4, 8], view: "topdown", wave: 1, brief: "위에서 본 장수풍뎅이 — 두툼한 흑갈색 몸, 머리에서 위로 굽은 뿔 하나와 가슴의 작은 뿔.", blurb: "한여름 밤에만 나온다. 뿔로 다른 수컷을 밀어 나무에서 떨어뜨린다." },
  { id: "bug-scarab", kind: "bug", nameKo: "풍뎅이", nameEn: "Scarab beetle", biomes: ["forest", "meadow"], habitat: "tree", months: m(5, 9), bands: BANDS_ALL, tier: "common", sizeCm: [2, 3], view: "topdown", variants: 2, wave: 2, brief: "위에서 본 풍뎅이 — 둥근 등딱지에 금속 광택(청록·구릿빛 두 변형).", blurb: "몸이 금속처럼 빛난다. 잡으면 다리로 손가락을 꼭 붙든다." },
  { id: "bug-longhorn", kind: "bug", nameKo: "하늘소", nameEn: "Longhorn beetle", biomes: ["forest"], habitat: "tree", months: m(6, 8), bands: BANDS_ALL, tier: "rare", sizeCm: [3, 5], view: "topdown", wave: 3, brief: "위에서 본 하늘소 — 몸보다 긴 더듬이 두 개, 회흑색 등딱지에 흰 점무늬.", blurb: "더듬이가 몸보다 길다. 나무를 갉는 소리가 밤에 들린다." },
  { id: "bug-cicada", kind: "bug", nameKo: "참매미", nameEn: "Cicada", biomes: ["forest", "meadow"], habitat: "tree", months: m(7, 9), bands: DAY, tier: "common", sizeCm: [3, 4], view: "upright", variants: 2, wave: 1, brief: "참매미 — 3/4 정면, 나무줄기에 붙은 자세. 투명한 날개를 지붕처럼 접고 등에 초록·검정 무늬.", blurb: "땅속에서 몇 년을 살고 나와 한 철을 운다. 그 한 철이 여름의 소리다." },
  { id: "bug-largecicada", kind: "bug", nameKo: "말매미", nameEn: "Large black cicada", biomes: ["forest"], habitat: "tree", months: m(7, 8), bands: DAY, tier: "uncommon", sizeCm: [4, 6], view: "upright", wave: 3, brief: "말매미 — 3/4 정면, 참매미보다 크고 몸이 검다, 날개가 넓다.", blurb: "가장 크고 가장 시끄럽다. 한 마리가 울면 온 나무가 따라 운다." },
  { id: "bug-katydid", kind: "bug", nameKo: "여치", nameEn: "Katydid", biomes: ["meadow", "hill"], habitat: "ground", months: m(7, 10), bands: BANDS_ALL, tier: "uncommon", sizeCm: [3, 5], view: "upright", wave: 2, brief: "여치 — 3/4 정면, 초록 몸에 아주 긴 더듬이, 뒷다리가 크고 접혀 있다.", blurb: "풀잎과 같은 초록이라 소리로 먼저 찾는다. 다가가면 뚝 그친다." },
  { id: "bug-cricket", kind: "bug", nameKo: "귀뚜라미", nameEn: "Cricket", biomes: ["meadow", "hill"], habitat: "ground", months: m(8, 11), bands: NIGHT, tier: "common", sizeCm: [2, 3], view: "upright", wave: 1, brief: "귀뚜라미 — 3/4 정면, 흑갈색 광택, 긴 더듬이와 꼬리털 둘, 날개를 등에 납작하게 접었다.", blurb: "가을밤의 소리. 날개를 비벼서 내는 소리라 다리는 가만히 있다." },
  { id: "bug-grasshopper", kind: "bug", nameKo: "방아깨비", nameEn: "Grasshopper", biomes: ["meadow", "hill"], habitat: "ground", months: m(7, 10), bands: DAY, tier: "common", sizeCm: [4, 8], view: "upright", variants: 2, wave: 2, brief: "방아깨비 — 3/4 정면, 머리가 원뿔로 뾰족하고 몸이 아주 길다, 초록·갈색 두 변형.", blurb: "뒷다리를 잡으면 방아를 찧듯 몸을 끄덕인다. 그래서 방아깨비." },
  { id: "bug-locust", kind: "bug", nameKo: "메뚜기", nameEn: "Locust", biomes: ["meadow"], habitat: "ground", months: m(8, 10), bands: DAY, tier: "common", sizeCm: [3, 5], view: "upright", wave: 2, brief: "메뚜기 — 3/4 정면, 방아깨비보다 몸이 짧고 통통하다, 황록색.", blurb: "다가가면 팟 하고 튄다. 어디로 갔는지 눈으로 못 쫓는다." },
  { id: "bug-mantis", kind: "bug", nameKo: "사마귀", nameEn: "Praying mantis", biomes: ["meadow", "forest"], habitat: "ground", months: m(8, 11), bands: DAY, tier: "uncommon", sizeCm: [6, 9], view: "upright", wave: 1, brief: "사마귀 — 3/4 정면, 삼각형 머리를 돌리고 앞다리 둘을 접어 든 자세. 초록 또는 갈색.", blurb: "고개를 돌려 사람을 본다. 곤충 중에 이렇게 마주 보는 것은 드물다." },
  { id: "bug-firefly", kind: "bug", nameKo: "애반딧불이", nameEn: "Firefly", biomes: ["valley", "pond"], habitat: "air", months: m(6, 8), bands: ["evening", "night"], weather: ["clear", "cloud"], tier: "epic", sizeCm: [1, 1], view: "topdown", wave: 1, live: true, brief: "위에서 본 애반딧불이 — 작고 검은 몸, 가슴은 분홍빛 주홍(채도 낮게), 배 끝 두 마디가 연노랑으로 빛난다.", blurb: "깨끗한 물가에만 남았다. 깜빡이는 간격으로 서로를 알아본다." },
  { id: "bug-waterstrider", kind: "bug", nameKo: "소금쟁이", nameEn: "Water strider", biomes: ["pond", "valley"], habitat: "surface", months: m(4, 10), bands: BANDS_ALL, tier: "common", sizeCm: [1, 2], view: "topdown", wave: 1, brief: "위에서 본 소금쟁이 — 가는 몸과 아주 긴 다리 넷이 수면에 닿는다(파문은 엔진이 그린다).", blurb: "물 위에 서 있다. 다리 끝의 잔털이 물을 밀어내서 가라앉지 않는다." },
  { id: "bug-divingbeetle", kind: "bug", nameKo: "물방개", nameEn: "Diving beetle", biomes: ["pond"], habitat: "water", months: m(5, 9), bands: BANDS_ALL, tier: "uncommon", sizeCm: [3, 4], view: "topdown", wave: 2, brief: "위에서 본 물방개 — 매끈한 타원 등딱지(흑록), 뒷다리가 노처럼 납작하고 털이 났다.", blurb: "숨을 등딱지 밑에 저장해 간다. 다 쓰면 꽁무니를 물 밖으로 내민다." },
  { id: "bug-giantwaterbug", kind: "bug", nameKo: "물장군", nameEn: "Giant water bug", biomes: ["pond"], habitat: "water", months: m(6, 9), bands: NIGHT, tier: "legend", sizeCm: [5, 7], view: "topdown", wave: 3, brief: "위에서 본 물장군 — 넓적한 갈색 몸, 앞다리가 낫처럼 굵고 접힌다. 우리나라에서 가장 큰 노린재.", blurb: "물에서 개구리도 잡는다. 이제는 아주 드물어서 만나면 운이 좋은 날." },
  { id: "bug-ant", kind: "bug", nameKo: "개미", nameEn: "Ant", biomes: ["meadow", "forest"], habitat: "ground", months: m(3, 11), bands: BANDS_ALL, tier: "common", sizeCm: [1, 1], view: "topdown", wave: 2, brief: "위에서 본 개미 한 마리(행렬은 엔진이 만든다) — 진갈색, 허리가 잘록한 세 마디.", blurb: "한 줄로 간다. 앞서간 개미가 남긴 냄새를 따라가는 것." },
  { id: "bug-spider", kind: "bug", nameKo: "무당거미", nameEn: "Golden orb spider", biomes: ["forest"], habitat: "tree", months: m(8, 11), bands: BANDS_ALL, tier: "uncommon", sizeCm: [2, 3], view: "topdown", wave: 3, brief: "위에서 본 무당거미 — 길쭉한 배에 노랑·청회 가로줄, 다리 여덟에 마디마다 노란 테(거미줄은 엔진).", blurb: "가을 숲길에 줄을 친다. 얼굴로 먼저 알아차리게 되는 거미." },
  { id: "bug-hawkmoth", kind: "bug", nameKo: "박각시", nameEn: "Hawk moth", biomes: ["meadow", "forest"], habitat: "flower", months: m(6, 9), bands: ["dusk", "evening"], tier: "uncommon", sizeCm: [5, 8], view: "topdown", wave: 3, brief: "위에서 본 박각시 — 좁고 뾰족한 날개, 회갈색에 분홍 뒷날개가 살짝 비친다. 몸이 굵다.", blurb: "벌새처럼 꽃 앞에 멈춰 떠 있다. 날개가 안 보일 만큼 빠르다." },
  { id: "bug-snail", kind: "bug", nameKo: "달팽이", nameEn: "Snail", biomes: ["forest", "meadow"], habitat: "ground", months: m(4, 10), bands: BANDS_ALL, afterRain: true, tier: "uncommon", sizeCm: [2, 4], view: "upright", variants: 2, wave: 1, brief: "달팽이 — 3/4 정면, 갈색 나선 껍데기와 더듬이 넷(긴 것 둘에 눈).", blurb: "비가 그치면 나온다. 지나간 자리에 은빛 길이 남는다." },
  { id: "bug-earthworm", kind: "bug", nameKo: "지렁이", nameEn: "Earthworm", biomes: ["meadow", "forest"], habitat: "ground", months: m(3, 11), bands: BANDS_ALL, afterRain: true, tier: "common", sizeCm: [8, 20], view: "topdown", wave: 2, brief: "위에서 본 지렁이 — 살구빛 분홍(채도 낮게), 마디가 촘촘하고 가운데가 살짝 부풀었다.", blurb: "비가 오면 땅 위로 올라온다. 흙을 갈아 주는 쪽은 이쪽이다." },
  { id: "bug-pillbug", kind: "bug", nameKo: "공벌레", nameEn: "Pill bug", biomes: ["forest", "meadow"], habitat: "rock", months: MONTHS_ALL, bands: BANDS_ALL, tier: "common", sizeCm: [1, 1], view: "topdown", wave: 3, brief: "위에서 본 공벌레 — 회흑색 마디가 겹친 타원(두 번째 변형은 공처럼 만 상태).", variants: 2, blurb: "건드리면 완전한 공이 된다. 돌을 들추면 늘 거기 있다." },
  { id: "bug-shieldbug", kind: "bug", nameKo: "노린재", nameEn: "Shield bug", biomes: ["meadow", "hill"], habitat: "ground", months: m(5, 10), bands: DAY, tier: "common", sizeCm: [1, 2], view: "topdown", wave: 3, brief: "위에서 본 노린재 — 방패 모양 등, 초록 또는 갈색에 등판 가운데 삼각 무늬.", blurb: "이름값을 한다. 건드리면 냄새가 손에 하루 남는다." },
  { id: "bug-mayfly", kind: "bug", nameKo: "하루살이", nameEn: "Mayfly", biomes: ["valley", "pond"], habitat: "air", months: m(5, 8), bands: ["dusk", "evening"], tier: "common", sizeCm: [1, 2], view: "topdown", variants: 2, wave: 3, brief: "위에서 본 하루살이 — 아주 여린 몸, 위로 세운 삼각 날개와 실 같은 꼬리 셋.", blurb: "어른이 되면 입이 없다. 먹지 않고 하루를 살다 간다." },
  { id: "bug-stonefly", kind: "bug", nameKo: "강도래", nameEn: "Stonefly", biomes: ["valley"], habitat: "rock", months: m(3, 5), bands: BANDS_ALL, tier: "uncommon", sizeCm: [2, 3], view: "topdown", wave: 3, brief: "위에서 본 강도래 — 납작한 갈색 몸, 날개를 등에 겹쳐 접고 꼬리털 둘.", blurb: "이른 봄 계곡 돌 위에 앉아 있다. 물이 깨끗해야만 사는 곤충." },
  { id: "bug-dungbeetle", kind: "bug", nameKo: "소똥구리", nameEn: "Dung beetle", biomes: ["hill"], habitat: "ground", months: m(6, 9), bands: DAY, tier: "legend", sizeCm: [1, 2], view: "topdown", wave: 3, brief: "위에서 본 소똥구리 — 둥글고 두툼한 흑청 등딱지, 앞다리가 톱니처럼 넓다.", blurb: "우리 들판에서 사라졌다가 돌아오는 중이다. 뒷다리로 밀며 뒷걸음으로 간다." },
  { id: "bug-longmantis", kind: "bug", nameKo: "왕사마귀", nameEn: "Giant mantis", biomes: ["forest"], habitat: "tree", months: m(9, 11), bands: DAY, tier: "rare", sizeCm: [8, 11], view: "upright", wave: 3, brief: "왕사마귀 — 3/4 정면, 사마귀보다 훨씬 크고 앞다리 안쪽에 검은 눈알 무늬.", blurb: "가을에 가장 커진다. 앞다리를 벌리면 안쪽에 눈 같은 무늬가 나온다." }
];

// ── 동물 44종 ──────────────────────────────────────────────────────────────────────────────────────
// 포유류·새·양서파충류·갯것. 대부분 세워 그림(3/4). 하늘 높이 나는 것과 물속 큰 것은 실루엣.
const ANIMALS: readonly CodexEntry[] = [
  { id: "animal-chipmunk", kind: "animal", nameKo: "다람쥐", nameEn: "Chipmunk", biomes: ["forest", "meadow"], habitat: "ground", months: m(3, 11), bands: DAY, tier: "uncommon", sizeCm: [12, 18], view: "upright", variants: 2, wave: 1, live: true, brief: "다람쥐 — 3/4 정면, 등에 검은 줄 다섯, 볼주머니가 볼록하고 꼬리를 등 위로 세웠다. 두 번째 변형은 도토리를 두 손에 쥔 자세.", blurb: "도토리를 여기저기 묻고 어디 묻었는지 절반은 잊는다. 그 절반이 나무가 된다." },
  { id: "animal-squirrel", kind: "animal", nameKo: "청설모", nameEn: "Korean squirrel", biomes: ["forest", "mountain"], habitat: "tree", months: MONTHS_ALL, bands: DAY, tier: "uncommon", sizeCm: [20, 25], view: "upright", wave: 2, brief: "청설모 — 3/4 정면, 회흑색 몸에 귀 끝의 긴 털, 꼬리가 몸만큼 굵고 길다.", blurb: "다람쥐보다 크고 나무 위에서 산다. 잣송이를 통째로 들고 다닌다." },
  { id: "animal-hare", kind: "animal", nameKo: "산토끼", nameEn: "Korean hare", biomes: ["meadow", "mountain"], habitat: "ground", months: MONTHS_ALL, bands: TWILIGHT, tier: "rare", sizeCm: [40, 50], view: "upright", variants: 2, wave: 1, live: true, brief: "산토끼 — 3/4 정면, 귀를 세우고 앉은 자세. 여름은 갈색, **겨울 변형은 흰 털**(같은 자세).", blurb: "겨울이면 털이 희어진다. 눈밭에서는 발자국이 먼저 보인다." },
  { id: "animal-waterdeer", kind: "animal", nameKo: "고라니", nameEn: "Water deer", biomes: ["hill", "forest"], habitat: "ground", months: MONTHS_ALL, bands: TWILIGHT, tier: "rare", sizeCm: [90, 100], view: "upright", wave: 1, brief: "고라니 — 3/4 정면, 뿔이 없고 **위 송곳니가 입 밖으로 조금 나왔다**, 황갈색에 짧은 꼬리.", blurb: "뿔 대신 송곳니가 난다. 놀라면 개처럼 짖고 달아난다." },
  { id: "animal-roedeer", kind: "animal", nameKo: "노루", nameEn: "Roe deer", biomes: ["mountain"], habitat: "ground", months: MONTHS_ALL, bands: TWILIGHT, tier: "epic", sizeCm: [100, 120], view: "upright", wave: 2, brief: "노루 — 3/4 정면, 짧은 뿔 한 쌍, 엉덩이의 흰 반점, 다리가 가늘고 길다.", blurb: "엉덩이의 흰 무늬가 먼저 보인다. 그 무늬가 보였다는 건 이미 도망 중이라는 뜻." },
  { id: "animal-boar", kind: "animal", nameKo: "멧돼지", nameEn: "Wild boar", biomes: ["forest", "mountain"], habitat: "ground", months: MONTHS_ALL, bands: NIGHT, tier: "epic", sizeCm: [120, 180], view: "upright", wave: 3, brief: "멧돼지 — 3/4 정면, 어깨가 높고 머리가 크다, 흑갈색 거친 털과 짧은 엄니.", blurb: "땅을 코로 갈아엎는다. 지나간 자리는 밭을 간 것처럼 보인다." },
  { id: "animal-raccoondog", kind: "animal", nameKo: "너구리", nameEn: "Raccoon dog", biomes: ["forest", "pond"], habitat: "ground", months: MONTHS_ALL, bands: NIGHT, tier: "rare", sizeCm: [50, 70], view: "upright", wave: 2, brief: "너구리 — 3/4 정면, 눈가의 검은 무늬, 통통한 몸에 짧은 다리와 굵은 꼬리.", blurb: "눈가가 검어서 밤에도 표정이 보인다. 물가에서 먹이를 씻는 시늉을 한다." },
  { id: "animal-badger", kind: "animal", nameKo: "오소리", nameEn: "Badger", biomes: ["forest"], habitat: "ground", months: m(3, 11), bands: NIGHT, tier: "epic", sizeCm: [60, 80], view: "upright", wave: 3, brief: "오소리 — 3/4 정면, 낮고 굵은 몸, 얼굴에 세로 흰 줄 두 개, 앞발톱이 길다.", blurb: "굴을 아주 깊이 판다. 겨울엔 그 굴에서 거의 나오지 않는다." },
  { id: "animal-weasel", kind: "animal", nameKo: "족제비", nameEn: "Weasel", biomes: ["valley", "forest"], habitat: "rock", months: MONTHS_ALL, bands: TWILIGHT, tier: "rare", sizeCm: [30, 40], view: "upright", wave: 2, brief: "족제비 — 3/4 정면, 몸이 아주 길고 다리가 짧다, 황갈색에 꼬리가 굵다.", blurb: "돌 틈으로 흘러들듯 사라진다. 있었다는 걸 나중에 안다." },
  { id: "animal-otter", kind: "animal", nameKo: "수달", nameEn: "Eurasian otter", biomes: ["valley", "pond"], habitat: "shore", months: MONTHS_ALL, bands: TWILIGHT, tier: "legend", sizeCm: [60, 80], view: "upright", wave: 1, brief: "수달 — 3/4 정면, 물에 젖어 매끈한 갈색 몸, 짧은 다리와 굵고 긴 꼬리, 수염이 뻣뻣하다.", blurb: "천연기념물. 물가에 돌을 쌓아 놓고 그 위에서 물고기를 먹는다." },
  { id: "animal-mole", kind: "animal", nameKo: "두더지", nameEn: "Mole", biomes: ["meadow", "hill"], habitat: "ground", months: m(3, 11), bands: BANDS_ALL, tier: "rare", sizeCm: [12, 18], view: "upright", wave: 2, brief: "두더지 — 3/4 정면, 흙더미에서 코만 내민 자세. 벨벳 같은 검은 털, 앞발이 삽처럼 넓다.", blurb: "흙더미는 늘 보이는데 정작 본 사람은 드물다. 눈이 거의 퇴화했다." },
  { id: "animal-fieldmouse", kind: "animal", nameKo: "등줄쥐", nameEn: "Striped field mouse", biomes: ["meadow", "hill"], habitat: "ground", months: MONTHS_ALL, bands: NIGHT, tier: "common", sizeCm: [8, 12], view: "upright", wave: 2, brief: "등줄쥐 — 3/4 정면, 등 가운데 검은 줄 한 줄, 갈색 몸에 둥근 귀와 긴 꼬리.", blurb: "등에 줄이 하나 있어 등줄쥐. 풀밭에 길을 내고 그 길로만 다닌다." },
  { id: "animal-hedgehog", kind: "animal", nameKo: "고슴도치", nameEn: "Hedgehog", biomes: ["forest"], habitat: "ground", months: m(4, 10), bands: NIGHT, tier: "rare", sizeCm: [20, 25], view: "upright", variants: 2, wave: 3, brief: "고슴도치 — 3/4 정면, 갈색·크림 두 톤의 가시, 코가 뾰족하다. 두 번째 변형은 몸을 만 상태.", blurb: "놀라면 공처럼 만다. 한참 뒤에 코부터 슬그머니 나온다." },
  { id: "animal-fox", kind: "animal", nameKo: "붉은여우", nameEn: "Red fox", biomes: ["mountain"], habitat: "ground", months: m(11, 3), bands: NIGHT, tier: "legend", sizeCm: [60, 90], view: "upright", wave: 2, brief: "붉은여우 — 3/4 정면, 채도 낮은 적갈색(선명한 주황 금지), 흰 가슴과 목, 꼬리 끝이 희고 아주 굵다.", blurb: "이 땅에서 거의 사라졌다가 산에 다시 풀렸다. 눈 위 발자국이 일직선이다." },
  { id: "animal-leopardcat", kind: "animal", nameKo: "삵", nameEn: "Leopard cat", biomes: ["mountain", "forest"], habitat: "rock", months: MONTHS_ALL, bands: NIGHT, tier: "legend", sizeCm: [50, 70], view: "upright", wave: 3, brief: "삵 — 3/4 정면, 고양이보다 크고 다리가 길다. 회갈색에 검은 반점, 이마에서 정수리로 흰 줄 두 개.", blurb: "우리 산에 남은 유일한 야생 고양이. 이마의 흰 줄로 집고양이와 구별한다." },
  { id: "animal-bat", kind: "animal", nameKo: "관박쥐", nameEn: "Horseshoe bat", biomes: ["mountain", "valley"], habitat: "air", months: m(4, 10), bands: ["evening", "night"], tier: "rare", sizeCm: [6, 9], view: "shadow", wave: 3, brief: "박쥐의 비행 실루엣(위에서, 단색) — 날개가 손가락처럼 갈라진 막, 꼬리막이 다리 사이에 있다.", blurb: "소리로 본다. 어둠 속에서 나방 한 마리를 정확히 잡아챈다." },
  { id: "animal-mallard", kind: "animal", nameKo: "청둥오리", nameEn: "Mallard", biomes: ["pond"], habitat: "surface", months: MONTHS_ALL, bands: BANDS_ALL, tier: "common", sizeCm: [50, 65], view: "upright", variants: 2, wave: 1, live: true, brief: "청둥오리 — 3/4 정면, 물에 앉은 자세(발은 보이지 않는다, 수면선은 엔진이 자른다). 수컷은 초록 머리·흰 목테·회갈색 몸, **두 번째 변형은 암컷**(전체 갈색 얼룩). 채도 낮게.", blurb: "물 위에 앉아 자면서도 한쪽 눈만 감는다. 뜬 눈 쪽 뇌는 깨어 있다." },
  { id: "animal-duckling", kind: "animal", nameKo: "새끼오리", nameEn: "Duckling", biomes: ["pond"], habitat: "surface", months: m(4, 7), bands: DAY, tier: "rare", sizeCm: [10, 15], view: "upright", wave: 2, brief: "새끼오리 한 마리(행렬은 엔진이 만든다) — 3/4 정면, 크림 노랑 솜털(채도 낮게)과 갈색 등, 부리가 짧다.", blurb: "처음 본 것을 어미로 안다. 그래서 줄이 흐트러지는 법이 없다." },
  { id: "animal-mandarinduck", kind: "animal", nameKo: "원앙", nameEn: "Mandarin duck", biomes: ["pond", "valley"], habitat: "surface", months: MONTHS_ALL, bands: DAY, tier: "rare", sizeCm: [40, 50], view: "upright", wave: 3, brief: "원앙 — 3/4 정면, 물 위 자세. 수컷의 주황 부채깃(채도 낮춘 황토로)과 흰 눈썹선, 남보라 머리.", blurb: "천연기념물. 나무 구멍에 둥지를 틀어 새끼가 뛰어내려 물로 간다." },
  { id: "animal-heron", kind: "animal", nameKo: "왜가리", nameEn: "Grey heron", biomes: ["pond", "tidal"], habitat: "shore", months: MONTHS_ALL, bands: DAY, tier: "uncommon", sizeCm: [90, 100], view: "upright", variants: 2, wave: 1, brief: "왜가리 — 3/4 정면, 물가에 **한 다리로 선 자세**. 회색 몸, 흰 머리에 검은 눈썹 깃, 목이 S자로 접힌다. 두 번째 변형은 목을 편 자세.", blurb: "몇 분이고 미동도 없다. 그러다 한 번에 목을 편다." },
  { id: "animal-egret", kind: "animal", nameKo: "중대백로", nameEn: "Great egret", biomes: ["pond", "tidal"], habitat: "shore", months: m(4, 10), bands: DAY, tier: "uncommon", sizeCm: [85, 100], view: "upright", wave: 2, brief: "중대백로 — 3/4 정면, 왜가리와 같은 자세이되 온몸이 흰색(#f6f8fb)에 부리가 노랗다.", blurb: "논이든 갯벌이든 흰 것이 서 있으면 대개 이 새다." },
  { id: "animal-kingfisher", kind: "animal", nameKo: "물총새", nameEn: "Kingfisher", biomes: ["valley", "pond"], habitat: "shore", months: m(4, 9), bands: DAY, tier: "rare", sizeCm: [15, 18], view: "upright", wave: 1, brief: "물총새 — 3/4 정면, 가지에 앉은 자세. 등은 청록, 배는 주황빛 황토(채도 낮게), 부리가 몸에 비해 아주 길고 곧다.", blurb: "물가의 파란 화살. 앉아 있다가 수직으로 떨어져 물속에서 나온다." },
  { id: "animal-goose", kind: "animal", nameKo: "기러기", nameEn: "Wild goose", biomes: ["meadow", "hill", "pond"], habitat: "sky", months: m(10, 3), bands: ["dusk", "evening", "dawn"], tier: "uncommon", sizeCm: [70, 90], view: "shadow", wave: 1, brief: "기러기 한 마리의 비행 실루엣(위에서, 단색) — 목을 앞으로 곧게 빼고 날개를 넓게 편다(편대는 엔진이 만든다).", blurb: "V자로 난다. 앞선 새가 힘들면 뒤로 가고 다른 새가 앞에 선다." },
  { id: "animal-sparrow", kind: "animal", nameKo: "참새", nameEn: "Tree sparrow", biomes: ["meadow", "forest", "hill"], habitat: "ground", months: MONTHS_ALL, bands: DAY, tier: "common", sizeCm: [12, 15], view: "upright", variants: 2, wave: 1, brief: "참새 — 3/4 정면. 갈색 등에 검은 줄, 흰 뺨에 검은 점, 배는 옅은 회백. 두 번째 변형은 **겨울에 부푼 자세**(둥글게).", blurb: "겨울엔 두 배로 부푼다. 깃 사이에 공기를 넣어 껴입는 것." },
  { id: "animal-magpie", kind: "animal", nameKo: "까치", nameEn: "Magpie", biomes: ["meadow", "forest"], habitat: "tree", months: MONTHS_ALL, bands: DAY, tier: "common", sizeCm: [45, 50], view: "upright", wave: 1, brief: "까치 — 3/4 정면, 검정·흰색 두 톤에 날개·꼬리에 남보라 광택, 꼬리가 몸만큼 길다.", blurb: "거울 속 자기를 알아보는 몇 안 되는 새. 둥지를 몇 해씩 고쳐 쓴다." },
  { id: "animal-crow", kind: "animal", nameKo: "큰부리까마귀", nameEn: "Jungle crow", biomes: ["mountain", "forest"], habitat: "tree", months: MONTHS_ALL, bands: DAY, tier: "uncommon", sizeCm: [50, 57], view: "upright", wave: 2, brief: "큰부리까마귀 — 3/4 정면, 온몸 검정에 남색 광택, 부리가 굵고 이마가 불룩하다.", blurb: "도구를 만들어 쓴다. 사람 얼굴을 몇 해씩 기억한다고 한다." },
  { id: "animal-woodpecker", kind: "animal", nameKo: "오색딱따구리", nameEn: "Great spotted woodpecker", biomes: ["forest"], habitat: "tree", months: MONTHS_ALL, bands: DAY, tier: "rare", sizeCm: [22, 25], view: "upright", wave: 2, brief: "오색딱따구리 — 3/4 정면, **나무줄기에 세로로 붙은 자세**. 검정·흰 얼룩 등, 배 아래와 뒤통수가 벽돌빨강(채도 낮게).", blurb: "1초에 스무 번 쫀다. 그러고도 머리가 안 아픈 구조로 되어 있다." },
  { id: "animal-owl", kind: "animal", nameKo: "수리부엉이", nameEn: "Eagle owl", biomes: ["forest", "mountain"], habitat: "tree", months: MONTHS_ALL, bands: ["evening", "night"], tier: "epic", sizeCm: [60, 75], view: "upright", wave: 1, brief: "수리부엉이 — 3/4 정면, 가지에 앉은 자세. 갈색 얼룩 깃, 귀처럼 선 깃털 두 개, 눈이 크고 주황빛(채도 낮게).", blurb: "날개 깃 가장자리가 톱니라 소리가 나지 않는다. 지나간 뒤에야 안다." },
  { id: "animal-pheasant", kind: "animal", nameKo: "꿩", nameEn: "Ring-necked pheasant", biomes: ["hill", "mountain"], habitat: "ground", months: MONTHS_ALL, bands: DAY, tier: "uncommon", sizeCm: [60, 80], view: "upright", variants: 2, wave: 1, brief: "꿩 — 3/4 정면. 수컷(장끼)은 청록 머리·흰 목테·황토 몸에 아주 긴 꼬리, **두 번째 변형은 암컷(까투리)**으로 전체 갈색 얼룩에 꼬리가 짧다.", blurb: "놀라면 요란하게 날아오른다. 그 소리에 사람이 더 놀란다." },
  { id: "animal-skylark", kind: "animal", nameKo: "종다리", nameEn: "Skylark", biomes: ["hill", "meadow"], habitat: "sky", months: m(3, 7), bands: DAY, tier: "uncommon", sizeCm: [16, 18], view: "upright", wave: 3, brief: "종다리 — 3/4 정면, 갈색 얼룩 몸에 머리깃이 살짝 섰다, 다리가 길다.", blurb: "하늘 높이 떠서 계속 운다. 소리는 들리는데 점이 보일락 말락 하다." },
  { id: "animal-swallow", kind: "animal", nameKo: "제비", nameEn: "Barn swallow", biomes: ["meadow", "hill"], habitat: "air", months: m(4, 9), bands: DAY, tier: "uncommon", sizeCm: [17, 19], view: "shadow", wave: 2, brief: "제비의 비행 실루엣(위에서, 단색) — 날개가 낫처럼 뒤로 굽고 꼬리가 깊게 갈라진 두 갈래.", blurb: "돌아오면 봄이다. 낮게 날면 비가 온다고들 한다." },
  { id: "animal-gull", kind: "animal", nameKo: "괭이갈매기", nameEn: "Black-tailed gull", biomes: ["sandy", "rocky", "tidal"], habitat: "shore", months: MONTHS_ALL, bands: DAY, tier: "common", sizeCm: [45, 50], view: "upright", variants: 2, wave: 1, brief: "괭이갈매기 — 3/4 정면. 흰 몸에 회색 등, 노란 부리 끝에 붉은·검은 띠, 꼬리에 검은 띠. 두 번째 변형은 날개를 편 자세.", blurb: "고양이 소리로 운다. 그래서 괭이갈매기." },
  { id: "animal-cormorant", kind: "animal", nameKo: "가마우지", nameEn: "Cormorant", biomes: ["rocky"], habitat: "rock", months: MONTHS_ALL, bands: DAY, tier: "uncommon", sizeCm: [80, 90], view: "upright", wave: 2, brief: "가마우지 — 3/4 정면, 바위에 서서 **날개를 펴 말리는 자세**. 검은 몸에 청동 광택, 목이 길고 부리 끝이 갈고리.", blurb: "깃에 기름이 적어 젖는다. 그래서 물에서 나오면 날개를 펴고 말린다." },
  { id: "animal-sandpiper", kind: "animal", nameKo: "도요새", nameEn: "Sandpiper", biomes: ["tidal", "sandy"], habitat: "mud", months: [3, 4, 5, 8, 9, 10], bands: DAY, tier: "uncommon", sizeCm: [20, 30], view: "upright", variants: 2, wave: 1, brief: "도요새 — 3/4 정면, 뻘에 부리를 꽂은 자세. 갈색 얼룩 몸에 다리와 부리가 길다. 두 번째 변형은 고개를 든 자세.", blurb: "봄가을에만 들른다. 시베리아와 호주 사이를 오가는 길에 잠깐." },
  { id: "animal-spoonbill", kind: "animal", nameKo: "저어새", nameEn: "Black-faced spoonbill", biomes: ["tidal"], habitat: "mud", months: m(4, 10), bands: DAY, tier: "legend", sizeCm: [70, 80], view: "upright", wave: 3, brief: "저어새 — 3/4 정면, 흰 몸에 검은 얼굴, **부리 끝이 주걱처럼 넓적하다**. 물에 부리를 담그고 좌우로 젓는 자세.", blurb: "전 세계에 몇 천 마리뿐이다. 부리를 좌우로 저어 먹이를 찾는다." },
  { id: "animal-seal", kind: "animal", nameKo: "점박이물범", nameEn: "Spotted seal", biomes: ["rocky"], habitat: "rock", months: m(11, 3), bands: DAY, tier: "epic", sizeCm: [140, 170], view: "upright", wave: 3, brief: "점박이물범 — 3/4 정면, 바위에 배를 대고 고개만 든 자세. 회색 몸에 검은 점, 앞지느러미가 짧다.", blurb: "바위에 올라 해를 쬔다. 몸을 바나나처럼 굽히고 있으면 편한 것." },
  { id: "animal-porpoise", kind: "animal", nameKo: "상괭이", nameEn: "Finless porpoise", biomes: ["sea"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "epic", sizeCm: [150, 190], view: "shadow", wave: 2, brief: "상괭이의 실루엣(위에서, 단색) — **등지느러미가 없는** 매끈한 몸, 머리가 둥글다.", blurb: "웃는 얼굴을 한 우리 바다의 돌고래. 등지느러미가 없어 멀리서도 안다." },
  { id: "animal-minkewhale", kind: "animal", nameKo: "밍크고래", nameEn: "Minke whale", biomes: ["sea"], habitat: "water", months: MONTHS_ALL, bands: BANDS_ALL, tier: "legend", sizeCm: [700, 900], view: "shadow", wave: 3, brief: "밍크고래의 큰 실루엣(위에서, 단색) — 뾰족한 주둥이, 가슴지느러미에 흰 띠, 등지느러미가 몸 뒤쪽에 작게.", blurb: "숨을 쉬러 올라올 때 물기둥이 먼저 보인다." },
  { id: "animal-turtle-sea", kind: "animal", nameKo: "붉은바다거북", nameEn: "Loggerhead turtle", biomes: ["sea", "sandy"], habitat: "water", months: m(6, 9), bands: BANDS_ALL, tier: "epic", sizeCm: [80, 110], view: "shadow", wave: 3, brief: "붉은바다거북의 실루엣(위에서, 단색) — 하트에 가까운 등딱지와 노처럼 긴 앞지느러미 둘.", blurb: "태어난 모래밭을 기억했다가 몇십 년 뒤에 알을 낳으러 돌아온다." },
  { id: "animal-fiddlercrab", kind: "animal", nameKo: "농게", nameEn: "Fiddler crab", biomes: ["tidal"], habitat: "mud", months: m(5, 9), bands: DAY, tier: "uncommon", sizeCm: [2, 4], view: "topdown", variants: 2, wave: 1, brief: "위에서 본 농게 — 네모난 등딱지, **한쪽 집게만 몸만큼 크다**(두 번째 변형은 반대쪽이 큰 개체). 등은 남보라·황토.", blurb: "큰 집게를 흔들어 짝을 부른다. 그 집게로는 먹지 못한다." },
  { id: "animal-mudcrab", kind: "animal", nameKo: "칠게", nameEn: "Mud crab", biomes: ["tidal"], habitat: "mud", months: m(4, 10), bands: DAY, tier: "common", sizeCm: [2, 3], view: "topdown", variants: 2, wave: 1, brief: "위에서 본 칠게 — 작고 넓적한 회갈색 등딱지, 집게 둘이 같은 크기, 눈자루가 섰다.", blurb: "썰물이면 뻘이 통째로 움직이는 것처럼 보인다. 전부 이 게다." },
  { id: "animal-hermitcrab", kind: "animal", nameKo: "소라게", nameEn: "Hermit crab", biomes: ["sandy", "rocky"], habitat: "shore", months: MONTHS_ALL, bands: BANDS_ALL, tier: "common", sizeCm: [2, 5], view: "topdown", variants: 2, wave: 2, brief: "위에서 본 소라게 — 나선 껍데기 밖으로 집게와 다리가 나왔다(변형 둘은 껍데기 모양이 다르다).", blurb: "몸이 자라면 이사한다. 빈 껍데기 앞에 여럿이 줄을 서기도 한다." },
  { id: "animal-starfish", kind: "animal", nameKo: "불가사리", nameEn: "Starfish", biomes: ["rocky", "tidal"], habitat: "rock", months: MONTHS_ALL, bands: BANDS_ALL, tier: "common", sizeCm: [10, 20], view: "topdown", variants: 2, wave: 2, brief: "위에서 본 불가사리 — 팔 다섯, 표면에 오톨도톨한 돌기. 채도 낮은 벽돌빛과 남보라 두 변형.", blurb: "팔이 떨어져도 다시 자란다. 떨어진 팔 쪽이 살아나기도 한다." },
  { id: "animal-anemone", kind: "animal", nameKo: "말미잘", nameEn: "Sea anemone", biomes: ["rocky"], habitat: "rock", months: MONTHS_ALL, bands: BANDS_ALL, tier: "common", sizeCm: [5, 15], view: "topdown", variants: 2, wave: 2, brief: "위에서 본 말미잘 — 촉수가 방사형으로 벌어진 것과 오므린 것 두 변형. 채도 낮은 자주·크림.", blurb: "물이 빠지면 오므려 물을 머금는다. 다시 잠기면 천천히 편다." },
  { id: "animal-treefrog", kind: "animal", nameKo: "청개구리", nameEn: "Tree frog", biomes: ["pond", "meadow"], habitat: "shore", months: m(4, 9), bands: NIGHT, weather: ["rain", "cloud", "clear"], tier: "uncommon", sizeCm: [3, 4], view: "upright", wave: 1, brief: "청개구리 — 3/4 정면, 앉은 자세. 연초록 몸에 발끝이 둥근 흡반, 눈 뒤로 갈색 줄.", blurb: "비가 오려 하면 운다. 발끝의 빨판으로 잎에 붙어 있다." },
  { id: "animal-toad", kind: "animal", nameKo: "두꺼비", nameEn: "Toad", biomes: ["forest", "valley"], habitat: "ground", months: m(3, 5), bands: NIGHT, afterRain: true, tier: "rare", sizeCm: [8, 12], view: "upright", wave: 3, brief: "두꺼비 — 3/4 정면, 낮고 넓적한 몸, 등이 오톨도톨하고 눈 뒤에 독샘이 부풀었다. 흙빛 갈색.", blurb: "봄비 오는 밤에 산에서 물가로 내려온다. 그 밤에만 길에 가득하다." },
  { id: "animal-salamander", kind: "animal", nameKo: "도롱뇽", nameEn: "Salamander", biomes: ["valley"], habitat: "water", months: m(3, 5), bands: BANDS_ALL, tier: "rare", sizeCm: [8, 12], view: "topdown", wave: 3, brief: "위에서 본 도롱뇽 — 매끈한 흑갈색 몸에 짧은 다리 넷과 긴 꼬리, 등에 옅은 얼룩.", blurb: "이른 봄 계곡의 돌 밑에 도넛 같은 알집을 붙여 놓는다." },
  { id: "animal-softshell", kind: "animal", nameKo: "자라", nameEn: "Softshell turtle", biomes: ["pond"], habitat: "water", months: m(5, 9), bands: DAY, tier: "rare", sizeCm: [20, 35], view: "shadow", wave: 3, brief: "위에서 본 자라의 실루엣 — 납작하고 둥근 등딱지(가장자리가 부드럽다), 목과 주둥이가 길게 나왔다.", blurb: "딱딱한 등딱지가 없다. 대신 아주 빠르고 목이 길게 늘어난다." },
  { id: "animal-terrapin", kind: "animal", nameKo: "남생이", nameEn: "Korean pond turtle", biomes: ["pond"], habitat: "shore", months: m(5, 9), bands: DAY, tier: "epic", sizeCm: [20, 25], view: "upright", wave: 3, brief: "남생이 — 3/4 정면, 통나무 위에 올라 목을 뺀 자세. 등딱지에 세 줄 융기, 머리에 노란 줄무늬.", blurb: "우리 토종 민물거북. 볕이 좋으면 통나무 위에 줄지어 올라온다." },
  { id: "animal-ratsnake", kind: "animal", nameKo: "누룩뱀", nameEn: "Rat snake", biomes: ["meadow", "hill", "forest"], habitat: "ground", months: m(5, 9), bands: DAY, tier: "rare", sizeCm: [80, 130], view: "topdown", wave: 3, brief: "위에서 본 누룩뱀 — 몸을 S자로 굽힌 자세, 황갈색 바탕에 짙은 사다리꼴 무늬가 등을 따라 이어진다.", blurb: "독이 없다. 사람을 먼저 피하고, 피할 길이 없을 때만 꼬리를 떤다." }
];

export const CODEX: readonly CodexEntry[] = [...FISH, ...BUGS, ...ANIMALS];

export const codexById = (id: string): CodexEntry | undefined => CODEX.find((e) => e.id === id);
export const codexOf = (kind: CodexKind): CodexEntry[] => CODEX.filter((e) => e.kind === kind);
export const codexOfBiome = (b: BiomeKey): CodexEntry[] => CODEX.filter((e) => e.biomes.includes(b));

/** 지금 이 자리·이 때에 나올 수 있는가 — 스폰 풀과 도감의 "지금 만날 수 있어요" 표시가 같은 판정을 쓴다. */
export function codexAvailable(
  e: CodexEntry,
  ctx: { biome: BiomeKey; month: number; band: DayBand; weather: Weather; prevWeather?: Weather }
): boolean {
  if (!e.biomes.includes(ctx.biome)) return false;
  if (!e.months.includes(ctx.month)) return false;
  if (!e.bands.includes(ctx.band)) return false;
  if (e.weather && !e.weather.includes(ctx.weather)) return false;
  // 비 온 뒤에만 나오는 것 — 지금 비가 그쳤고 직전 마디가 비였을 때.
  if (e.afterRain && !(ctx.weather !== "rain" && ctx.prevWeather === "rain")) return false;
  return true;
}

/** 도감 진행률 — 구현된 종만 센다(그리지도 않은 종을 0%로 세면 영원히 안 차는 막대가 된다). */
export const codexCountable = (e: CodexEntry): boolean => !!e.live;
