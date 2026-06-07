export const PRODUCT_TIMEZONE = "Asia/Seoul" as const;

// "developer"는 플랫폼 레벨 슈퍼관리자(시스템 유지보수자)로, "owner"(스트리머)와 구분된다.
// 개발자는 모든 캘린더를 읽고/편집할 수 있지만, 공개 API 출력은 동일하게 유지되고
// 비공개 레이어 읽기에는 여전히 잠금해제 세션이 필요하다.
export type MembershipRole = "developer" | "owner" | "manager" | "worker" | "viewer";

export type EventStatus = "draft" | "scheduled" | "live" | "done" | "cancelled";

export type EventVisibilityScope = "public" | "embargo" | "work" | "owner_private";

export type EventCategory = "stream" | "collab" | "notice" | "support" | "dayoff";

export type VariantPromotionState = "draft" | "active" | "promoted" | "archived";

// 팔레트 색 키. 기본 13색(gray·lavender·blue·pink·mint·yellow·orange·beige·sky·lime·red·indigo·teal)에
// 더해, 태그 추가 시 동적으로 생성되는 색(gen-XXXX)도 있으므로 string으로 둔다.
export type ColorKey = string;

export type ColorPaletteEntry = {
  key: ColorKey;
  name: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  sortOrder: number;
};

// 태그 축: content = 콘텐츠(셀 색·컨텐츠 통계 차지), modifier = 수식어(합방/시참/대회/짧뱅/풀트/구플 —
// 셀 색은 점으로만, 컨텐츠 순위서 제외, 피커 별칸). docs/tag-taxonomy-classification.md 참고.
export type TagKind = "content" | "modifier";

export type BroadcastTag = {
  id: string;
  tagKey: string;
  displayName: string;
  colorKey: ColorKey;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
  // 2계층 태그: null = 대분류(색 보유), 값 = 세부(부모 id, 렌더 색은 최상위 대분류 색 상속).
  parentId: string | null;
  kind: TagKind;
  // 단계 배포: true면 분류 v3에서 새로 생긴 태그(레거시 뷰에서 숨김). 기본 false.
  v3Only?: boolean;
};

export type PublicScheduleEvent = {
  id: string;
  startsAt: string;
  endsAt?: string;
  endDateKey?: string; // 멀티데이 일정의 종료일(YYYY-MM-DD). 없으면 단일 날짜.
  isTentative?: boolean; // 아직 확정 아님(미정) — 공개해도 안전한 상태값. 카드에 점선+'미정' 표시.
  linkNext?: string; // 다음날 일정 id. 인접 쌍을 이으면 연속 막대로 그려진다.
  isSupport?: boolean; // 업 도움 기간이면 true
  supportUrl?: string; // 업 도움 링크(숲 게시글)
  isAllDay: boolean;
  publicTitle: string;
  publicDescription?: string;
  status: Exclude<EventStatus, "draft">;
  visibilityScope: "public";
  category: EventCategory;
  tagIds: string[];
  primaryTagIds: string[];
  sortOrder: number;
  variantGroupId?: string;
  variantLabel?: string;
  heartCount?: number; // A: 일정별 관심(하트) 집계 수. 숫자 자체는 노출하지 않고 "관심 높음" 판정에만 쓴다.
  // 떡밥(가림): 공개 시각 전엔 제목·태그를 숨기고 전용 룩 + 카운트다운만 보인다. 공개 시각이 지나면
  // 실제 내용이 보인다. 공개 DTO에는 가려진 동안에만 teaser=true가 실리고, 실제 제목/태그는 서버에서
  // 빠진다(공개 전 유출 방지). 공개 후엔 평범한 일정으로 내려온다.
  teaser?: boolean;
  teaserRevealAt?: string; // 공개 시각(ISO·UTC). teaser=true일 때만.
};

export type PrivateEventMeta = {
  eventId: string;
  privateTitle?: string;
  privateMemo?: string;
  editorNote?: string;
};

export type StudioScheduleEvent = Omit<PublicScheduleEvent, "status" | "visibilityScope"> & {
  status: EventStatus;
  visibilityScope: EventVisibilityScope;
  privateMeta?: PrivateEventMeta;
};

export type VariantGroup = {
  id: string;
  name: string;
  promotionState: VariantPromotionState;
  promotedEventId?: string;
};

export type Proposal = {
  id: string;
  type: "slot" | "content" | "collab";
  content: string;
  voteCount: number;
  state: "new" | "reviewing" | "accepted" | "rejected";
  suggestedDate?: string;
};

export type RequestItem = {
  id: string;
  source: "collab" | "sponsor" | "guest" | "manual";
  title: string;
  state: "new" | "triaged" | "scheduled" | "closed";
  receivedAt: string;
  summary: string;
};

export type SupportCampaign = {
  id: string;
  title: string;
  description: string;
  label: string;
  url: string;
  startsOn: string;
  endsOn: string;
  highlightColorKey: ColorKey;
  isPublic: boolean;
  isActive: boolean;
};

// 업로드한 커스텀 이모지(이미지 에셋). 캘린더 단위로 공유된다.
export type StickerAsset = {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
};

// 꾸미기 화려함 P1: 스티커 애니메이션 프리셋(라이브 포스터에서 실제로 움직임. 내보내기는 정지 프레임).
export type StickerAnim = "float" | "twinkle" | "jiggle" | "spin" | "pulse";
export const STICKER_ANIMS: { key: StickerAnim; label: string }[] = [
  { key: "float", label: "둥실" },
  { key: "twinkle", label: "반짝" },
  { key: "jiggle", label: "흔들" },
  { key: "spin", label: "빙글" },
  { key: "pulse", label: "콩닥" }
];

// 텍스트 스티커 특수 효과(P1b): 네온 글로우. (그라데 옵션은 사용자 요청으로 제거 —
// 타입에는 "gradient"를 남겨 이미 저장된 데이터의 렌더는 계속 동작하지만 피커엔 안 보임.)
export type TextFx = "gradient" | "neon";
export const STICKER_TEXT_FX: { key: TextFx; label: string }[] = [
  { key: "neon", label: "네온" }
];

// 데코 도형 프리셋(P2). 렌더(SVG)는 components/poster/sticker-shapes.tsx, 데이터는 여기(서버 검증 공용).
export type ShapePreset = { key: string; label: string; defaultColor: string };
export const STICKER_SHAPES: ShapePreset[] = [
  // 하트·별·반짝
  { key: "heart", label: "하트", defaultColor: "#ff6b9d" },
  { key: "star", label: "별", defaultColor: "#ffce3a" },
  { key: "star4", label: "네모별", defaultColor: "#ffd23f" },
  { key: "star6", label: "육각별", defaultColor: "#ffc8dd" },
  { key: "star8", label: "팔각별", defaultColor: "#bdb2ff" },
  { key: "star12", label: "폭죽별", defaultColor: "#ff8fab" },
  { key: "sparkle", label: "반짝", defaultColor: "#ffe169" },
  { key: "burst", label: "폭발", defaultColor: "#ff8a5c" },
  // 기하 도형
  { key: "circle", label: "동그라미", defaultColor: "#ffd1e8" },
  { key: "oval", label: "타원", defaultColor: "#ffc8dd" },
  { key: "square", label: "사각형", defaultColor: "#a0c4ff" },
  { key: "triangle", label: "삼각형", defaultColor: "#ffb3c1" },
  { key: "diamond", label: "다이아", defaultColor: "#9ad0ec" },
  { key: "pentagon", label: "오각형", defaultColor: "#9bf6ff" },
  { key: "hexagon", label: "육각형", defaultColor: "#bdb2ff" },
  { key: "heptagon", label: "칠각형", defaultColor: "#a3c4f3" },
  { key: "octagon", label: "팔각형", defaultColor: "#90dbf4" },
  { key: "trapezoid", label: "사다리꼴", defaultColor: "#cdb4db" },
  { key: "parallelogram", label: "평행사변형", defaultColor: "#b8c0ff" },
  { key: "semicircle", label: "반원", defaultColor: "#ffd6a5" },
  { key: "ring", label: "링", defaultColor: "#8b7cf0" },
  // 화살표·기호
  { key: "arrow", label: "오른쪽화살표", defaultColor: "#8b7cf0" },
  { key: "arrowleft", label: "왼쪽화살표", defaultColor: "#8b7cf0" },
  { key: "arrowup", label: "위쪽화살표", defaultColor: "#8b7cf0" },
  { key: "arrowdown", label: "아래쪽화살표", defaultColor: "#8b7cf0" },
  { key: "chevron", label: "꺾쇠", defaultColor: "#a78bfa" },
  { key: "check", label: "체크", defaultColor: "#52b788" },
  { key: "xmark", label: "엑스", defaultColor: "#ff6b6b" },
  { key: "cross", label: "십자", defaultColor: "#90be6d" },
  // 사물
  { key: "crown", label: "왕관", defaultColor: "#ffd23f" },
  { key: "gem", label: "보석", defaultColor: "#7ad7f0" },
  { key: "shield", label: "방패", defaultColor: "#8ecae6" },
  { key: "bell", label: "종", defaultColor: "#ffca3a" },
  { key: "gift", label: "선물", defaultColor: "#ff8fab" },
  { key: "balloon", label: "풍선", defaultColor: "#ff99c8" },
  { key: "bulb", label: "전구", defaultColor: "#ffe169" },
  { key: "bookmark", label: "책갈피", defaultColor: "#f4978e" },
  { key: "tag", label: "태그", defaultColor: "#ffafcc" },
  { key: "pin", label: "핀", defaultColor: "#ff7a90" },
  { key: "ribbon", label: "리본", defaultColor: "#ff9a8b" },
  { key: "tape", label: "테이프", defaultColor: "#c9b6ff" },
  { key: "bubble", label: "말풍선", defaultColor: "#a9def9" },
  // 자연·날씨
  { key: "flower", label: "꽃", defaultColor: "#ffc2d1" },
  { key: "leaf", label: "잎", defaultColor: "#52b788" },
  { key: "mushroom", label: "버섯", defaultColor: "#ff8fa3" },
  { key: "cloud", label: "구름", defaultColor: "#cfe3ff" },
  { key: "moon", label: "달", defaultColor: "#ffe08a" },
  { key: "sun", label: "해", defaultColor: "#ffd23f" },
  { key: "lightning", label: "번개", defaultColor: "#ffd23f" },
  { key: "droplet", label: "물방울", defaultColor: "#8fd3f5" },
  { key: "flame", label: "불꽃", defaultColor: "#ff7a45" },
  { key: "ghost", label: "유령", defaultColor: "#cdb4db" },
  { key: "paw", label: "발바닥", defaultColor: "#f4a261" },
  { key: "flag", label: "깃발", defaultColor: "#ff7a90" }
];
export const SHAPE_KEYS = new Set<string>(STICKER_SHAPES.map((s) => s.key));
export function shapeDefaultColor(shapeKey: string | undefined): string {
  return STICKER_SHAPES.find((s) => s.key === shapeKey)?.defaultColor ?? "#ff6b9d";
}

export type StickerInstance = {
  id: string;
  kind: "emoji" | "image" | "text" | "shape"; // emoji=기본 이모지, image=커스텀 이모지, text=텍스트, shape=데코 도형
  label: string; // emoji면 이모지 문자, image면 에셋 이름, text면 표시 문구, shape면 도형 키
  imageUrl?: string; // kind=image일 때 그릴 이미지 URL
  assetId?: string; // kind=image일 때 sticker_assets 참조
  shapeKey?: string; // kind=shape일 때 도형 프리셋 키(색은 textColor를 fill로 재사용)
  textColor?: string; // kind=text일 때 글자색(hex)
  fontWeight?: number; // kind=text일 때 글꼴 굵기(400/700/900)
  fontFamily?: string; // kind=text일 때 글꼴 종류 키
  textAlign?: "left" | "center" | "right"; // kind=text일 때 정렬
  textBg?: string; // kind=text일 때 글자 배경(하이라이트) 색, 없으면 미적용
  textFx?: TextFx; // kind=text일 때 특수 효과(그라데이션/네온). 없으면 기본.
  italic?: boolean; // kind=text일 때 기울임
  outline?: boolean; // C7: 흰 외곽선(다이컷 스티커 느낌)
  shadow?: boolean; // C7: 진한 그림자
  year: number; // 스티커는 달(월)마다 따로 적용된다
  month: number;
  xRatio: number;
  yRatio: number;
  widthRatio: number;
  rotationDeg: number;
  flipX: boolean; // 좌우 대칭
  flipY: boolean; // 상하 대칭
  opacity: number;
  zIndex: number;
  anim?: StickerAnim; // 움직이는 스티커(라이브 전용). 없으면 정지.
  locked?: boolean; // P4: 잠금 — 선택은 되지만 이동/크기/회전 차단(실수 방지).
  visiblePublicly: boolean;
};

// C9/C10: 포스터 테마 팩(계절/배경). 미리 정의된 키만 허용한다.
export const POSTER_THEMES = [
  { key: "none", label: "기본" },
  { key: "sakura", label: "봄" },
  { key: "summer", label: "여름" },
  { key: "autumn", label: "가을" },
  { key: "winter", label: "겨울" },
  // P3: 더 화려한 배경(그라데이션/패턴). 텍스트 대비 위해 전부 밝게 유지.
  { key: "sunset", label: "노을" },
  { key: "mint", label: "민트" },
  { key: "dot", label: "도트" },
  { key: "starry", label: "별밤" },
  { key: "confetti", label: "꽃가루" }
] as const;
export type PosterThemeKey = (typeof POSTER_THEMES)[number]["key"];
export function isPosterThemeKey(value: string): value is PosterThemeKey {
  return POSTER_THEMES.some((theme) => theme.key === value);
}

// B: 메모 한 줄 — 줄마다 가로 정렬과 들여쓰기 단계를 따로 갖는다.
export type MemoLine = {
  text: string;
  align: "left" | "center" | "right";
  indent: number; // 0~4 단계, 단계당 일정 px 들여쓰기
};

export type CalendarMeta = {
  slug: string;
  displayName: string;
  title: string;
  timezone: typeof PRODUCT_TIMEZONE;
  defaultYear: number;
  defaultMonth: number;
  publicMemo: string;
  posterTheme: PosterThemeKey; // C9/C10: 적용된 포스터 테마
  memoAlign?: "left" | "center" | "right"; // #5: 메모 가로 정렬
  memoVAlign?: "top" | "center" | "bottom"; // #5: 메모 세로 위치
  memoLines?: MemoLine[]; // B: 줄별 정렬·들여쓰기. 있으면 이걸로 렌더, 없으면 publicMemo 줄바꿈 폴백
};

export type PublicSchedule = {
  calendar: CalendarMeta;
  events: PublicScheduleEvent[];
  tags: BroadcastTag[];
  palette: ColorPaletteEntry[];
  supportCampaigns: SupportCampaign[];
  stickers: StickerInstance[];
  stickerAssets: StickerAsset[]; // 업로드한 커스텀 이모지 목록(캘린더 공유)
  heartCount: number; // B2: 시청자 하트 누적 수(숫자는 노출하지 않고 비율 표시에만 사용)
  myHeartIds?: string[]; // A: 현재 로그인 사용자가 관심 표시한 일정 id 목록(본인 것만, 개인 상태 복원용)
};

export type StudioSchedule = Omit<PublicSchedule, "events" | "stickers"> & {
  viewerModePreview: PublicSchedule;
  events: StudioScheduleEvent[];
  variantGroups: VariantGroup[];
  proposals: Proposal[];
  requests: RequestItem[];
  stickers: StickerInstance[];
};
