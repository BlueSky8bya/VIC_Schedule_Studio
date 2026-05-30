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

export type BroadcastTag = {
  id: string;
  tagKey: string;
  displayName: string;
  colorKey: ColorKey;
  sortOrder: number;
  isDefault: boolean;
  isActive: boolean;
};

export type PublicScheduleEvent = {
  id: string;
  startsAt: string;
  endsAt?: string;
  endDateKey?: string; // 멀티데이 일정의 종료일(YYYY-MM-DD). 없으면 단일 날짜.
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
  { key: "heart", label: "하트", defaultColor: "#ff6b9d" },
  { key: "star", label: "별", defaultColor: "#ffce3a" },
  { key: "sparkle", label: "반짝", defaultColor: "#ffe169" },
  { key: "bubble", label: "말풍선", defaultColor: "#a9def9" },
  { key: "ribbon", label: "리본", defaultColor: "#ff9a8b" },
  { key: "arrow", label: "화살표", defaultColor: "#8b7cf0" },
  { key: "circle", label: "동그라미", defaultColor: "#ffd1e8" },
  { key: "tape", label: "테이프", defaultColor: "#c9b6ff" }
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
