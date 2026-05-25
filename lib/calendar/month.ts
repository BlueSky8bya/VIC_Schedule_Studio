import type {
  BroadcastTag,
  ColorPaletteEntry,
  PublicScheduleEvent,
  StudioScheduleEvent,
  SupportCampaign
} from "@/lib/domain/schedule-types";
import { PRODUCT_TIMEZONE } from "@/lib/domain/schedule-types";
import { getDayMark } from "@/lib/calendar/holidays";

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
    .sort((a, b) => connected(b) - connected(a));
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

function colorIdOf(event: PublicScheduleEvent | StudioScheduleEvent) {
  return event.primaryTagIds[0] ?? event.tagIds[0];
}

// D: 일정칸에 칠할 색을 최대 2개까지 모은다(대표 태그 우선). 2개면 호출부에서 그라데이션으로 표시.
export function getEventTagColors(
  event: PublicScheduleEvent | StudioScheduleEvent,
  tags: BroadcastTag[],
  palette: ColorPaletteEntry[]
): ColorPaletteEntry[] {
  const ids = (event.primaryTagIds.length > 0 ? event.primaryTagIds : event.tagIds).slice(0, 2);
  return ids
    .map((id) => {
      const tag = tags.find((t) => t.id === id);
      return tag ? palette.find((p) => p.key === tag.colorKey) : undefined;
    })
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

export type ChainInfo = { colors: ColorPaletteEntry[]; start: string; end: string };

// D: 이어진 묶음(chain)을 하나의 일정처럼 본다 — 묶음의 대표색(최대 2)과 전체 날짜 범위.
// 단일 일정이면 그 일정의 대표색(최대 2)을, 여러 일정이 이어졌으면 "첫 일정 색 → 끝 일정 색"
// 두 가지로 잡아 묶음 전체에 그라데이션 하나(경계는 가운데)가 깔리게 한다.
export function buildChainInfo(
  events: Array<PublicScheduleEvent | StudioScheduleEvent>,
  tags: BroadcastTag[],
  palette: ColorPaletteEntry[]
): Map<string, ChainInfo> {
  const keys = buildChainKeys(events);
  const groups = new Map<string, Array<PublicScheduleEvent | StudioScheduleEvent>>();
  for (const e of events) {
    const k = keys.get(e.id) ?? e.id;
    const g = groups.get(k);
    if (g) {
      g.push(e);
    } else {
      groups.set(k, [e]);
    }
  }
  const colorOf = (tagId: string | undefined) => {
    if (!tagId) {
      return undefined;
    }
    const tag = tags.find((t) => t.id === tagId);
    return tag ? palette.find((p) => p.key === tag.colorKey) : undefined;
  };
  const info = new Map<string, ChainInfo>();
  for (const [key, listRaw] of groups) {
    const list = [...listRaw].sort((a, b) =>
      getEventDateKey(a).localeCompare(getEventDateKey(b))
    );
    let start = getEventDateKey(list[0]);
    let end = eventEndKey(list[0]);
    for (const e of list) {
      const s = getEventDateKey(e);
      const en = eventEndKey(e);
      if (s < start) start = s;
      if (en > end) end = en;
    }
    let colors: ColorPaletteEntry[];
    if (list.length === 1) {
      colors = getEventTagColors(list[0], tags, palette); // 단일 일정: 자기 대표색(최대 2)
    } else {
      // 이어진 일정: 첫 일정 색 → 끝 일정 색 (같으면 단색)
      const first = list[0];
      const last = list[list.length - 1];
      const c1 = colorOf(first.primaryTagIds[0] ?? first.tagIds[0]);
      const c2 = colorOf(last.primaryTagIds[0] ?? last.tagIds[0]);
      colors = [];
      if (c1) colors.push(c1);
      if (c2 && c2.key !== c1?.key) colors.push(c2);
    }
    info.set(key, { colors, start, end });
  }
  return info;
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
): {
  backgroundImage: string;
  backgroundSize: string;
  backgroundPositionX: string;
  backgroundRepeat: string;
  color?: string;
  borderColor?: string;
} {
  const [a, b] = colors;
  const length = Math.max(1, run.length);
  return {
    backgroundImage: `linear-gradient(to right, ${a.bgColor} 0%, ${a.bgColor} 38%, ${b.bgColor} 62%, ${b.bgColor} 100%)`,
    backgroundSize: `${length * 100}% 100%`,
    backgroundPositionX: length > 1 ? `${(run.index / (length - 1)) * 100}%` : "center",
    backgroundRepeat: "no-repeat",
    color: a.textColor,
    borderColor: a.borderColor
  };
}

// D: 혼합 칸에 얹을 반쪽 무늬 스팬 정보. 칸 묶음 가운데를 경계로, 이 칸이 A쪽이면 A무늬만,
// B쪽이면 B무늬만, 경계가 칸 안을 지나면 그 지점에서 좌(A)·우(B)로 나눈다.
export function mixedEventPatterns(
  colors: ColorPaletteEntry[],
  run: { index: number; length: number }
): { key: string; clipPath?: string }[] {
  const [a, b] = colors;
  const length = Math.max(1, run.length);
  const cellStart = run.index / length;
  const cellEnd = (run.index + 1) / length;
  if (cellEnd <= 0.5 + 1e-6) {
    return [{ key: a.key }];
  }
  if (cellStart >= 0.5 - 1e-6) {
    return [{ key: b.key }];
  }
  const local = ((0.5 - cellStart) * length * 100).toFixed(2);
  return [
    { key: a.key, clipPath: `polygon(0 0, ${local}% 0, ${local}% 100%, 0 100%)` },
    { key: b.key, clipPath: `polygon(${local}% 0, 100% 0, 100% 100%, ${local}% 100%)` }
  ];
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

// a~b 사이가 "매일 연속 + 같은 색"이면 이을 일정 id 체인(날짜순)을 반환, 아니면 null.
export function buildLinkChain<T extends PublicScheduleEvent | StudioScheduleEvent>(
  a: T,
  b: T,
  allEvents: T[]
): string[] | null {
  const from = getEventDateKey(a) <= getEventDateKey(b) ? a : b;
  const to = from === a ? b : a;
  const colorId = colorIdOf(from);
  if (!colorId || colorIdOf(to) !== colorId) {
    return null;
  }

  const chain: T[] = [from];
  let cur = from;
  for (let i = 0; i < 62; i += 1) {
    if (cur.id === to.id) {
      return chain.map((e) => e.id);
    }
    const nextDay = addDays(eventEndKey(cur), 1);
    const next = allEvents.find(
      (e) => e.id !== cur.id && getEventDateKey(e) === nextDay && colorIdOf(e) === colorId
    );
    if (!next) {
      return null; // 연속이 끊기거나 색이 다름
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
  const nextEvent = event.linkNext
    ? allEvents.find((e) => e.id === event.linkNext)
    : undefined;
  const prevEvent = allEvents.find((e) => e.linkNext === event.id);

  // 오른쪽 이어짐: 자체 멀티데이가 계속되거나, 끝날의 다음날을 link_next 상대가 덮을 때
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
