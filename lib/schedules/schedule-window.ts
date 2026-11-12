import type { PublicSchedule, PublicScheduleEvent, PublicVodEntry } from "@/lib/domain/schedule-types";

// 공개 포스터 첫 화면 데이터 창(2026-11-13 소유자 "속도 개선 1"): `/` 응답이 31개월 일정 전부(≈300KB)와
// 다시보기 전부(≈130KB)를 RSC 페이로드로 실어 보냈다(페이로드의 96%). 첫 렌더에 필요한 건 보는 달 근처뿐이라,
// SSR은 '보는 달 ±1달'과 '오늘 앞 달 ~ 미래 전부'(+떡밥)만 싣고 나머지는 클라이언트가 공개 API
// (/api/public/[slug]/events)에서 받아 합친다(MUI Scheduler 'visible range' 지연 로딩 · React Query 월 키 캐시와 같은 결).
// 창 밖이 비는 것은 잠깐뿐이다 — 포스터는 마운트 즉시 전체를 받아 같은 schedule 객체에 합친다.

export type ScheduleWindow = NonNullable<PublicSchedule["window"]>;
type Range = ScheduleWindow["ranges"][number];
type Month = { year: number; month: number };

function shift(m: Month, delta: number): Month {
  const index = m.year * 12 + (m.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

function firstDay(m: Month): string {
  return `${m.year}-${String(m.month).padStart(2, "0")}-01`;
}

function lastDay(m: Month): string {
  const days = new Date(Date.UTC(m.year, m.month, 0)).getUTCDate();
  return `${m.year}-${String(m.month).padStart(2, "0")}-${String(days).padStart(2, "0")}`;
}

// 보는 달 ±1달(달 넘나드는 이어진 일정·이전/다음 달 이동이 바로 보이게).
export function shownRange(shown: Month): Range {
  return { from: firstDay(shift(shown, -1)), to: lastDay(shift(shown, 1)) };
}

// 오늘 앞 달 1일 ~ 미래 전부('오늘' 버튼·다가오는 일정·카운트다운).
export function upcomingRange(today: Month): Range {
  return { from: firstDay(shift(today, -1)) };
}

function overlaps(start: string, end: string, range: Range): boolean {
  return end >= range.from && (range.to === undefined || start <= range.to);
}

export function eventInWindow(event: PublicScheduleEvent, window: ScheduleWindow): boolean {
  // 떡밥(최초공개)은 날짜와 무관하게 늘 싣는다 — 카운트다운·복원·다른 달 안내가 첫 화면에서 바로 돈다.
  if (event.teaser) return true;
  const start = event.startsAt.slice(0, 10);
  const end = event.endDateKey ?? start;
  return window.ranges.some((range) => overlaps(start, end, range));
}

export function vodInWindow(vod: PublicVodEntry, window: ScheduleWindow): boolean {
  return window.ranges.some((range) => overlaps(vod.dateKey, vod.dateKey, range));
}

// SSR용: 창 밖을 걸러 낸 공개 일정. 걸러 낼 게 없으면 원본을 그대로 돌려준다(창 표시도 없음).
// 필드를 새로 고르지 않는다 — 이미 공개 DTO인 PublicSchedule의 배열만 줄인다(경계 규칙상 안전).
export function windowPublicSchedule(schedule: PublicSchedule, ranges: Range[]): PublicSchedule {
  if (ranges.length === 0) return schedule;
  const window: ScheduleWindow = { ranges };
  const events = schedule.events.filter((event) => eventInWindow(event, window));
  const vods = schedule.vods?.filter((vod) => vodInWindow(vod, window));
  if (events.length === schedule.events.length && (vods?.length ?? 0) === (schedule.vods?.length ?? 0)) return schedule;
  return {
    calendar: schedule.calendar,
    events,
    tags: schedule.tags,
    palette: schedule.palette,
    ...(vods ? { vods } : {}),
    ...(schedule.myHeartIds ? { myHeartIds: schedule.myHeartIds } : {}),
    window
  };
}

// 전체 쪽 순서(로더 정렬: 일정 date_key·created_at·id, 다시보기 날짜 내림차순)를 그대로 지키며 합친다.
// 창 안 항목은 창 쪽 값으로 바꾸고, 창 안인데 창 쪽에 없으면(지워짐) 뺀다. 전체에 없는 창 항목(새로 생김)은
// 같은 정렬 기준을 모르므로 창 쪽 순서대로 뒤에 붙인다 — 다음 전체 로드 때 제자리를 찾는다.
function mergeInOrder<T, K>(full: T[], windowed: T[], key: (item: T) => K, inWindow: (item: T) => boolean): T[] {
  const fresh = new Map(windowed.map((item) => [key(item), item] as const));
  const out: T[] = [];
  for (const item of full) {
    const replacement = fresh.get(key(item));
    if (replacement) {
      out.push(replacement);
      fresh.delete(key(item));
    } else if (!inWindow(item)) {
      out.push(item);
    }
  }
  for (const item of fresh.values()) out.push(item);
  return out;
}

// 클라이언트용: 창 데이터(SSR·router.refresh로 온 최신)와 전체 데이터(공개 API)를 합친다.
// 창 안은 창 쪽이 정본(더 신선하거나 같다 — 지워진 일정도 창에서 빠지면 사라진다), 창 밖만 전체에서 가져온다.
// 달력 메타·태그·팔레트·내 하트는 창 쪽(SSR, 개인 필드 포함)을 쓴다.
export function mergeWindowedSchedule(windowed: PublicSchedule, full: PublicSchedule): PublicSchedule {
  const window = windowed.window;
  if (!window) return windowed;
  return {
    calendar: windowed.calendar,
    events: mergeInOrder(full.events, windowed.events, (event) => event.id, (event) => eventInWindow(event, window)),
    tags: windowed.tags,
    palette: windowed.palette,
    vods: mergeInOrder(full.vods ?? [], windowed.vods ?? [], (vod) => vod.titleNo, (vod) => vodInWindow(vod, window)),
    ...(windowed.myHeartIds ? { myHeartIds: windowed.myHeartIds } : {})
  };
}
