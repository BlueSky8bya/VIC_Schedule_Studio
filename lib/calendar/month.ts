import type {
  BroadcastTag,
  ColorPaletteEntry,
  PublicScheduleEvent,
  StudioScheduleEvent,
  SupportCampaign
} from "@/lib/domain/schedule-types";
import { PRODUCT_TIMEZONE } from "@/lib/domain/schedule-types";
import { getDayMark } from "@/lib/calendar/holidays";
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
  markName: string | null; // 공휴일/기념일/절기 표기
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
    markName: mark?.name ?? null
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

export function getMonthLabel(year: number, month: number) {
  return `${String(year).slice(2)}.${String(month).padStart(2, "0")}`;
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

export function getEventsForDate<T extends PublicScheduleEvent | StudioScheduleEvent>(
  events: T[],
  isoDate: string
) {
  // 연결/멀티데이 일정을 위(top lane)로 정렬해 칸을 가로질러도 같은 줄에 오게 한다.
  const connected = (e: T) =>
    eventEndKey(e) > getEventDateKey(e) ||
    Boolean(e.linkNext) ||
    events.some((o) => o.linkNext === e.id)
      ? 1
      : 0;

  return events
    .filter((event) => getEventDateKey(event) <= isoDate && isoDate <= eventEndKey(event))
    // 연결/멀티데이를 위로, 그 다음은 sortOrder(같은 날 안에서 드래그로 바꾼 순서). 동률이면
    // 원래 로드 순서 유지(안정 정렬). sortOrder가 모두 0이면 기존과 동일하게 동작.
    .sort((a, b) => connected(b) - connected(a) || a.sortOrder - b.sortOrder);
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

// 두 일정이 연속된 날짜인지(한쪽 끝 다음날이 다른 쪽 시작).
export function areAdjacentEvents(
  a: PublicScheduleEvent | StudioScheduleEvent,
  b: PublicScheduleEvent | StudioScheduleEvent
): boolean {
  const aStart = getEventDateKey(a);
  const aEnd = eventEndKey(a);
  const bStart = getEventDateKey(b);
  const bEnd = eventEndKey(b);
  return bStart === addDays(aEnd, 1) || aStart === addDays(bEnd, 1);
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

// 이벤트가 가진 태그들의 서로 다른 대분류 colorKey 목록(태그 순서, 중복 제거). 세부 여러 개가
// 같은 대분류면 하나로 합쳐진다(예: 게임>롤 + 게임>명조 → 게임 색 1개).
function eventCategoryColorKeys(
  event: PublicScheduleEvent | StudioScheduleEvent,
  tags: BroadcastTag[]
): string[] {
  // 카드 색·점 줄은 이벤트가 가진 '모든' 콘텐츠 태그의 대분류 기준(최대 6개라 primary 슬라이스 안 씀).
  const ids = event.tagIds.length > 0 ? event.tagIds : event.primaryTagIds;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const ck = categoryColorKey(id, tags);
    if (ck && !seen.has(ck)) {
      seen.add(ck);
      out.push(ck);
    }
  }
  return out;
}

// D: 일정칸에 칠할 색 — 서로 다른 대분류 색 최대 2개(그라데이션). 세부 태그는 부모 색으로 합쳐진다.
export function getEventTagColors(
  event: PublicScheduleEvent | StudioScheduleEvent,
  tags: BroadcastTag[],
  palette: ColorPaletteEntry[]
): ColorPaletteEntry[] {
  return eventCategoryColorKeys(event, tags)
    .slice(0, 2)
    .map((ck) => palette.find((p) => p.key === ck))
    .filter((color): color is ColorPaletteEntry => Boolean(color));
}

// PR2: 칸 색(≤2 대분류)에 못 담은 '나머지 대분류' 색들 — 작은 점 줄로 표시(색 안 늘리고 "더 있음").
export function getExtraCategoryColors(
  event: PublicScheduleEvent | StudioScheduleEvent,
  tags: BroadcastTag[],
  palette: ColorPaletteEntry[]
): ColorPaletteEntry[] {
  return eventCategoryColorKeys(event, tags)
    .slice(2)
    .map((ck) => palette.find((p) => p.key === ck))
    .filter((color): color is ColorPaletteEntry => Boolean(color));
}

// D: 단색 일정칸 인라인 스타일. 2색(혼합)은 mixedEventStyle/mixedEventPatterns로 따로 그린다.
export function eventColorStyle(colors: ColorPaletteEntry[]): {
  backgroundColor?: string;
  color?: string;
  borderColor?: string;
} {
  const a = colors[0];
  if (!a) {
    return {};
  }
  return { backgroundColor: a.bgColor, color: a.textColor, borderColor: a.borderColor };
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
export function getSpanRun(
  event: PublicScheduleEvent | StudioScheduleEvent,
  isoDate: string,
  weekday: number
): { index: number; length: number } {
  return getSpanRunRange(getEventDateKey(event), eventEndKey(event), isoDate, weekday);
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
    color: a.textColor,
    // 실제 테두리는 투명으로 두고, 위 border-box 그라데이션이 테두리처럼 보이게 한다.
    borderColor: "transparent"
  };
}

// D: 혼합 칸 무늬 오버레이 스타일. 색 그라데이션과 똑같은 윈도잉(크기·위치)으로 마스크를 깔아,
// 무늬가 색과 같은 위치(가운데 38~62%)에서 부드럽게 사라지게 한다 → 무늬 경계도 색처럼 흐릿.
// A는 왼쪽에서 불투명→가운데서 사라짐, B는 가운데서 나타나→오른쪽 불투명.
export function mixedPatternMaskStyle(
  win: Pick<CSSProperties, "backgroundSize" | "backgroundPositionX">,
  side: "a" | "b"
): CSSProperties {
  const grad =
    side === "a"
      ? "linear-gradient(to right, #000 38%, transparent 62%)"
      : "linear-gradient(to right, transparent 38%, #000 62%)";
  const size = String(win.backgroundSize ?? "100% 100%");
  const pos = `${String(win.backgroundPositionX ?? "center")} center`;
  return {
    WebkitMaskImage: grad,
    maskImage: grad,
    WebkitMaskSize: size,
    maskSize: size,
    WebkitMaskPosition: pos,
    maskPosition: pos,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat"
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

export function getCampaignsForDate(campaigns: SupportCampaign[], isoDate: string) {
  return campaigns.filter(
    (campaign) =>
      campaign.isActive &&
      campaign.isPublic &&
      campaign.startsOn <= isoDate &&
      campaign.endsOn >= isoDate
  );
}

export function getRepresentativeTagColors(
  events: Array<PublicScheduleEvent | StudioScheduleEvent>,
  tags: BroadcastTag[],
  palette: ColorPaletteEntry[]
) {
  const orderedTagIds = events.flatMap((event) =>
    event.primaryTagIds.length > 0 ? event.primaryTagIds : event.tagIds
  );
  const uniqueTagIds = [...new Set(orderedTagIds)];
  const summaries = uniqueTagIds
    .map((tagId) => {
      const tag = tags.find((candidate) => candidate.id === tagId);
      const color = tag
        ? palette.find((candidate) => candidate.key === tag.colorKey)
        : undefined;

      return tag && color ? { tag, color } : null;
    })
    .filter((summary): summary is TagColorSummary => summary !== null);

  return {
    visible: summaries.slice(0, 2),
    hiddenCount: Math.max(0, summaries.length - 2)
  };
}

export function formatKstTime(value?: string) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
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
