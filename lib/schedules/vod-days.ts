// 다시보기가 어느 날짜 칸에 보이는지 — 한 곳에서만 정한다(달력 칸·다시보기 창/페이지·검색·편집실이 같이 쓴다, G-18).
//
// 규칙(2026-11-23 소유자): 하루 = **그날 일출 ~ 다음 날 일출**(서울, 분 단위). 다시보기는 방송이 걸친 모든 날에 보이고,
// 그날 칸에서 열면 그날이 시작하는 지점(일출)부터 재생한다. 처음엔 오전 6시 고정이었다가 같은 날 일출로 바꿨다 — 밤샘 방송은
// 해가 뜨기 전까지 '아직 어제'라는 감각에 맞고(겨울 아침 7~8시에 끝난 방송이 하루로 합쳐진다), 어느 편이 먼저 열리는지는
// 아래 dayFocus 규칙이 받친다. 일출은 05:11(하지 무렵)~07:47(1월 초) 사이를 오간다.
//  · 평소 방송(새벽 1~2시에 끝남)은 하루만 걸치므로 지금처럼 방송 시작일(vod_archive.broadcast_day) 한 칸에만 보인다.
//  · 며칠씩 이어진 방송(예: 2026-11-20 16:30 ~ 11-23 05:38, 다시보기 두 편)은 20·21·22일에 나뉘어 보인다.
//    예전에는 두 편 모두 시작일인 20일에만 붙어 21·22일 칸에서는 찾을 수 없었다.
//  · 둘째 날부터는 그날에 한 시간 이상 걸쳐야 보인다 — 일출 20분 뒤에 끝난 방송이 다음 날 칸에도 뜨지 않게.
//  · 한 방송이 여러 편으로 나뉜 경우(같은 방송 번호 broadcastNo — 길어서 끊긴 편, 중간이 사라진 편 포함)는 한 묶음이다.
//    묶음이 걸친 날마다 **모든 편**을 보여 주고(1부·2부…), 그날을 대표하는 편이 먼저 열린다(dayFocus·daySec — 아래 규칙).
//    그날과 겹치지 않는 편에는 dayExtra가 붙는다 — 좁은 화면 목록처럼 '그날 방송분만' 보여 줄 곳이 걸러 쓴다.
//    따로 켠 방송(다른 방송 번호)은 묶이지 않는다: N일 방송이 N+1일 아침 8시에 끝나고 저녁에 새로 켜면, N+1일 칸에는
//    앞 방송(그날 일출 지점부터)과 저녁 방송이 1부·2부로 함께 들어가고, N일 칸에는 앞 방송만 선다.
// 방송 시작 시각은 다시보기 등록 시각 − 길이(PublicVodEntry.startedAt)로, 방송 감지 기록과 분 단위까지 맞는다(실측).
// 총 방송시간 통계는 이 규칙과 무관하게 시작일 귀속 그대로다.
import { sunDay } from "@/components/shared/ambient/world/sun";

export const VOD_DAY_MIN_OVERLAP_MS = 60 * 60 * 1000;

// 이어진 방송의 뒤쪽 편으로 보는 한계 — 저장된 시작일보다 이만큼(일)까지 뒤면 실제 방송한 날로 옮긴다.
// 그보다 더 뒤는 나중에 올린 영상(예: 2025-10-25 방송을 10-29에 올린 편)으로 보고 저장된 날 그대로 둔다.
export const VOD_DAY_MAX_LATER = 2;

const DAY_MS = 86_400_000;
const KST_MS = 9 * 3_600_000;
// 한국 달력 날 번호(1970-01-01 = 0) ↔ 날짜 열쇠.
const dayNoOf = (dateKey: string) => Math.round(Date.parse(`${dateKey}T00:00:00Z`) / DAY_MS);
const keyOfDay = (d: number) => new Date(d * DAY_MS).toISOString().slice(0, 10);
// 그날이 시작하는 순간 = 그날 일출(서울, 분 단위로 내림). 태양 계산은 달력 배경이 쓰는 것과 같은 함수다.
const startCache = new Map<number, number>();
function dayStartMs(d: number): number {
  const hit = startCache.get(d);
  if (hit !== undefined) return hit;
  const date = new Date(d * DAY_MS);
  const rise = sunDay(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()).rise;
  const ms = d * DAY_MS - KST_MS + Math.floor(rise * 60) * 60_000;
  startCache.set(d, ms);
  return ms;
}
/** 그 날짜 칸의 하루가 시작하는 순간(그날 일출, ms). */
export function vodDayStartMs(dateKey: string): number {
  return dayStartMs(dayNoOf(dateKey));
}
/** 그날 일출 시각을 말로 — "오전 7시 19분". 안내 문구가 쓴다. */
export function vodDayStartLabel(dateKey: string): string {
  const k = new Date(vodDayStartMs(dateKey) + KST_MS);
  const h = k.getUTCHours();
  const m = k.getUTCMinutes();
  return `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}시${m ? ` ${m}분` : ""}`;
}

export type VodDaySource = { dateKey: string; durationMs: number; startedAt?: string; titleNo: number; broadcastNo?: number };
/** 날짜 칸 하나에 놓인 다시보기 — daySec = 이 날 칸에서 열 때 시작할 지점, dayFocus = 이 날 먼저 열 편, dayExtra = 이 날과 겹치지는 않는 같은 방송의 다른 편. */
export type VodDayMarks = { daySec?: number; dayFocus?: true; dayExtra?: true };
/** 그 다시보기가 보이는 날 하나 — sec = 그날 칸에서 열 때 시작할 지점(초). 첫날은 0. */
export type VodDay = { dateKey: string; sec: number };

// chained = 같은 방송의 여러 편 중 하나(방송 번호로 확인됨) — 저장된 날보다 며칠 뒤여도 나중에 올린 영상이 아니라 그 방송의 뒤쪽 편이다.
export function vodDays(vod: Pick<VodDaySource, "dateKey" | "durationMs" | "startedAt">, chained = false): VodDay[] {
  const anchor: VodDay[] = [{ dateKey: vod.dateKey, sec: 0 }];
  const start = vod.startedAt ? Date.parse(vod.startedAt) : Number.NaN;
  if (!Number.isFinite(start) || !(vod.durationMs > 0)) return anchor;
  const end = start + vod.durationMs;
  const keyOf = keyOfDay;
  // 시작·끝이 속한 날 — 일출 전이면 전날이다.
  const dayAt = (t: number) => {
    const d = Math.floor((t + KST_MS) / DAY_MS);
    return t < dayStartMs(d) ? d - 1 : d;
  };
  const first = dayAt(start);
  const last = dayAt(end - 1);
  // 하루에만 걸친 편 — 평소 방송은 저장된 시작일 그대로(새벽에 시작한 방송의 칸이 하루 당겨지지 않게).
  // 다만 이어진 방송의 뒤쪽 편(예: 11-13 14:30에 시작한 방송의 2부가 11-14 10:40~20:37)은 저장된 날이 방송 시작일(13일)이라
  // 그대로 두면 14일 칸에 14일 방송분이 없다 — 실제 방송한 날로 옮긴다.
  const single = (d: number): VodDay[] => {
    const later = Math.round((Date.parse(keyOf(d)) - Date.parse(vod.dateKey)) / DAY_MS);
    return later >= 1 && (chained || later <= VOD_DAY_MAX_LATER) ? [{ dateKey: keyOf(d), sec: 0 }] : anchor;
  };
  if (last <= first) return single(first);
  const days: (VodDay & { d: number })[] = [];
  for (let d = first; d <= last; d += 1) {
    const dayStart = dayStartMs(d);
    const overlap = Math.min(end, dayStartMs(d + 1)) - Math.max(start, dayStart);
    if (overlap < VOD_DAY_MIN_OVERLAP_MS) continue;
    days.push({ d, dateKey: keyOf(d), sec: Math.max(0, Math.floor((dayStart - start) / 1000)) });
  }
  // 하루만 남으면 하루에만 걸친 편과 같다.
  if (days.length === 1) return single(days[0].d);
  return days.length > 1 ? days.map(({ dateKey, sec }) => ({ dateKey, sec })) : anchor;
}

/** 날짜별 묶음. 며칠 걸친 다시보기는 걸친 날마다 들어가고, 한 방송의 여러 편은 그 방송이 걸친 날마다 모두 들어간다. 날 안에서는 방송 시작 순. */
export function groupVodsByDay<T extends VodDaySource>(vods: readonly T[]): Map<string, (T & VodDayMarks)[]> {
  const map = new Map<string, (T & VodDayMarks)[]>();
  const put = (dateKey: string, entry: T & VodDayMarks) => {
    const list = map.get(dateKey);
    if (list) list.push(entry);
    else map.set(dateKey, [entry]);
  };
  const startOf = (v: VodDaySource) => (v.startedAt ? Date.parse(v.startedAt) : Number.NaN);
  const byStart = (a: VodDaySource, b: VodDaySource) => {
    const sa = startOf(a);
    const sb = startOf(b);
    if (Number.isFinite(sa) && Number.isFinite(sb) && sa !== sb) return sa - sb;
    return a.titleNo - b.titleNo;
  };
  // 한 방송의 여러 편(방송 번호가 같고 두 편 이상).
  const chains = new Map<number, T[]>();
  for (const vod of vods) {
    if (!vod.broadcastNo) continue;
    const list = chains.get(vod.broadcastNo);
    if (list) list.push(vod);
    else chains.set(vod.broadcastNo, [vod]);
  }
  const done = new Set<number>();
  for (const vod of vods) {
    const chain = vod.broadcastNo ? chains.get(vod.broadcastNo) : undefined;
    if (!chain || chain.length < 2) {
      for (const day of vodDays(vod)) put(day.dateKey, day.sec > 0 ? { ...vod, daySec: day.sec } : vod);
      continue;
    }
    if (done.has(vod.broadcastNo!)) continue;
    done.add(vod.broadcastNo!);
    const members = [...chain].sort(byStart);
    const own = members.map((m) => vodDays(m, true));
    const days = [...new Set(own.flatMap((list) => list.map((d) => d.dateKey)))].sort();
    for (const dateKey of days) {
      const hits = own.map((list) => list.find((d) => d.dateKey === dateKey));
      members.forEach((m, i) => {
        const hit = hits[i];
        put(dateKey, {
          ...m,
          ...(hit && hit.sec > 0 ? { daySec: hit.sec } : {}),
          ...(hit ? {} : { dayExtra: true as const })
        });
      });
    }
  }
  // ── 그날 먼저 열 편(dayFocus) — 편이 둘 이상인 날에만 정한다. 순서는 늘 방송 시작 순(1부·2부…)이고, 여는 편만 고른다. ──
  //  ① 그날 **새로 켠 방송**이 있으면 그 방송의 첫 편을 처음부터(여럿이면 가장 먼저 켠 것). 전날에서 넘어온 방송이
  //     아침까지 이어졌더라도, 그날을 대표하는 것은 그날 켠 방송이다.
  //  ② 없으면(전날부터 이어진 방송만 있는 날) **그날 가장 오래 나온 편**. 그 편이 그날 일출 전에 시작했으면 일출
  //     지점부터(daySec), 그날 안에 시작했으면 처음부터. 예: 11-13 14:30에 켠 방송이 14일 10:40에 2부로 끊겼으면 14일은
  //     2부(14일에 10시간)가 먼저 열린다 — 스트리머가 붙인 썸네일 날짜(1부 = 13일, 2부 = 14일)와도 맞는다. 20일에 켠 60시간
  //     방송의 21일은 1부가 일출 지점부터, 22일은 2부가 일출 지점부터다.
  //  시작 시각을 모르는 편(업로드 영상 등)은 고르지 않는다 — 고를 편이 없으면 표시 없이 첫 편이 열린다.
  const chained = (v: VodDaySource) => Boolean(v.broadcastNo && (chains.get(v.broadcastNo)?.length ?? 0) > 1);
  const firstOfBroadcast = (v: VodDaySource) =>
    !chained(v) || [...chains.get(v.broadcastNo!)!].sort(byStart)[0].titleNo === v.titleNo;
  for (const [dateKey, list] of map) {
    list.sort(byStart);
    if (list.length < 2) continue;
    const dayNo = dayNoOf(dateKey);
    const dayStart = dayStartMs(dayNo);
    const dayEnd = dayStartMs(dayNo + 1);
    const info = list.map((v) => {
      const start = startOf(v);
      const end = start + v.durationMs;
      const known = Number.isFinite(start) && v.durationMs > 0;
      return {
        fresh: known && !v.dayExtra && start >= dayStart && start < dayEnd && firstOfBroadcast(v),
        cover: known && !v.dayExtra ? Math.max(0, Math.min(end, dayEnd) - Math.max(start, dayStart)) : 0
      };
    });
    let focus = info.findIndex((x) => x.fresh);
    if (focus < 0) {
      let best = 0;
      info.forEach((x, i) => {
        if (x.cover > best) {
          best = x.cover;
          focus = i;
        }
      });
    }
    if (focus >= 0) list[focus] = { ...list[focus], dayFocus: true as const };
  }
  return map;
}

/** 다시보기마다 달력에 보이는 날 전부(같은 방송의 다른 편 때문에 보이는 날 포함) — 창 필터가 쓴다. */
export function vodShownDays(vods: readonly VodDaySource[]): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const [dateKey, list] of groupVodsByDay(vods)) {
    for (const vod of list) {
      const days = out.get(vod.titleNo);
      if (days) days.push(dateKey);
      else out.set(vod.titleNo, [dateKey]);
    }
  }
  return out;
}

/** 그 다시보기가 이 날짜 칸에 보이는가. 아니면 보이는 첫 날을 돌려준다(검색 결과가 옛 시작일을 들고 올 때). */
export function vodDayFor(vod: Pick<VodDaySource, "dateKey" | "durationMs" | "startedAt">, dateKey: string): string {
  const days = vodDays(vod);
  return days.some((d) => d.dateKey === dateKey) ? dateKey : days[0].dateKey;
}
