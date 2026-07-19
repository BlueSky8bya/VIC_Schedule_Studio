import type {
  BroadcastTag,
  ColorPaletteEntry,
  PublicScheduleEvent,
  StudioScheduleEvent,
  TagKind
} from "@/lib/domain/schedule-types";
import { PRODUCT_TIMEZONE } from "@/lib/domain/schedule-types";
import { getDayMark, type DayMark } from "@/lib/calendar/holidays";
import type { CSSProperties } from "react";

export type MonthCell = {
  isoDate: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  weekday: number; // 0=일 ... 6=토
};

// KST 기준 오늘 날짜(YYYY-MM-DD)
export function getTodayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PRODUCT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export type DayState = {
  isToday: boolean;
  isPast: boolean;
  isSunday: boolean;
  isSaturday: boolean;
  isRed: boolean; // 일요일/공휴일/대체공휴일
  markName: string | null; // 공휴일/기념일/절기 표기(헤더 짧은 pill)
  markSub: string | null; // 월드컵 경기 대진·스코어(있으면 칸 본문 칩으로)
  markKind: DayMark["kind"]; // 월드컵 등 특별 표기 스타일 구분
};

export function classifyDay(
  isoDate: string,
  weekday: number,
  todayIso: string
): DayState {
  const mark = getDayMark(isoDate);
  const isSunday = weekday === 0;
  const isSaturday = weekday === 6;

  return {
    isToday: isoDate === todayIso,
    isPast: isoDate < todayIso,
    isSunday,
    isSaturday,
    isRed: isSunday || Boolean(mark?.isHoliday),
    markName: mark?.name ?? null,
    markSub: mark?.sub ?? null,
    markKind: mark?.kind
  };
}

export type TagColorSummary = {
  tag: BroadcastTag;
  color: ColorPaletteEntry;
};

export function buildCalendarMonth(year: number, month: number): MonthCell[] {
  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const lastDate = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstWeekday = firstDay.getUTCDay();
  const cells: MonthCell[] = [];

  for (let offset = firstWeekday; offset > 0; offset -= 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 - offset));
    cells.push(toMonthCell(date, false));
  }

  for (let day = 1; day <= lastDate; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    cells.push(toMonthCell(date, true));
  }

  while (cells.length % 7 !== 0 || cells.length < 42) {
    const nextIndex = cells.length - firstWeekday + 1;
    const date = new Date(Date.UTC(year, month - 1, nextIndex));
    cells.push(toMonthCell(date, false));
  }

  return cells;
}

export function getEventDateKey(event: Pick<PublicScheduleEvent, "startsAt">) {
  return event.startsAt.slice(0, 10);
}

// 제목의 첫 줄 = 상위 주제, 나머지 줄 = 하위 주제.
export function splitEventTitle(title: string): { main: string; subs: string[] } {
  const lines = title.split("\n");
  return {
    main: lines[0] ?? "",
    subs: lines.slice(1).map((l) => l.trim()).filter((l) => l.length > 0)
  };
}

export function getAdjacentMonth(year: number, month: number, offset: number) {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1
  };
}

function eventEndKey(event: PublicScheduleEvent | StudioScheduleEvent) {
  return event.endDateKey ?? getEventDateKey(event);
}

// "누군가 나를 linkNext로 가리키는가"를 매번 배열 전체를 훑어 확인하면 O(N)이다. 그 판정을
// 배열당 한 번만 해서 Set으로 들고 있는다. 키는 events 배열 자체(WeakMap) — 이 배열은 호출부에서
// useMemo로 안정적으로 유지되므로, 한 렌더의 42칸이 같은 Set을 나눠 쓴다. 배열이 새로 만들어지면
// (= 일정이 바뀌면) 키가 달라져 자동으로 새로 계산된다. 낡은 배열은 GC가 알아서 치운다.
const linkTargetCache = new WeakMap<object, Set<string>>();

function linkTargetsOf<T extends PublicScheduleEvent | StudioScheduleEvent>(
  events: T[]
): Set<string> {
  const cached = linkTargetCache.get(events);
  if (cached) {
    return cached;
  }
  const targets = new Set<string>();
  for (const e of events) {
    if (e.linkNext) {
      targets.add(e.linkNext);
    }
  }
  linkTargetCache.set(events, targets);
  return targets;
}

export function getEventsForDate<T extends PublicScheduleEvent | StudioScheduleEvent>(
  events: T[],
  isoDate: string
) {
  // 연결/멀티데이 일정을 위(top lane)로 정렬해 칸을 가로질러도 같은 줄에 오게 한다.
  //
  // 성능 주의: 이 함수는 달력 칸마다(42칸) 매 렌더 호출되는 핫 패스다. 예전엔 이 판정(connected)이
  // 배열 전체를 훑는 events.some()을 품은 채 **정렬 비교자 안에서** 불렸다 — 비교 한 번마다 O(N).
  // 넘어오는 배열은 이번 달이 아니라 전체 공개 일정이라, 일정이 쌓일수록 렌더가 통째로 느려졌다
  // (하트 토글·호버·리사이즈마다 지불). 이제 ① 연결 대상은 배열당 한 번 Set으로(위) ② 등급은
  // 정렬 전에 항목마다 한 번만 계산해 들고 간다(슈워츠 변환). 순서 규칙은 그대로 —
  // tests/unit/events-for-date.test.ts가 못박는다.
  const linkTargets = linkTargetsOf(events);
  const rankOf = (e: T) =>
    eventEndKey(e) > getEventDateKey(e) || Boolean(e.linkNext) || linkTargets.has(e.id) ? 1 : 0;

  return events
    .filter((event) => getEventDateKey(event) <= isoDate && isoDate <= eventEndKey(event))
    .map((event) => ({ event, rank: rankOf(event) }))
    // 연결/멀티데이를 위로, 그 다음은 sortOrder(같은 날 안에서 드래그로 바꾼 순서). 동률이면
    // 원래 로드 순서 유지(안정 정렬). sortOrder가 모두 0이면 기존과 동일하게 동작.
    .sort((a, b) => b.rank - a.rank || a.event.sortOrder - b.event.sortOrder)
    .map((x) => x.event);
}

export type EventSpan = {
  isMulti: boolean;
  roundLeft: boolean;
  roundRight: boolean;
  showTitle: boolean;
};

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, "0"),
    String(dt.getUTCDate()).padStart(2, "0")
  ].join("-");
}

function covers(event: PublicScheduleEvent | StudioScheduleEvent, isoDate: string) {
  return getEventDateKey(event) <= isoDate && isoDate <= eventEndKey(event);
}

// 일정의 대표 태그(최대 2개) — 칸을 칠하는 색 순서. [0]=왼쪽 변, 마지막=오른쪽 변.
function repTagIds(event: PublicScheduleEvent | StudioScheduleEvent): string[] {
  return (event.primaryTagIds.length > 0 ? event.primaryTagIds : event.tagIds).slice(0, 2);
}
function leftEdgeTag(event: PublicScheduleEvent | StudioScheduleEvent): string | undefined {
  return repTagIds(event)[0];
}
function rightEdgeTag(event: PublicScheduleEvent | StudioScheduleEvent): string | undefined {
  const reps = repTagIds(event);
  return reps[reps.length - 1];
}

// 2계층: 태그의 최상위 대분류 id(세부면 부모를 따라 올라감). 대분류면 자기 id.
export function categoryId(tagId: string, tags: BroadcastTag[]): string | null {
  let cur = tags.find((t) => t.id === tagId);
  const guard = new Set<string>();
  while (cur?.parentId && !guard.has(cur.id)) {
    guard.add(cur.id);
    const parent = tags.find((t) => t.id === cur!.parentId);
    if (!parent) break;
    cur = parent;
  }
  return cur ? cur.id : null;
}

// 필터 매칭: 이벤트가 태그 filterId(대분류 또는 세부)에 해당하는가. 대분류를 고르면 그 하위 세부를
// 가진 이벤트까지 포함(전체집합 매칭). 세부를 고르면 그 세부를 가진 이벤트만.
export function eventMatchesTagFilter(
  event: PublicScheduleEvent | StudioScheduleEvent,
  filterId: string,
  tags: BroadcastTag[]
): boolean {
  return event.tagIds.some((tid) => tid === filterId || categoryId(tid, tags) === filterId);
}

// 2계층: 태그의 최상위 대분류 colorKey(세부면 부모를 따라 올라감). 대분류면 자기 색.
export function categoryColorKey(tagId: string, tags: BroadcastTag[]): string | null {
  let cur = tags.find((t) => t.id === tagId);
  const guard = new Set<string>();
  while (cur?.parentId && !guard.has(cur.id)) {
    guard.add(cur.id);
    const parent = tags.find((t) => t.id === cur!.parentId);
    if (!parent) break;
    cur = parent;
  }
  return cur ? cur.colorKey : null;
}

// 2계층: 태그의 최상위 대분류 kind(세부면 부모를 따라 올라감). 대분류면 자기 kind.
function categoryKind(tagId: string, tags: BroadcastTag[]): TagKind {
  let cur = tags.find((t) => t.id === tagId);
  const guard = new Set<string>();
  while (cur?.parentId && !guard.has(cur.id)) {
    guard.add(cur.id);
    const parent = tags.find((t) => t.id === cur!.parentId);
    if (!parent) break;
    cur = parent;
  }
  return cur?.kind ?? "content";
}

// 이벤트가 가진 태그들의 서로 다른 대분류 색 + 그 대분류가 수식어(modifier)인지. 같은 대분류는
// 하나로 합쳐진다(예: 게임>롤 + 게임>명조 → 게임 색 1개). 첫 등장 순서 유지.
function eventCategoryColors(
  event: PublicScheduleEvent | StudioScheduleEvent,
  tags: BroadcastTag[]
): { ck: string; isModifier: boolean }[] {
  // 카드 색·점 줄은 이벤트가 가진 '모든' 태그의 대분류 기준(최대 6개라 primary 슬라이스 안 씀).
  const ids = event.tagIds.length > 0 ? event.tagIds : event.primaryTagIds;
  const seen = new Set<string>();
  const out: { ck: string; isModifier: boolean }[] = [];
  for (const id of ids) {
    const ck = categoryColorKey(id, tags);
    if (ck && !seen.has(ck)) {
      seen.add(ck);
      out.push({ ck, isModifier: categoryKind(id, tags) === "modifier" });
    }
  }
  return out;
}

// D: 일정칸에 칠할 색 — 서로 다른 '콘텐츠' 대분류 색 최대 2개(그라데이션). 수식어(modifier)는 칸 색을
// 안 먹고 점 줄로만 간다(getExtraCategoryColors). 세부 태그는 부모 색으로 합쳐진다.
export function getEventTagColors(
  event: PublicScheduleEvent | StudioScheduleEvent,
  tags: BroadcastTag[],
  palette: ColorPaletteEntry[]
): ColorPaletteEntry[] {
  return eventCategoryColors(event, tags)
    .filter((c) => !c.isModifier)
    .slice(0, 2)
    .map((c) => palette.find((p) => p.key === c.ck))
    .filter((color): color is ColorPaletteEntry => Boolean(color));
}

// 칸 색(≤2 콘텐츠 대분류)에 못 담은 색들 — 작은 점 줄로 표시. 넘친 콘텐츠 대분류 + 모든 수식어.
export function getExtraCategoryColors(
  event: PublicScheduleEvent | StudioScheduleEvent,
  tags: BroadcastTag[],
  palette: ColorPaletteEntry[]
): ColorPaletteEntry[] {
  const cats = eventCategoryColors(event, tags);
  const content = cats.filter((c) => !c.isModifier);
  const modifiers = cats.filter((c) => c.isModifier);
  return [...content.slice(2), ...modifiers]
    .map((c) => palette.find((p) => p.key === c.ck))
    .filter((color): color is ColorPaletteEntry => Boolean(color));
}

// ── 일정 카드 글자 가독성 (근거 기반) ───────────────────────────────────────────
// 카드 배경은 항상 '콘텐츠' 파스텔(+무늬)이고 글자는 그 위 진한 글씨다. 색·무늬마다 읽힘이 달라지므로
// 글자색/굵기/헤일로를 색별로 다르게 준다. 근거:
//  · WCAG 2.1 SC 1.4.3 — 본문(18.6px 미만) 대비 ≥4.5:1(AA). 상대휘도 L=0.2126R+0.7152G+0.0722B
//    (sRGB 선형화), 대비=(L밝+0.05)/(L어둠+0.05). [W3C]
//  · 흑/백 선택은 '실측 대비가 더 높은 쪽' — 채도 높은 색에선 지각과 수치가 어긋나니 수치로 고른다.
//    [WebAIM Contrast]
//  · 대비가 낮을수록 글자를 더 굵게 — 굵은 획=잉크 면적↑=지각 대비↑(저시력 가독성 연구). 단 과도한
//    900은 작은 글자에서 속공간이 닫혀 오히려 불리 → 대비 높으면 700~800로 절제.
//  · 무늬(텍스처) 위 글자는 읽힘이 떨어진다 → 한 단계 더 굵게 + 바탕색 헤일로(스크림)로 글자를 무늬에서
//    떼어낸다. [텍스트-오버-이미지 가독성]
function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  return (
    0.2126 * srgbToLinear((n >> 16) & 255) +
    0.7152 * srgbToLinear((n >> 8) & 255) +
    0.0722 * srgbToLinear(n & 255)
  );
}
function contrastRatio(hexA: string, hexB: string): number {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
// 카드 글자색은 '통일된 먹/흰'만 쓴다(조화). 색별 틴트 글자(팔레트 textColor)는 한눈에 보면
// 카드마다 짙기가 달라 조화가 깨졌다 → 강조는 배경(색)이 하고, 글자는 배경 밝기에 따라 '짙은 먹'
// 또는 '흰색'으로 일정하게. 밝은 파스텔이 대부분이라 결과적으로 거의 모든 카드가 같은 먹색.
const DARK_INK = "#22242c"; // 순수 검정보다 살짝 부드러운 먹(따뜻한 포스터 톤과 조화).
// 배경 여러 개(2색 카드는 좌·우 두 색)에 대해 먹/흰 중 '최소 대비가 더 높은' 쪽을 고른다.
// → 2색 그라데이션 카드도 양쪽 절반 모두에서 읽히는 한 색으로 글자를 통일한다.
function pickInk(bgs: string[]): { ink: string; cr: number } {
  const minCr = (ink: string) => Math.min(...bgs.map((b) => contrastRatio(b, ink)));
  const cd = minCr(DARK_INK);
  const cl = minCr("#ffffff");
  return cd >= cl ? { ink: DARK_INK, cr: cd } : { ink: "#ffffff", cr: cl };
}
// 두 hex의 평균색(2색 카드 헤일로용 — 양쪽 절반 어디서도 안 튀는 중간색).
function mixHex(hexA: string, hexB: string): string {
  const parse = (h: string) => {
    const m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number];
  };
  const a = parse(hexA);
  const b = parse(hexB);
  if (!a || !b) return hexA;
  const to = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${to((a[0] + b[0]) / 2)}${to((a[1] + b[1]) / 2)}${to((a[2] + b[2]) / 2)}`;
}
function inkStyleFor(bgs: string[], haloBg: string): CSSProperties {
  const { ink, cr } = pickInk(bgs);
  // 대비 구간별 굵기(절제). 밝은 파스텔은 대개 cr≥7 → 700로 통일돼 굵기도 조화롭다. (glyph 폭이
  // 바뀌면 줄바꿈·카드 높이·스티커 좌표가 밀린다(ADR-0004) — 굵기 변화는 여기서만, 가독성은 헤일로.)
  const weight = cr >= 7 ? 700 : cr >= 4.5 ? 800 : 900;
  // 헤일로 = 바탕색 얇은 여백을 글자 가장자리에 둘러 파스텔 위에서 또렷하게(배경에서 떼어냄).
  // 단 2색이 '밝음+어둠 극단'이면 한 잉크로 양쪽을 못 살린다(cr<3) → 벤치마킹(자막 기법)대로
  // 반대색 얇은 외곽선을 둘러 어느 절반에서도 읽히게 한다. 둘 다 text-shadow라 reflow 없음(레이아웃 불변).
  const shadow =
    cr < 3
      ? (() => {
          const o = ink === "#ffffff" ? "#0a0a0a" : "#ffffff";
          return `0 0 1px ${o}, 1px 0 1px ${o}, -1px 0 1px ${o}, 0 1px 1px ${o}, 0 -1px 1px ${o}`;
        })()
      : `0 0 1px ${haloBg}`;
  return {
    color: ink,
    ["--evt-weight" as string]: String(weight),
    ["--evt-shadow" as string]: shadow
  } as CSSProperties;
}
// 배경색 위 글자 스타일. textColor는 더 이상 잉크로 쓰지 않는다(조화 위해 통일) — 호출부 호환용.
export function eventInkStyle(bgColor: string, _textColor?: string): CSSProperties {
  return inkStyleFor([bgColor], bgColor);
}

// D: 단색 일정칸 인라인 스타일. 2색(혼합)은 mixedEventStyle/mixedEventPatterns로 따로 그린다.
export function eventColorStyle(colors: ColorPaletteEntry[]): CSSProperties {
  const a = colors[0];
  if (!a) {
    return {};
  }
  return {
    backgroundColor: a.bgColor,
    borderColor: a.borderColor,
    ...eventInkStyle(a.bgColor, a.textColor)
  };
}

// 이어진 일정(같은 멀티데이 일정의 여러 칸 + link_next로 묶인 일정들)을 한 묶음으로 보고
// 같은 키를 준다. 이 키로 DOM에서 묶어 높이를 가장 큰 칸에 맞춘다(어긋난 이음새 방지).
export function buildChainKeys(
  events: Array<PublicScheduleEvent | StudioScheduleEvent>
): Map<string, string> {
  const next = new Map<string, string>();
  const hasPrev = new Set<string>();
  for (const e of events) {
    if (e.linkNext) {
      next.set(e.id, e.linkNext);
      hasPrev.add(e.linkNext);
    }
  }
  const keys = new Map<string, string>();
  for (const e of events) {
    if (hasPrev.has(e.id)) {
      continue; // 체인 시작점만에서 출발
    }
    let cur: string | undefined = e.id;
    const guard = new Set<string>();
    while (cur && !guard.has(cur)) {
      guard.add(cur);
      keys.set(cur, e.id);
      cur = next.get(cur);
    }
  }
  for (const e of events) {
    if (!keys.has(e.id)) {
      keys.set(e.id, e.id);
    }
  }
  return keys;
}

function diffDays(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

// D: "칠 묶음(paint group)" 날짜 범위. 같은 대표 태그 구성으로 이어진(link_next) 일정들을
// 한 그라데이션으로 그리기 위해, 각 일정 id → 그 묶음의 전체 날짜 범위(start~end)를 준다.
// - 단일 멀티데이 일정: 자기 범위(여러 칸) → 그 일정 칸들에 그라데이션 하나(경계 가운데).
// - 같은 태그 구성으로 이어진 일정들: 합친 범위 → 하나의 그라데이션(경계 가운데).
// - 태그 구성이 다른 이어짐(예: 월드컵|종겜 + 종겜): 묶이지 않음 → 각자 자기 색으로(이음새는
//   맞닿는 색이 같아 자연히 매끄럽다).
export function buildPaintGroups(
  events: Array<PublicScheduleEvent | StudioScheduleEvent>
): Map<string, { start: string; end: string }> {
  const repKey = (e: PublicScheduleEvent | StudioScheduleEvent) =>
    (e.primaryTagIds.length > 0 ? e.primaryTagIds : e.tagIds).slice(0, 2).join(",");
  const byId = new Map(events.map((e) => [e.id, e] as const));
  const parent = new Map<string, string>();
  events.forEach((e) => parent.set(e.id, e.id));
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) {
      r = parent.get(r)!;
    }
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  // 같은 대표 태그 구성으로 link된 인접 일정만 한 묶음으로 합친다.
  for (const e of events) {
    if (e.linkNext && byId.has(e.linkNext)) {
      const n = byId.get(e.linkNext)!;
      if (repKey(e) === repKey(n)) {
        union(e.id, e.linkNext);
      }
    }
  }
  const ranges = new Map<string, { start: string; end: string }>();
  for (const e of events) {
    const r = find(e.id);
    const s = getEventDateKey(e);
    const en = eventEndKey(e);
    const cur = ranges.get(r);
    if (!cur) {
      ranges.set(r, { start: s, end: en });
    } else {
      if (s < cur.start) cur.start = s;
      if (en > cur.end) cur.end = en;
    }
  }
  const out = new Map<string, { start: string; end: string }>();
  for (const e of events) {
    out.set(e.id, ranges.get(find(e.id))!);
  }
  return out;
}

// D: 주어진 날짜 범위(start~end)가 같은 주(週) 행에서 차지하는 칸 중 이 칸의 위치/총개수.
// 이어진 칸 전체에 하나의 그라데이션을 깔고 경계를 가운데에 두기 위해 쓴다.
export function getSpanRunRange(
  start: string,
  end: string,
  isoDate: string,
  weekday: number
): { index: number; length: number } {
  const weekStart = addDays(isoDate, -weekday);
  const weekEnd = addDays(isoDate, 6 - weekday);
  const rowStart = start > weekStart ? start : weekStart;
  const rowEnd = end < weekEnd ? end : weekEnd;
  return {
    index: Math.max(0, diffDays(rowStart, isoDate)),
    length: Math.max(1, diffDays(rowStart, rowEnd) + 1)
  };
}
// D: 혼합(2색) 칸 배경 — 두 색을 좌→우 그라데이션으로 섞되, 이어진 칸 전체 기준으로 그려
// 경계가 칸 묶음의 가운데(2칸=이음새, 3칸=가운데칸 중앙)에 오게 한다. 경계는 수직이라
// 칸 높이가 달라도 무늬 경계와 기울기가 어긋나지 않는다.
export function mixedEventStyle(
  colors: ColorPaletteEntry[],
  run: { index: number; length: number }
): CSSProperties {
  const [a, b] = colors;
  const length = Math.max(1, run.length);
  const size = `${length * 100}% 100%`;
  const positionX = length > 1 ? `${(run.index / (length - 1)) * 100}%` : "center";
  // 배경은 padding-box(안쪽), 테두리는 border-box(테두리 영역)에 각각 좌→우 그라데이션을 깔아
  // 2색일 때 테두리도 반반으로 각 태그색이 되게 한다. background-clip 기법이라 둥근 모서리 유지.
  const bgGrad = `linear-gradient(to right, ${a.bgColor} 0%, ${a.bgColor} 38%, ${b.bgColor} 62%, ${b.bgColor} 100%)`;
  const borderGrad = `linear-gradient(to right, ${a.borderColor} 0%, ${a.borderColor} 38%, ${b.borderColor} 62%, ${b.borderColor} 100%)`;
  // 크기·위치는 단일값으로 둔다(모든 배경 레이어에 동일 적용) → 무늬 마스크(mixedPatternMaskStyle)도
  // 같은 윈도잉을 그대로 읽어 쓸 수 있다. clip·origin·image만 레이어별(콤마)로 지정.
  return {
    backgroundImage: `${bgGrad}, ${borderGrad}`,
    backgroundClip: "padding-box, border-box",
    WebkitBackgroundClip: "padding-box, border-box",
    backgroundOrigin: "padding-box, border-box",
    backgroundSize: size,
    backgroundPositionX: positionX,
    backgroundRepeat: "no-repeat",
    // 글자색/굵기/헤일로 = text-over-image 가독성 연구 적용: 2색이라 '양쪽 절반 모두'에서 읽히는
    // 단일 잉크(pickInk가 두 색 최소대비 최대화)로 통일하고, 헤일로는 두 색의 평균색으로 둔다
    // (한쪽 색만 쓰면 반대 절반에서 헤일로가 튄다). 벤치마킹(구글캘린더/판타스티컬)은 글자 뒤를
    // 안 쪼개지만, 본 앱은 2콘텐츠=반반이 의도라 split은 유지하되 글자만 확실히 띄운다.
    ...inkStyleFor([a.bgColor, b.bgColor], mixHex(a.bgColor, b.bgColor)),
    // 실제 테두리는 투명으로 두고, 위 border-box 그라데이션이 테두리처럼 보이게 한다.
    borderColor: "transparent"
  };
}

// 업 도움(support) 일정에 레인(끈 세로 위치)을 배정한다.
// 시작일이 이른 것이 위(낮은 lane), 겹치는 것은 아래로. (구간 패킹)
export function assignSupportLanes<T extends PublicScheduleEvent | StudioScheduleEvent>(
  events: T[]
): { lanes: Map<string, number>; count: number } {
  const support = events
    .filter((e) => e.isSupport)
    .sort(
      (a, b) =>
        getEventDateKey(a).localeCompare(getEventDateKey(b)) || a.id.localeCompare(b.id)
    );
  const laneEnds: string[] = []; // laneEnds[i] = lane i의 마지막 종료일
  const lanes = new Map<string, number>();
  for (const e of support) {
    const start = getEventDateKey(e);
    const end = eventEndKey(e);
    let lane = laneEnds.findIndex((endDate) => endDate < start);
    if (lane === -1) {
      lane = laneEnds.length;
    }
    laneEnds[lane] = end;
    lanes.set(e.id, lane);
  }
  return { lanes, count: laneEnds.length };
}

// a~b 사이가 "매일 연속 + 맞닿는 변의 색이 일치"하면 이을 일정 id 체인(날짜순)을 반환, 아니면 null.
// 맞닿는 변 일치: 앞 일정의 오른쪽 변 색 == 뒤 일정의 왼쪽 변 색. (예: 28일 월드컵|종겜 → 29일 종겜)
export function buildLinkChain<T extends PublicScheduleEvent | StudioScheduleEvent>(
  a: T,
  b: T,
  allEvents: T[]
): string[] | null {
  const from = getEventDateKey(a) <= getEventDateKey(b) ? a : b;
  const to = from === a ? b : a;

  const chain: T[] = [from];
  let cur = from;
  for (let i = 0; i < 62; i += 1) {
    if (cur.id === to.id) {
      return chain.map((e) => e.id);
    }
    const nextDay = addDays(eventEndKey(cur), 1);
    const want = rightEdgeTag(cur); // 이 일정의 오른쪽 변 색
    const curKey = repTagIds(cur).join(","); // 대표 태그 구성(동일 구성도 연결 허용)
    const next = allEvents.find(
      (e) =>
        e.id !== cur.id &&
        getEventDateKey(e) === nextDay &&
        ((want && leftEdgeTag(e) === want) || repTagIds(e).join(",") === curKey)
    );
    if (!next) {
      return null; // 연속이 끊기거나 맞닿는 색·구성이 다름
    }
    chain.push(next);
    cur = next;
  }
  return null;
}

// 선택된 일정이 속한 link_next 체인의 모든 id를 양방향으로 추적해 반환.
// (단일 멀티데이 일정은 id 하나만 들어가며, 이미 모든 칸에서 동일 id로 그려진다.)
export function getLinkedChainIds<T extends PublicScheduleEvent | StudioScheduleEvent>(
  startId: string | null,
  events: T[]
): Set<string> {
  const ids = new Set<string>();
  if (!startId) {
    return ids;
  }
  const byId = new Map<string, T>(events.map((e) => [e.id, e] as const));
  if (!byId.has(startId)) {
    return ids;
  }
  // 앞쪽으로: link_next 가 현재를 가리키는 일정을 거슬러 올라감
  let cur: string | undefined = startId;
  while (cur) {
    ids.add(cur);
    const prev = events.find((e) => e.linkNext === cur);
    cur = prev && !ids.has(prev.id) ? prev.id : undefined;
  }
  // 뒤쪽으로: 현재의 link_next 를 따라감
  cur = startId;
  while (cur) {
    ids.add(cur);
    const next: string | undefined = byId.get(cur)?.linkNext;
    cur = next && !ids.has(next) ? next : undefined;
  }
  return ids;
}

// 특정 날짜 칸에서 일정이 어떻게 그려질지. 자체 멀티데이(end_date_key)와
// 연결 그룹(link_group_id)의 이웃(앞/뒤 날) 둘 다 고려해 막대를 잇는다.
export function getEventSpan<T extends PublicScheduleEvent | StudioScheduleEvent>(
  event: T,
  isoDate: string,
  weekday: number,
  allEvents: T[]
): EventSpan {
  const start = getEventDateKey(event);
  const end = eventEndKey(event);
  // link_next로 묶였더라도 맞닿는 변의 색(대표 태그)이 같을 때만 "이어진 것"으로 본다.
  // (앞 일정의 오른쪽 변 == 뒤 일정의 왼쪽 변, 또는 대표 태그 구성이 동일.) buildLinkChain이
  // 이을 때 쓰는 기준과 동일 → 칠(buildPaintGroups)과 모서리가 항상 일치한다. 그래야 색이 다른
  // 두 일정(예: 옛 엠바고 + 다른 태그)이 억지로 붙어 보이지 않는다. "A|B"+"B"는 이어지고(B==B),
  // "A|B"+"C"는 끊긴다. (태그를 바꿔 색이 어긋난 옛 link_next도 자동으로 끊겨 보인다.)
  const edgesMatch = (left: T, right: T) => {
    const r = rightEdgeTag(left);
    const l = leftEdgeTag(right);
    return (Boolean(r) && r === l) || repTagIds(left).join(",") === repTagIds(right).join(",");
  };
  const linkedNext = event.linkNext
    ? allEvents.find((e) => e.id === event.linkNext)
    : undefined;
  const linkedPrev = allEvents.find((e) => e.linkNext === event.id);
  const nextEvent = linkedNext && edgesMatch(event, linkedNext) ? linkedNext : undefined;
  const prevEvent = linkedPrev && edgesMatch(linkedPrev, event) ? linkedPrev : undefined;

  // 오른쪽 이어짐: 자체 멀티데이가 계속되거나, 끝날의 다음날을 (색이 맞는) link_next 상대가 덮을 때
  const connectRight =
    isoDate < end ||
    (isoDate === end && Boolean(nextEvent) && covers(nextEvent!, addDays(isoDate, 1)));
  const connectLeft =
    isoDate > start ||
    (isoDate === start && Boolean(prevEvent) && covers(prevEvent!, addDays(isoDate, -1)));

  return {
    isMulti: end > start || Boolean(nextEvent) || Boolean(prevEvent),
    // 주 경계여도 둥글게 강제하지 않음 → 모서리가 칸 끝까지 가서 다음 줄과 잇는 느낌
    roundLeft: !connectLeft,
    roundRight: !connectRight,
    showTitle: isoDate === start || weekday === 0
  };
}

function toMonthCell(date: Date, inCurrentMonth: boolean): MonthCell {
  return {
    isoDate: [
      date.getUTCFullYear(),
      String(date.getUTCMonth() + 1).padStart(2, "0"),
      String(date.getUTCDate()).padStart(2, "0")
    ].join("-"),
    dayOfMonth: date.getUTCDate(),
    inCurrentMonth,
    weekday: date.getUTCDay()
  };
}
