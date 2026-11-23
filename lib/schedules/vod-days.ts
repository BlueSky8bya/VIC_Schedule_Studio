// 다시보기가 어느 날짜 칸에 보이는지 — 한 곳에서만 정한다(달력 칸·다시보기 창/페이지·검색·편집실이 같이 쓴다, G-18).
//
// 규칙(2026-11-23 소유자): 하루 = **오전 6시 ~ 다음날 오전 6시(KST)**. 다시보기는 방송이 걸친 모든 날에 보이고,
// 그날 칸에서 열면 그날이 시작하는 지점부터 재생한다.
//  · 평소 방송(새벽 1~2시에 끝남)은 하루만 걸치므로 지금처럼 방송 시작일(vod_archive.broadcast_day) 한 칸에만 보인다.
//  · 며칠씩 이어진 방송(예: 2026-11-20 16:30 ~ 11-23 05:38, 다시보기 두 편)은 20·21·22일에 나뉘어 보인다.
//    예전에는 두 편 모두 시작일인 20일에만 붙어 21·22일 칸에서는 찾을 수 없었다.
//  · 둘째 날부터는 그날에 한 시간 이상 걸쳐야 보인다 — 06:20에 끝난 방송이 다음 날 칸에도 뜨지 않게.
// 방송 시작 시각은 다시보기 등록 시각 − 길이(PublicVodEntry.startedAt)로, 방송 감지 기록과 분 단위까지 맞는다(실측).
// 총 방송시간 통계는 이 규칙과 무관하게 시작일 귀속 그대로다.
export const VOD_DAY_START_HOUR = 6;
export const VOD_DAY_MIN_OVERLAP_MS = 60 * 60 * 1000;

const DAY_MS = 86_400_000;
// KST(UTC+9)에서 하루 경계를 6시로 당긴 날 번호 — (t + 9h − 6h) / 하루.
const SHIFT_MS = (9 - VOD_DAY_START_HOUR) * 3_600_000;

export type VodDaySource = { dateKey: string; durationMs: number; startedAt?: string; titleNo: number };
/** 그 다시보기가 보이는 날 하나 — sec = 그날 칸에서 열 때 시작할 지점(초). 첫날은 0. */
export type VodDay = { dateKey: string; sec: number };

export function vodDays(vod: Pick<VodDaySource, "dateKey" | "durationMs" | "startedAt">): VodDay[] {
  const anchor: VodDay[] = [{ dateKey: vod.dateKey, sec: 0 }];
  const start = vod.startedAt ? Date.parse(vod.startedAt) : Number.NaN;
  if (!Number.isFinite(start) || !(vod.durationMs > 0)) return anchor;
  const end = start + vod.durationMs;
  const first = Math.floor((start + SHIFT_MS) / DAY_MS);
  const last = Math.floor((end - 1 + SHIFT_MS) / DAY_MS);
  if (last <= first) return anchor;
  const days: VodDay[] = [];
  for (let d = first; d <= last; d += 1) {
    const dayStart = d * DAY_MS - SHIFT_MS;
    const overlap = Math.min(end, dayStart + DAY_MS) - Math.max(start, dayStart);
    if (overlap < VOD_DAY_MIN_OVERLAP_MS) continue;
    days.push({
      dateKey: new Date(d * DAY_MS).toISOString().slice(0, 10),
      sec: Math.max(0, Math.floor((dayStart - start) / 1000))
    });
  }
  // 하루만 남으면 평소 방송과 같다 — 시작일 그대로(새벽에 시작한 방송의 칸이 하루 당겨지지 않게).
  return days.length > 1 ? days : anchor;
}

/** 날짜별 묶음. 며칠 걸친 다시보기는 걸친 날마다 들어가고 daySec(그날 시작 지점)을 단다. 날 안에서는 방송 시작 순. */
export function groupVodsByDay<T extends VodDaySource>(vods: readonly T[]): Map<string, (T & { daySec?: number })[]> {
  const map = new Map<string, (T & { daySec?: number })[]>();
  for (const vod of vods) {
    for (const day of vodDays(vod)) {
      const entry = day.sec > 0 ? { ...vod, daySec: day.sec } : vod;
      const list = map.get(day.dateKey);
      if (list) list.push(entry);
      else map.set(day.dateKey, [entry]);
    }
  }
  const startOf = (v: T) => (v.startedAt ? Date.parse(v.startedAt) : Number.NaN);
  for (const list of map.values()) {
    list.sort((a, b) => {
      const sa = startOf(a);
      const sb = startOf(b);
      if (Number.isFinite(sa) && Number.isFinite(sb) && sa !== sb) return sa - sb;
      return a.titleNo - b.titleNo;
    });
  }
  return map;
}

/** 그 다시보기가 이 날짜 칸에 보이는가. 아니면 보이는 첫 날을 돌려준다(검색 결과가 옛 시작일을 들고 올 때). */
export function vodDayFor(vod: Pick<VodDaySource, "dateKey" | "durationMs" | "startedAt">, dateKey: string): string {
  const days = vodDays(vod);
  return days.some((d) => d.dateKey === dateKey) ? dateKey : days[0].dateKey;
}
