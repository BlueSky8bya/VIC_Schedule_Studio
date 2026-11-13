"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { isDeveloperOrFixture } from "@/lib/auth/fixture-dev";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { getOwnerEmails, normalizeEmail } from "@/lib/auth/config";
import { canEditSchedule } from "@/lib/permissions/roles";
import { isInsightsSystem } from "@/lib/insights/system-context";
import { kstDayKey } from "@/lib/calendar/month";

// 개발자 전용 "월별 인사이트" — 보고 있는 달(year/month) 기준 집계.
// 모든 값은 합계/개수만 — 비공개·owner_private 일정의 내용은 절대 내보내지 않는다.
// "나만"(owner_private)은 카운트 제외. "휴뱅"(방송을 안 한 표시) 태그가 붙은 일정은
// 콘텐츠/방송 집계에서 제외한다.

const SLUG = "vic";
const REST_TAG = "휴뱅";
// '기타'는 더는 실제 태그가 아니다 — 태그를 하나도 안 단 공개 일정(휴뱅 제외)을 인사이트에서만
// 묶는 합성 버킷. 실제 태그 id와 겹치지 않게 예약 키를 쓰고, 색은 흰 카드에 맞춘 중립 회색.
const ETC_KEY = "__etc__";
const ETC_LABEL = "기타";
const ETC_COLOR = "#d4d4d8";

// 2계층 태그 통계 롤업: 태그 id → 최상위 대분류 {id, name, colorKey}. 세부는 부모 대분류로 합산되어
// 통계가 잘게 쪼개지지 않는다(예: 게임>롤·명조·실크송 → '게임' 하나로). 휴뱅 등 대분류는 자기 자신.
async function loadTagCategoryMap(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  calendarId: string
): Promise<Map<string, { id: string; name: string; colorKey: string; bgHex: string | null; kind: string }>> {
  const { data } = await supabase
    .from("broadcast_tags")
    .select("id, parent_id, display_name, color_key, bg_hex, kind")
    .eq("calendar_id", calendarId);
  const rows = (data ?? []) as {
    id: string;
    parent_id: string | null;
    display_name: string;
    color_key: string;
    bg_hex: string | null;
    kind: string | null;
  }[];
  const byId = new Map(rows.map((r) => [r.id, r] as const));
  const cat = new Map<string, { id: string; name: string; colorKey: string; bgHex: string | null; kind: string }>();
  for (const r of rows) {
    let top = r;
    const guard = new Set<string>();
    while (top.parent_id && byId.has(top.parent_id) && !guard.has(top.id)) {
      guard.add(top.id);
      top = byId.get(top.parent_id)!;
    }
    // 최상위 대분류 기준 — kind는 대분류의 kind(content/modifier). bg_hex(커스텀 색)도 대분류 것.
    cat.set(r.id, {
      id: top.id,
      name: top.display_name,
      colorKey: top.color_key,
      bgHex: top.bg_hex ?? null,
      kind: top.kind === "modifier" ? "modifier" : "content"
    });
  }
  return cat;
}

export type InsightsData = {
  month: { year: number; month: number };
  content: {
    nextBroadcast: { dateKey: string; titles: string[] } | null; // 다음 방송(휴뱅 제외, 같은 날 여러 개)
    thisMonthContent: number; // 이번 달 컨텐츠 수(공개·휴뱅 제외)
    lastMonthContent: number; // 지난 달(추세 비교)
    daysWithContent: number; // 컨텐츠 있는 날 수
    restDays: number; // 휴뱅(방송 안 함) 날 수
    busiestWeekday: number | null; // 0=일..6=토
    quietestWeekday: number | null;
    tags: { name: string; count: number; bgColor: string; borderColor: string }[]; // 컨텐츠 순위
  };
  engagement: {
    monthHearts: number; // 이 달 일정이 받은 하트
    totalHearts: number; // 전체 공개 일정 누적 하트
    monthly: { ym: string; count: number }[]; // 6개월(타깃 월로 끝남)
    topEvents: { title: string; count: number }[]; // 이 달 인기 일정 TOP
  };
  // (보안·시스템 패널은 2026-11-13 설정 창으로 옮겼다 — getOwnerSecurityAction·getSystemInfoAction.)
};

export type InsightsResult = { ok: true; data: InsightsData } | { ok: false; error: string };

// '오늘(KST)' 키는 단일 출처(kstDayKey)를 쓴다 — 적재(day 컬럼)와 조회가 어긋나지 않게.
const todayKstKey = (): string => kstDayKey();
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function weekdayOf(dateKey: string): number {
  const [yy, mm, dd] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
}
// 제목은 첫 줄(첫 엔터 직전)까지만 — 일정 추가 시 엔터로 세부를 다음 줄에 적는 경우 대비.
function firstLine(s: string): string {
  return (s ?? "").split("\n")[0].trim();
}
// user_id → 이메일. 예전엔 사람 수만큼 auth.admin.getUserById()를 불러(한 곳은 for+await 직렬)
// GoTrue를 N번 왕복했다. 계정 목록을 **한 번** 받아 채워두고, 그래도 없는 id만 개별로 묻는다.
// (호출 단위 캐시 — 액션 하나가 끝나면 사라진다. 인사이트는 개발자·오너만 여는 화면이라 충분.)
function makeEmailResolver(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>
): (id: string | null | undefined) => Promise<string | null> {
  const cache = new Map<string, string | null>();
  let primed: Promise<void> | null = null;
  const prime = () => {
    if (!primed) {
      primed = (async () => {
        try {
          // 이 앱의 계정은 오너·개발자·신뢰 멤버뿐이라 한 페이지면 충분하다(넘치면 아래 개별 조회).
          const { data } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          for (const u of data?.users ?? []) {
            if (u.id) cache.set(u.id, normalizeEmail(u.email));
          }
        } catch {
          /* 목록 조회 실패 → 개별 조회로 물러난다 */
        }
      })();
    }
    return primed;
  };
  return async (id) => {
    if (!id) return null;
    if (cache.has(id)) return cache.get(id) ?? null;
    await prime();
    if (cache.has(id)) return cache.get(id) ?? null;
    let email: string | null = null;
    try {
      const { data } = await supabase.auth.admin.getUserById(id);
      email = normalizeEmail(data?.user?.email);
    } catch {
      email = null;
    }
    cache.set(id, email);
    return email;
  };
}


export async function getInsightsAction(year: number, month: number): Promise<InsightsResult> {
  // 연간 아카이브(0160)는 서버 시스템 문맥에서 같은 집계를 부른다 — lib/insights/system-context.ts.
  if (!isInsightsSystem() && !isDeveloperOrFixture(await resolveCurrentActor(SLUG))) {
    return { ok: false, error: "개발자만 볼 수 있는 화면입니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }
  const { data: cal } = await supabase
    .from("calendars")
    .select("id, owner_id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (!cal) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }
  const calendarId = cal.id as string;

  const y = year;
  const m = month;
  const monthStart = `${y}-${pad(m)}-01`;
  const nextMonthStart = ymd(new Date(Date.UTC(y, m, 1)));
  const lastMonthStart = ymd(new Date(Date.UTC(y, m - 2, 1)));
  const todayKey = todayKstKey();
  const curYm = `${y}-${pad(m)}`;

  const [eventsRangeRes, tagsRangeRes, nextRes, paletteRes, heartCountsRes] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, date_key, is_public")
        .is("deleted_at", null) // tombstone 제외(P0-DATA-1)
        .eq("calendar_id", calendarId)
        .gte("date_key", lastMonthStart)
        .lt("date_key", nextMonthStart),
      supabase
        .from("event_tags")
        .select("event_id, broadcast_tags(id, display_name, color_key), events!inner(calendar_id, date_key)")
        .eq("events.calendar_id", calendarId)
        .gte("events.date_key", monthStart)
        .lt("events.date_key", nextMonthStart),
      supabase
        .from("events")
        .select("date_key, public_title, event_tags(broadcast_tags(display_name))")
        .is("deleted_at", null)
        .eq("calendar_id", calendarId)
        .eq("is_public", true)
        .gte("date_key", todayKey)
        .order("date_key", { ascending: true })
        .limit(40),
      supabase.from("color_palette").select("key, bg_color, border_color").eq("calendar_id", calendarId),
      supabase.rpc("get_event_heart_counts", { p_calendar_id: calendarId })
    ]);

  // 휴뱅(방송 안 함) 일정 id 집합 — 콘텐츠/방송 집계에서 제외.
  const catMap = await loadTagCategoryMap(supabase, calendarId); // 세부→대분류 롤업
  const tagsRange = (tagsRangeRes.data ?? []) as {
    event_id: string;
    broadcast_tags?: { id?: string; display_name?: string; color_key?: string };
  }[];
  const restEventIds = new Set<string>();
  for (const row of tagsRange) {
    if (row.broadcast_tags?.display_name === REST_TAG) restEventIds.add(row.event_id);
  }

  const eventsRange = (eventsRangeRes.data ?? []) as {
    id: string;
    date_key: string;
    is_public: boolean;
  }[];
  const isContent = (e: { id: string; is_public: boolean }) =>
    e.is_public && !restEventIds.has(e.id);
  const thisMonthEvents = eventsRange.filter(
    (e) => e.date_key >= monthStart && e.date_key < nextMonthStart && isContent(e)
  );
  const lastMonthEvents = eventsRange.filter(
    (e) => e.date_key >= lastMonthStart && e.date_key < monthStart && isContent(e)
  );
  const thisMonthContent = thisMonthEvents.length;
  const lastMonthContent = lastMonthEvents.length;
  const daysWithContent = new Set(thisMonthEvents.map((e) => e.date_key)).size;
  const restDays = new Set(
    eventsRange
      .filter((e) => e.date_key >= monthStart && e.date_key < nextMonthStart && restEventIds.has(e.id))
      .map((e) => e.date_key)
  ).size;

  const wd = Array(7).fill(0) as number[];
  for (const e of thisMonthEvents) wd[weekdayOf(e.date_key)] += 1;
  const maxWd = Math.max(...wd);
  const minWd = Math.min(...wd);
  const busiestWeekday = thisMonthContent > 0 ? wd.indexOf(maxWd) : null;
  const quietestWeekday =
    thisMonthContent > 0 && maxWd !== minWd ? wd.indexOf(minWd) : null;

  // 이번 달 컨텐츠 순위(태그) — 휴뱅 태그 자체는 제외, 실제 색 입힘.
  const colorMap = new Map<string, { bg: string; border: string }>();
  for (const c of paletteRes.data ?? []) {
    colorMap.set((c as { key: string }).key, {
      bg: (c as { bg_color: string }).bg_color,
      border: (c as { border_color: string }).border_color
    });
  }
  const thisMonthContentIds = new Set(thisMonthEvents.map((e) => e.id));
  // 2계층: 세부는 대분류로 합산(게임>롤·명조 → '게임'). 휴뱅은 제외.
  const tagMap = new Map<string, { name: string; count: number; bgColor: string; borderColor: string }>();
  for (const row of tagsRange) {
    const rawName = row.broadcast_tags?.display_name;
    if (!rawName || rawName === REST_TAG) continue;
    if (!thisMonthContentIds.has(row.event_id)) continue;
    const id = row.broadcast_tags?.id;
    const cat = (id && catMap.get(id)) || {
      id: id ?? rawName,
      name: rawName,
      colorKey: row.broadcast_tags?.color_key ?? "",
      bgHex: null,
      kind: "content"
    };
    if (cat.name === REST_TAG) continue;
    if (cat.kind === "modifier") continue; // 수식어(합방·시참 등)는 컨텐츠 순위서 제외
    const cur = tagMap.get(cat.id);
    if (cur) cur.count += 1;
    else {
      const col = colorMap.get(cat.colorKey);
      tagMap.set(cat.id, {
        name: cat.name,
        count: 1,
        bgColor: cat.bgHex ?? col?.bg ?? "#cdc6ec",
        borderColor: col?.border ?? "#b3a9dd"
      });
    }
  }
  const tags = [...tagMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  // 다음 방송(휴뱅 제외) — 가장 이른 날, 그 날의 일정 제목들.
  const upcoming = (nextRes.data ?? []) as {
    date_key: string;
    public_title: string;
    event_tags?: { broadcast_tags?: { display_name?: string } }[];
  }[];
  const byDate = new Map<string, string[]>();
  for (const ev of upcoming) {
    const isRest = (ev.event_tags ?? []).some(
      (t) => t.broadcast_tags?.display_name === REST_TAG
    );
    if (isRest) continue;
    const list = byDate.get(ev.date_key) ?? [];
    list.push(firstLine(ev.public_title));
    byDate.set(ev.date_key, list);
  }
  const firstDate = [...byDate.keys()].sort()[0];
  const nextBroadcast = firstDate ? { dateKey: firstDate, titles: byDate.get(firstDate)! } : null;

  // 참여(하트) — 이 달 일정 기준. 하트가 달린 일정의 날짜를 받아 월별로 묶는다.
  const heartCounts = (heartCountsRes.data ?? []) as { event_id: string; count: number }[];
  const totalHearts = heartCounts.reduce((s, r) => s + Number(r.count), 0);
  const infoMap = new Map<string, { dateKey: string; title: string }>();
  if (heartCounts.length > 0) {
    const { data: rows } = await supabase
      .from("events")
      .select("id, date_key, public_title, is_public")
      .is("deleted_at", null)
      .in("id", heartCounts.map((h) => h.event_id));
    for (const e of rows ?? []) {
      if ((e as { is_public?: boolean }).is_public) {
        infoMap.set((e as { id: string }).id, {
          dateKey: (e as { date_key: string }).date_key,
          title: (e as { public_title: string }).public_title
        });
      }
    }
  }
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  const monthlyMap = new Map<string, number>(monthKeys.map((k) => [k, 0]));
  let monthHearts = 0;
  const topThisMonth: { title: string; count: number }[] = [];
  for (const h of heartCounts) {
    const info = infoMap.get(h.event_id);
    if (!info) continue;
    const ym = info.dateKey.slice(0, 7);
    if (monthlyMap.has(ym)) monthlyMap.set(ym, (monthlyMap.get(ym) ?? 0) + Number(h.count));
    if (ym === curYm) {
      monthHearts += Number(h.count);
      topThisMonth.push({ title: firstLine(info.title), count: Number(h.count) });
    }
  }
  const monthly = monthKeys.map((k) => ({ ym: k, count: monthlyMap.get(k) ?? 0 }));
  const topEvents = topThisMonth.sort((a, b) => b.count - a.count).slice(0, 5);

  return {
    ok: true,
    data: {
      month: { year: y, month: m },
      content: {
        nextBroadcast,
        thisMonthContent,
        lastMonthContent,
        daysWithContent,
        restDays,
        busiestWeekday,
        quietestWeekday,
        tags
      },
      engagement: { monthHearts, totalHearts, monthly, topEvents }
    }
  };
}

// 시스템 정보(개발자 전용) — 설정 창 '개발자' 묶음이 열릴 때만 부른다(2026-11-13 인사이트에서 이동).
// 계정 목록 조회(listUsers)가 무거워 인사이트를 열 때마다 하지 않는다.
export type SystemInfo = {
  ownerEmails: string[];
  developerEmails: string[];
  dbOwnerEmail: string | null;
  bindingOk: boolean;
  commit: string | null;
  deployedAt: string; // 빌드(배포) 시각
};
export type SystemInfoResult = { ok: true; data: SystemInfo } | { ok: false; error: string };

export async function getSystemInfoAction(): Promise<SystemInfoResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!isDeveloperOrFixture(actor)) {
    return { ok: false, error: "개발자만 볼 수 있어요." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }
  const { data: cal } = await supabase.from("calendars").select("owner_id").eq("slug", SLUG).maybeSingle();
  if (!cal) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }

  // 이메일 해석 — 계정 목록을 한 번 받아 채우고 필요한 것만 개별 조회(위 makeEmailResolver).
  const emailFor = makeEmailResolver(supabase);
  const ownerEmails = getOwnerEmails();
  const [dbOwnerEmail, { data: adminRows }] = await Promise.all([
    emailFor(cal.owner_id as string | undefined),
    // 개발자(platform_admins) 이메일.
    supabase.from("platform_admins").select("email")
  ]);
  const developerEmails = [
    ...new Set(
      ((adminRows ?? []) as { email?: string }[])
        .map((a) => normalizeEmail(a.email))
        .filter((e): e is string => Boolean(e))
    )
  ];
  return {
    ok: true,
    data: {
      ownerEmails,
      developerEmails,
      dbOwnerEmail,
      bindingOk: Boolean(ownerEmails[0] && dbOwnerEmail && ownerEmails[0] === dbOwnerEmail),
      commit: process.env.APP_COMMIT && process.env.APP_COMMIT !== "dev" ? process.env.APP_COMMIT.slice(0, 7) : null,
      // 빌드(배포) 시각 — next.config의 BUILD_TIME(빌드 시점 UTC). 로컬은 현재 시각으로 폴백.
      deployedAt: process.env.BUILD_TIME ?? new Date().toISOString()
    }
  };
}

// 카테고리(태그/역할/기기)별 6개월 누적 막대 트렌드. months[i].counts[catKey] = 그 달 그 카테고리 값.
export type TrendStack = {
  cats: { key: string; label: string; color: string }[];
  months: { ym: string; counts: Record<string, number>; total: number }[];
};
export type TrendData = {
  months: string[]; // 6개월(YYYY-MM, 오래된→최신, 타깃 월로 끝남)
  content: number[]; // 휴뱅 제외 공개 일정
  broadcastHours: number[]; // 6개월 월별 총 방송시간(시간, 소수 1자리) — start_day(시작일) 귀속
  broadcastDaily: number[]; // 보는 달 1..말일 일별 방송시간(시간) — 시작일 귀속, 자정 넘겨도 시작일에 통째
  broadcastDays: number; // 보는 달에 방송한 날 수(방송시간>0)
  contentByTag: TrendStack; // 콘텐츠 대분류별 6개월(휴뱅 포함)
  modifierByTag: TrendStack; // 방식(합방·시참 등)별 6개월
  heartsByTag: TrendStack; // 하트 받은 태그 6개월 — 일정당 평균 하트(비율, 방영월 기준)
  // (방문 수·역할별 방문·기기별 접속은 2026-11-13 방문 기록 철수와 함께 뺐다.)
};

// 카테고리별 6개월 누적 트렌드를 만든다. rows: {ym, key, n}. cats: 표시 순서/이름/색.
function buildTrendStack(
  monthKeys: string[],
  cats: { key: string; label: string; color: string }[],
  rows: { ym: string; key: string; n: number }[]
): TrendStack {
  const months = monthKeys.map((ym) => ({
    ym,
    counts: Object.fromEntries(cats.map((c) => [c.key, 0])) as Record<string, number>,
    total: 0
  }));
  const idx = new Map(monthKeys.map((k, i) => [k, i]));
  for (const r of rows) {
    const i = idx.get(r.ym);
    if (i === undefined || !(r.key in months[i].counts)) continue;
    months[i].counts[r.key] += r.n;
    months[i].total += r.n;
  }
  return { cats, months };
}
export type TrendResult = { ok: true; data: TrendData } | { ok: false; error: string };

type BcastRow = {
  start_day: string;
  started_at: string;
  last_live_at: string;
  ended_at: string | null;
};
// 방송시간 집계(트렌드·멤버 인사이트 공용) — 시작일(start_day) 귀속. 유효시간 = coalesce(ended_at,
// last_live_at) - started_at. 진행 중(ended_at null)은 last_live_at까지 잠정 집계.
function computeBroadcast(
  bcastRows: BcastRow[],
  monthKeys: string[],
  year: number,
  month: number
): { broadcastHours: number[]; broadcastDaily: number[]; broadcastDays: number } {
  const bMonthSec = new Map(monthKeys.map((k) => [k, 0]));
  const bDaySec = new Map<number, number>(); // 보는 달 일별(일=1..말일)
  for (const r of bcastRows) {
    const start = new Date(r.started_at).getTime();
    const end = new Date(r.ended_at ?? r.last_live_at).getTime();
    const sec =
      Number.isFinite(start) && Number.isFinite(end) && end > start ? (end - start) / 1000 : 0;
    if (sec <= 0) continue;
    const ym = r.start_day.slice(0, 7);
    if (bMonthSec.has(ym)) bMonthSec.set(ym, (bMonthSec.get(ym) ?? 0) + sec);
    if (ym === `${year}-${pad(month)}`) {
      const d = Number(r.start_day.slice(8, 10));
      bDaySec.set(d, (bDaySec.get(d) ?? 0) + sec);
    }
  }
  // 반올림 자릿수는 시청자 '이 달 기록'의 공개 RPC(0049 월별 1자리 / 0050 일별 2자리)와 같게 —
  // 예전엔 일별도 1자리라 같은 날이 편집실 13.1h(13시간 6분), 시청자 13.13h(13시간 8분)로 달랐다.
  const round1 = (h: number) => Math.round(h * 10) / 10;
  const round2 = (h: number) => Math.round(h * 100) / 100;
  const daysInViewMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const broadcastHours = monthKeys.map((k) => round1((bMonthSec.get(k) ?? 0) / 3600));
  const broadcastDaily = Array.from({ length: daysInViewMonth }, (_, i) =>
    round2((bDaySec.get(i + 1) ?? 0) / 3600)
  );
  // 방송일수도 시청자 화면과 같은 정의(일별 값 > 0)로 — 원본 초 단위로 세면 반올림 후
  // 0.00h인 몇 초짜리 세션이 하루로 잡혀 일평균 분모가 어긋난다.
  const broadcastDays = broadcastDaily.filter((h) => h > 0).length;
  return { broadcastHours, broadcastDaily, broadcastDays };
}

type VodFallbackRow = { broadcast_day: string; duration_ms: number; reg_date: string | null };
// 세션 기록이 없는 날의 방송시간을 다시보기(VOD) 길이로 채운다(0070 공개 RPC와 동일 규칙).
// broadcast_session은 2026-06 도입이라 그 이전 시대는 통째로 비어 있었다 — vod_archive(0068)의
// 길이·등록시각으로 유사 세션 행을 만들어 잇는다. **세션이 있는 날은 세션이 정답**(이중 집계 금지).
function mergeVodFallback(sess: BcastRow[], vods: VodFallbackRow[]): BcastRow[] {
  const sessDays = new Set(sess.map((r) => r.start_day.slice(0, 10)));
  const out = [...sess];
  for (const v of vods) {
    const day = String(v.broadcast_day).slice(0, 10);
    if (v.reg_date === null || sessDays.has(day)) continue;
    const endMs = Date.parse(v.reg_date);
    if (!Number.isFinite(endMs) || !(v.duration_ms > 0)) continue;
    out.push({
      start_day: day,
      started_at: new Date(endMs - v.duration_ms).toISOString(),
      last_live_at: v.reg_date,
      ended_at: v.reg_date
    });
  }
  return out;
}

// 트렌드 패널용 — 컨텐츠·방송시간·태그의 최근 6개월 월별 추이. (하트 6개월은 getInsightsAction이 이미 줌.)
export async function getTrendAction(year: number, month: number): Promise<TrendResult> {
  if (!isInsightsSystem() && !isDeveloperOrFixture(await resolveCurrentActor(SLUG))) {
    return { ok: false, error: "개발자만 볼 수 있는 화면입니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }
  const { data: cal } = await supabase
    .from("calendars")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (!cal) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }
  const calendarId = cal.id as string;

  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  const fromStart = `${monthKeys[0]}-01`;
  const nextMonthStart = ymd(new Date(Date.UTC(year, month, 1)));

  const [eventsRes, tagsRes, paletteRes, heartsRes, bcastRes, vodRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, date_key")
      .is("deleted_at", null)
      .eq("calendar_id", calendarId)
      .eq("is_public", true)
      .gte("date_key", fromStart)
      .lt("date_key", nextMonthStart),
    supabase
      .from("event_tags")
      .select("event_id, broadcast_tags(id, display_name, color_key), events!inner(calendar_id, date_key)")
      .eq("events.calendar_id", calendarId)
      .gte("events.date_key", fromStart)
      .lt("events.date_key", nextMonthStart),
    supabase.from("color_palette").select("key, bg_color").eq("calendar_id", calendarId),
    supabase.rpc("get_event_heart_counts", { p_calendar_id: calendarId }),
    supabase
      .from("broadcast_session")
      .select("start_day, started_at, last_live_at, ended_at")
      .gte("start_day", fromStart)
      .lt("start_day", nextMonthStart),
    // 세션 이전 시대(≤2026-05) 방송시간 폴백용 다시보기 길이(0068) — mergeVodFallback가 합친다.
    supabase
      .from("vod_archive")
      .select("broadcast_day, duration_ms, reg_date")
      .eq("guest", false) // 합방 게스트 출연분(0075)은 토리님 방송시간이 아니다
      .eq("upload", false) // 업로드 영상(0156)도 방송시간이 아니다
      .gte("broadcast_day", fromStart)
      .lt("broadcast_day", nextMonthStart)
  ]);

  const catMap = await loadTagCategoryMap(supabase, calendarId); // 세부→대분류 롤업
  const tagRows2 = (tagsRes.data ?? []) as {
    event_id: string;
    broadcast_tags?: { id?: string; display_name?: string; color_key?: string };
  }[];
  const restIds = new Set<string>();
  for (const row of tagRows2) {
    if (row.broadcast_tags?.display_name === REST_TAG) restIds.add(row.event_id);
  }
  const eventMonth = new Map<string, string>();
  const cMap = new Map(monthKeys.map((k) => [k, 0]));
  for (const e of eventsRes.data ?? []) {
    const id = (e as { id: string }).id;
    const ym = (e as { date_key: string }).date_key.slice(0, 7);
    eventMonth.set(id, ym);
    if (restIds.has(id)) continue;
    if (cMap.has(ym)) cMap.set(ym, (cMap.get(ym) ?? 0) + 1);
  }

  // 태그별 컨텐츠 6개월(휴뱅 포함) — 태그 id 기준 집계(rename은 현재 이름으로 자동 반영).
  const palette = new Map<string, string>();
  for (const c of paletteRes.data ?? []) {
    palette.set((c as { key: string }).key, (c as { bg_color: string }).bg_color);
  }
  const tagInfo = new Map<string, { name: string; color: string; total: number }>();
  const contentTagRows: { ym: string; key: string; n: number }[] = [];
  const contentEventIds = new Set<string>(); // 콘텐츠 대분류를 1개 이상 단 공개 일정
  for (const row of tagRows2) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id); // 공개 일정만(비공개는 매핑 없음 → 제외)
    if (!bt?.id || !ym) continue;
    const cat = catMap.get(bt.id) ?? {
      id: bt.id,
      name: bt.display_name ?? "?",
      colorKey: bt.color_key ?? "",
      bgHex: null,
      kind: "content"
    };
    if (cat.kind === "modifier") continue; // 수식어는 컨텐츠 트렌드서 제외
    contentEventIds.add(row.event_id);
    contentTagRows.push({ ym, key: cat.id, n: 1 });
    const cur = tagInfo.get(cat.id);
    if (cur) cur.total += 1;
    else
      tagInfo.set(cat.id, {
        name: cat.name,
        color: cat.bgHex ?? palette.get(cat.colorKey) ?? "#cdc6ec",
        total: 1
      });
  }
  const contentCats = [...tagInfo.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, v]) => ({ key, label: v.name, color: v.color }));
  // 콘텐츠 태그 0개인 공개 일정(휴뱅 제외) = 합성 '기타'. 항상 맨 끝에 붙인다.
  let etcTotal = 0;
  for (const [id, ym] of eventMonth) {
    if (restIds.has(id) || contentEventIds.has(id)) continue;
    contentTagRows.push({ ym, key: ETC_KEY, n: 1 });
    etcTotal += 1;
  }
  if (etcTotal > 0) contentCats.push({ key: ETC_KEY, label: ETC_LABEL, color: ETC_COLOR });

  // 방식(modifier)별 6개월 — 콘텐츠와 별개 축(합방·시참·연습 등 얼마나 자주 했나).
  const modInfo = new Map<string, { name: string; color: string; total: number }>();
  const modTagRows: { ym: string; key: string; n: number }[] = [];
  for (const row of tagRows2) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id);
    if (!bt?.id || !ym) continue;
    const cat = catMap.get(bt.id) ?? {
      id: bt.id,
      name: bt.display_name ?? "?",
      colorKey: bt.color_key ?? "",
      bgHex: null,
      kind: "content"
    };
    if (cat.kind !== "modifier") continue;
    modTagRows.push({ ym, key: cat.id, n: 1 });
    const cur = modInfo.get(cat.id);
    if (cur) cur.total += 1;
    else
      modInfo.set(cat.id, {
        name: cat.name,
        color: cat.bgHex ?? palette.get(cat.colorKey) ?? "#cdc6ec",
        total: 1
      });
  }
  const modCats = [...modInfo.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, v]) => ({ key, label: v.name, color: v.color }));

  // 하트 받은 태그 6개월 — '일정당 평균 하트'(비율). 하트 총합이면 일정 수가 많은 태그가
  // 구조적으로 항상 1등이라, 그 달 그 태그 일정 수로 나눈다(하트 0 일정도 분모에 포함).
  const heartByEvent = new Map<string, number>();
  for (const r of (heartsRes.data ?? []) as { event_id: string; count: number }[]) {
    heartByEvent.set(r.event_id, Number(r.count));
  }
  const heartTagInfo = new Map<string, { name: string; color: string; h: number; e: number }>();
  const heartAgg = new Map<string, { h: number; e: number }>(); // `${ym}|${catId}`
  const heartSeen = new Set<string>(); // `${eventId}|${catId}` — 세부 태그 2개가 같은 대분류면 1번만
  for (const row of tagRows2) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id);
    if (!bt?.id || !ym) continue;
    const cat = catMap.get(bt.id) ?? {
      id: bt.id,
      name: bt.display_name ?? "?",
      colorKey: bt.color_key ?? "",
      bgHex: null,
      kind: "content"
    };
    if (cat.kind === "modifier") continue; // 수식어는 태그별 하트 트렌드서 제외
    const dedup = `${row.event_id}|${cat.id}`;
    if (heartSeen.has(dedup)) continue;
    heartSeen.add(dedup);
    const h = heartByEvent.get(row.event_id) ?? 0;
    const aggKey = `${ym}|${cat.id}`;
    const agg = heartAgg.get(aggKey) ?? { h: 0, e: 0 };
    agg.h += h;
    agg.e += 1;
    heartAgg.set(aggKey, agg);
    const cur = heartTagInfo.get(cat.id);
    if (cur) {
      cur.h += h;
      cur.e += 1;
    } else
      heartTagInfo.set(cat.id, {
        name: cat.name,
        color: cat.bgHex ?? palette.get(cat.colorKey) ?? "#f7a8c0",
        h,
        e: 1
      });
  }
  const heartTagRows: { ym: string; key: string; n: number }[] = [...heartAgg.entries()].map(
    ([k, v]) => ({
      ym: k.slice(0, 7),
      key: k.slice(8),
      n: Math.round((v.h / Math.max(1, v.e)) * 10) / 10
    })
  );
  const heartCats = [...heartTagInfo.entries()]
    .filter(([, v]) => v.h > 0) // 6개월 내 하트 0인 태그는 기존처럼 차트에서 제외
    .sort((a, b) => b[1].h / b[1].e - a[1].h / a[1].e)
    .map(([key, v]) => ({ key, label: v.name, color: v.color }));

  const { broadcastHours, broadcastDaily, broadcastDays } = computeBroadcast(
    mergeVodFallback(
      (bcastRes.data ?? []) as BcastRow[],
      (vodRes.data ?? []) as VodFallbackRow[]
    ),
    monthKeys,
    year,
    month
  );

  return {
    ok: true,
    data: {
      months: monthKeys,
      content: monthKeys.map((k) => cMap.get(k) ?? 0),
      broadcastHours,
      broadcastDaily,
      broadcastDays,
      contentByTag: buildTrendStack(monthKeys, contentCats, contentTagRows),
      modifierByTag: buildTrendStack(monthKeys, modCats, modTagRows),
      heartsByTag: buildTrendStack(monthKeys, heartCats, heartTagRows)
    }
  };
}

// 보안 데이터 — 설정 창 '보안' 묶음(관리자·개발자 공용)이 열릴 때 부른다.
// owner/developer만(서버 검증). 잠금해제 세션 수·접근자 목록은 2026-11-13 철수(0159).
export type OwnerSecurityData = {
  passcodeVersion: number | null;
  passcodeUpdatedAt: string | null;
};
export type OwnerSecurityResult =
  | { ok: true; data: OwnerSecurityData }
  | { ok: false; error: string };

export async function getOwnerSecurityAction(): Promise<OwnerSecurityResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (!canEditSchedule(actor.role)) {
    return { ok: false, error: "관리자만 볼 수 있어요." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }

  const { data: cal } = await supabase.from("calendars").select("id").eq("slug", SLUG).maybeSingle();
  if (!cal) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }
  const calendarId = cal.id as string;

  const { data: passcode } = await supabase
    .from("private_layer_settings")
    .select("passcode_version, passcode_updated_at")
    .eq("calendar_id", calendarId)
    .maybeSingle();

  return {
    ok: true,
    data: {
      passcodeVersion: (passcode?.passcode_version as number | undefined) ?? null,
      passcodeUpdatedAt: (passcode?.passcode_updated_at as string | undefined) ?? null
    }
  };
}

// ── 멤버용(관리자·매니저·작업자) 월별 인사이트 — 수치 없는 4패널(일정·참여·트렌드·하이라이트) ──
// 보안 경계: 보안/시스템/방문 원시 데이터는 이 타입에 아예 없다. 바 크기는 0~1 비율만 보내(원시 수치
// 미노출), 허용된 하트 합계(이 달/누적)만 숫자로 준다. (하이라이트의 방문 최다일·시간대는 2026-11-13 방문 기록 철수로 뺐다.)
export type MemberInsightsData = {
  month: { year: number; month: number };
  content: {
    nextBroadcast: { dateKey: string; titles: string[] } | null;
    // 집계 수치는 줄세우기와 무관 → 노출 OK.
    thisMonthContent: number;
    lastMonthContent: number;
    daysWithContent: number;
    restDays: number;
    busiestWeekday: number | null;
    quietestWeekday: number | null;
    // 태그 순위의 "정확한 개수"는 줄세우기가 될 수 있어 비율(막대 길이)만.
    tags: { name: string; ratio: number; bgColor: string; borderColor: string }[];
  };
  engagement: {
    monthHearts: number;
    totalHearts: number;
    monthly: { ym: string; count: number }[]; // 월별 하트 합계(집계) — 노출 OK
    topTitles: string[]; // 인기 컨텐츠는 제목만(개별 하트 수는 줄세우기라 숨김)
  };
  trend: {
    months: string[];
    content: number[]; // 월별 컨텐츠 수(집계)
    hearts: number[]; // 월별 하트 합계(집계)
    broadcastHours: number[]; // 6개월 월별 총 방송시간(시간) — 관리자·매니저·작업자도 공유
    broadcastDaily: number[]; // 보는 달 일별 방송시간(시간)
    broadcastDays: number; // 보는 달 방송한 날 수
    contentByTag: TrendStack; // 콘텐츠 대분류별 6개월(수치 노출 OK)
    modifierByTag: TrendStack; // 방식별 6개월
    heartsByTag: TrendStack; // 하트 받은 태그 6개월 — 비율만(정규화, 정확 수 숨김)
  };
  highlight: {
    topTitle: string | null; // 인기 컨텐츠 제목
    busiestWeekday: number | null;
  };
};
export type MemberInsightsResult =
  | { ok: true; data: MemberInsightsData }
  | { ok: false; error: string };

export async function getMemberInsightsAction(
  year: number,
  month: number
): Promise<MemberInsightsResult> {
  const actor = await resolveCurrentActor(SLUG);
  // 시청자/비로그인 제외 — 관리자·매니저·작업자·개발자만(개발자는 보통 전체 버전을 쓴다).
  if (!actor.isAuthenticated || actor.role === "viewer") {
    return { ok: false, error: "권한이 없습니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }
  const { data: cal } = await supabase
    .from("calendars")
    .select("id")
    .eq("slug", SLUG)
    .maybeSingle();
  if (!cal) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }
  const calendarId = cal.id as string;

  const y = year;
  const m = month;
  const monthStart = `${y}-${pad(m)}-01`;
  const nextMonthStart = ymd(new Date(Date.UTC(y, m, 1)));
  const todayKey = todayKstKey();
  const curYm = `${y}-${pad(m)}`;
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  const sixStart = `${monthKeys[0]}-01`;

  const [eventsRes, tagsRes, nextRes, paletteRes, heartsRes, bcastRes, vodRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, date_key, is_public")
      .is("deleted_at", null)
      .eq("calendar_id", calendarId)
      .eq("is_public", true)
      .gte("date_key", sixStart)
      .lt("date_key", nextMonthStart),
    supabase
      .from("event_tags")
      .select("event_id, broadcast_tags(id, display_name, color_key), events!inner(calendar_id, date_key)")
      .eq("events.calendar_id", calendarId)
      .gte("events.date_key", sixStart)
      .lt("events.date_key", nextMonthStart),
    supabase
      .from("events")
      .select("date_key, public_title, event_tags(broadcast_tags(display_name))")
      .is("deleted_at", null)
      .eq("calendar_id", calendarId)
      .eq("is_public", true)
      .gte("date_key", todayKey)
      .order("date_key", { ascending: true })
      .limit(40),
    supabase.from("color_palette").select("key, bg_color, border_color").eq("calendar_id", calendarId),
    supabase.rpc("get_event_heart_counts", { p_calendar_id: calendarId }),
    // 방송시간 6개월 — 관리자·매니저·작업자도 트렌드에서 볼 수 있게(공개 API엔 여전히 미노출).
    supabase
      .from("broadcast_session")
      .select("start_day, started_at, last_live_at, ended_at")
      .gte("start_day", sixStart)
      .lt("start_day", nextMonthStart),
    // 세션 이전 시대 방송시간 폴백(0068 다시보기 길이) — 세션 없는 날만 채운다.
    supabase
      .from("vod_archive")
      .select("broadcast_day, duration_ms, reg_date")
      .eq("guest", false) // 합방 게스트 출연분(0075) 제외
      .eq("upload", false) // 업로드 영상(0156) 제외
      .gte("broadcast_day", sixStart)
      .lt("broadcast_day", nextMonthStart)
  ]);
  const broadcast = computeBroadcast(
    mergeVodFallback((bcastRes.data ?? []) as BcastRow[], (vodRes.data ?? []) as VodFallbackRow[]),
    monthKeys,
    y,
    m
  );

  // 휴뱅 일정 id + 태그(6개월) 집계. 세부는 대분류로 롤업.
  const catMap = await loadTagCategoryMap(supabase, calendarId);
  const catOf = (bt?: { id?: string; display_name?: string; color_key?: string }) =>
    (bt?.id && catMap.get(bt.id)) || {
      id: bt?.id ?? bt?.display_name ?? "?",
      name: bt?.display_name ?? "?",
      colorKey: bt?.color_key ?? "",
      bgHex: null as string | null,
      kind: "content" as const
    };
  const tagRows = (tagsRes.data ?? []) as {
    event_id: string;
    broadcast_tags?: { id?: string; display_name?: string; color_key?: string };
  }[];
  const restIds = new Set<string>();
  for (const row of tagRows) {
    if (row.broadcast_tags?.display_name === REST_TAG) restIds.add(row.event_id);
  }
  const allEvents = (eventsRes.data ?? []) as { id: string; date_key: string }[];
  const isContent = (e: { id: string }) => !restIds.has(e.id);
  const thisMonth = allEvents.filter(
    (e) => e.date_key >= monthStart && e.date_key < nextMonthStart && isContent(e)
  );
  const thisMonthIds = new Set(thisMonth.map((e) => e.id));

  // 요일 분포.
  const wd = Array(7).fill(0) as number[];
  for (const e of thisMonth) wd[weekdayOf(e.date_key)] += 1;
  const maxWd = Math.max(...wd, 0);
  const minWd = Math.min(...wd);
  const busiestWeekday = thisMonth.length > 0 ? wd.indexOf(maxWd) : null;
  const quietestWeekday = thisMonth.length > 0 && maxWd !== minWd ? wd.indexOf(minWd) : null;

  // 집계 수치(줄세우기 무관) — 노출 OK.
  const thisMonthContent = thisMonth.length;
  const daysWithContent = new Set(thisMonth.map((e) => e.date_key)).size;
  const restDays = new Set(
    allEvents
      .filter((e) => e.date_key >= monthStart && e.date_key < nextMonthStart && restIds.has(e.id))
      .map((e) => e.date_key)
  ).size;
  const lastYm = monthKeys[monthKeys.length - 2]; // 직전 달(추세 비교용)
  const lastMonthContent = allEvents.filter(
    (e) => e.date_key.slice(0, 7) === lastYm && !restIds.has(e.id)
  ).length;

  // 태그 순위(이 달) → 비율만.
  const colorMap = new Map<string, { bg: string; border: string }>();
  for (const c of paletteRes.data ?? []) {
    colorMap.set((c as { key: string }).key, {
      bg: (c as { bg_color: string }).bg_color,
      border: (c as { border_color: string }).border_color
    });
  }
  // 태그별 컨텐츠 6개월(휴뱅 포함) — 태그 id 기준 집계(rename 자동 반영). 컨텐츠 수치는 노출 OK.
  const eventMonth = new Map<string, string>(
    allEvents.map((e) => [e.id, e.date_key.slice(0, 7)])
  );
  const ctTagInfo = new Map<string, { name: string; color: string; total: number }>();
  const ctRows: { ym: string; key: string; n: number }[] = [];
  const ctContentEventIds = new Set<string>(); // 콘텐츠 태그 1개 이상 단 공개 일정
  for (const row of tagRows) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id);
    if (!bt?.id || !ym) continue;
    const cat = catOf(bt);
    if (cat.kind === "modifier") continue; // 수식어는 컨텐츠 트렌드서 제외
    ctContentEventIds.add(row.event_id);
    ctRows.push({ ym, key: cat.id, n: 1 });
    const cur = ctTagInfo.get(cat.id);
    if (cur) cur.total += 1;
    else
      ctTagInfo.set(cat.id, {
        name: cat.name,
        color: cat.bgHex ?? colorMap.get(cat.colorKey)?.bg ?? "#cdc6ec",
        total: 1
      });
  }
  const ctCats = [...ctTagInfo.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, v]) => ({ key, label: v.name, color: v.color }));
  // 콘텐츠 태그 0개인 공개 일정(휴뱅 제외) = 합성 '기타'. 항상 맨 끝.
  let ctEtc = 0;
  for (const [id, ym] of eventMonth) {
    if (restIds.has(id) || ctContentEventIds.has(id)) continue;
    ctRows.push({ ym, key: ETC_KEY, n: 1 });
    ctEtc += 1;
  }
  if (ctEtc > 0) ctCats.push({ key: ETC_KEY, label: ETC_LABEL, color: ETC_COLOR });
  const contentByTag = buildTrendStack(monthKeys, ctCats, ctRows);

  // 방식(modifier)별 6개월 — 콘텐츠와 별개 축.
  const mtInfo = new Map<string, { name: string; color: string; total: number }>();
  const mtRows: { ym: string; key: string; n: number }[] = [];
  for (const row of tagRows) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id);
    if (!bt?.id || !ym) continue;
    const cat = catOf(bt);
    if (cat.kind !== "modifier") continue;
    mtRows.push({ ym, key: cat.id, n: 1 });
    const cur = mtInfo.get(cat.id);
    if (cur) cur.total += 1;
    else
      mtInfo.set(cat.id, {
        name: cat.name,
        color: cat.bgHex ?? colorMap.get(cat.colorKey)?.bg ?? "#cdc6ec",
        total: 1
      });
  }
  const modifierByTag = buildTrendStack(
    monthKeys,
    [...mtInfo.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([key, v]) => ({ key, label: v.name, color: v.color })),
    mtRows
  );

  const tagCount = new Map<string, { name: string; count: number; bgColor: string; borderColor: string }>();
  const tmContentIds = new Set<string>(); // 이 달 콘텐츠 태그를 단 일정
  for (const row of tagRows) {
    const rawName = row.broadcast_tags?.display_name;
    if (!rawName || rawName === REST_TAG || !thisMonthIds.has(row.event_id)) continue;
    const cat = catOf(row.broadcast_tags);
    if (cat.name === REST_TAG) continue;
    if (cat.kind === "modifier") continue; // 수식어(합방·시참 등)는 컨텐츠 순위서 제외
    tmContentIds.add(row.event_id);
    const cur = tagCount.get(cat.id);
    if (cur) cur.count += 1;
    else {
      const col = colorMap.get(cat.colorKey);
      tagCount.set(cat.id, {
        name: cat.name,
        count: 1,
        bgColor: cat.bgHex ?? col?.bg ?? "#cdc6ec",
        borderColor: col?.border ?? "#b3a9dd"
      });
    }
  }
  // 이 달 콘텐츠 태그 0개 일정 = '기타'(휴뱅은 thisMonthIds에서 이미 빠짐).
  const tmEtc = [...thisMonthIds].filter((id) => !tmContentIds.has(id)).length;
  if (tmEtc > 0) {
    tagCount.set(ETC_KEY, { name: ETC_LABEL, count: tmEtc, bgColor: ETC_COLOR, borderColor: "#a1a1aa" });
  }
  const tagArr = [...tagCount.values()].sort((a, b) => b.count - a.count).slice(0, 8);
  const tagMax = Math.max(1, ...tagArr.map((t) => t.count));
  const tags = tagArr.map((t) => ({
    name: t.name,
    ratio: t.count / tagMax,
    bgColor: t.bgColor,
    borderColor: t.borderColor
  }));

  // 다음 방송(휴뱅 제외).
  const upcoming = (nextRes.data ?? []) as {
    date_key: string;
    public_title: string;
    event_tags?: { broadcast_tags?: { display_name?: string } }[];
  }[];
  const byDate = new Map<string, string[]>();
  for (const ev of upcoming) {
    if ((ev.event_tags ?? []).some((t) => t.broadcast_tags?.display_name === REST_TAG)) continue;
    const list = byDate.get(ev.date_key) ?? [];
    list.push(firstLine(ev.public_title));
    byDate.set(ev.date_key, list);
  }
  const firstDate = [...byDate.keys()].sort()[0];
  const nextBroadcast = firstDate ? { dateKey: firstDate, titles: byDate.get(firstDate)! } : null;

  // 하트: 이 달/누적 합계(허용) + 월별 비율 + 인기 제목.
  const heartCounts = (heartsRes.data ?? []) as { event_id: string; count: number }[];
  const totalHearts = heartCounts.reduce((s, r) => s + Number(r.count), 0);
  const infoMap = new Map<string, { dateKey: string; title: string }>();
  if (heartCounts.length > 0) {
    const { data: rows } = await supabase
      .from("events")
      .select("id, date_key, public_title, is_public")
      .is("deleted_at", null)
      .in("id", heartCounts.map((h) => h.event_id));
    for (const e of rows ?? []) {
      if ((e as { is_public?: boolean }).is_public) {
        infoMap.set((e as { id: string }).id, {
          dateKey: (e as { date_key: string }).date_key,
          title: (e as { public_title: string }).public_title
        });
      }
    }
  }
  const monthlyMap = new Map<string, number>(monthKeys.map((k) => [k, 0]));
  let monthHearts = 0;
  const topThisMonth: { title: string; count: number }[] = [];
  for (const h of heartCounts) {
    const info = infoMap.get(h.event_id);
    if (!info) continue;
    const ym = info.dateKey.slice(0, 7);
    if (monthlyMap.has(ym)) monthlyMap.set(ym, (monthlyMap.get(ym) ?? 0) + Number(h.count));
    if (ym === curYm) {
      monthHearts += Number(h.count);
      topThisMonth.push({ title: firstLine(info.title), count: Number(h.count) });
    }
  }
  const monthlyCounts = monthKeys.map((k) => monthlyMap.get(k) ?? 0);
  const monthly = monthKeys.map((k, i) => ({ ym: k, count: monthlyCounts[i] }));
  const topSorted = topThisMonth.sort((a, b) => b.count - a.count);
  const topTitles = topSorted.slice(0, 5).map((t) => t.title);
  const topTitle = topSorted[0]?.title ?? null;

  // 하트 받은 태그 6개월 — '일정당 평균 하트'(비율. 일정 수 많은 태그가 자동 1등이 되지 않게)
  // + 정규화로 정확 수 숨김(막대 비율·높이만 유지). showNumbers=false.
  const memHeartByEvent = new Map<string, number>(
    heartCounts.map((h) => [h.event_id, Number(h.count)])
  );
  const hbtInfo = new Map<string, { name: string; color: string; h: number; e: number }>();
  const hbtAgg = new Map<string, { h: number; e: number }>(); // `${ym}|${catId}`
  const hbtSeen = new Set<string>(); // `${eventId}|${catId}` — 같은 대분류 세부 태그 중복 방지
  for (const row of tagRows) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id);
    if (!bt?.id || !ym) continue;
    const cat = catOf(bt);
    if (cat.kind === "modifier") continue; // 수식어는 태그별 하트 트렌드서 제외
    const dedup = `${row.event_id}|${cat.id}`;
    if (hbtSeen.has(dedup)) continue;
    hbtSeen.add(dedup);
    const h = memHeartByEvent.get(row.event_id) ?? 0;
    const aggKey = `${ym}|${cat.id}`;
    const agg = hbtAgg.get(aggKey) ?? { h: 0, e: 0 };
    agg.h += h;
    agg.e += 1;
    hbtAgg.set(aggKey, agg);
    const cur = hbtInfo.get(cat.id);
    if (cur) {
      cur.h += h;
      cur.e += 1;
    } else
      hbtInfo.set(cat.id, {
        name: cat.name,
        color: cat.bgHex ?? colorMap.get(cat.colorKey)?.bg ?? "#f7a8c0",
        h,
        e: 1
      });
  }
  const hbtRows: { ym: string; key: string; n: number }[] = [...hbtAgg.entries()].map(
    ([k, v]) => ({
      ym: k.slice(0, 7),
      key: k.slice(8),
      n: Math.round((v.h / Math.max(1, v.e)) * 10) / 10
    })
  );
  const hbtRaw = buildTrendStack(
    monthKeys,
    [...hbtInfo.entries()]
      .filter(([, v]) => v.h > 0)
      .sort((a, b) => b[1].h / b[1].e - a[1].h / a[1].e)
      .map(([key, v]) => ({ key, label: v.name, color: v.color })),
    hbtRows
  );
  const hbtGmax = Math.max(1, ...hbtRaw.months.map((m) => m.total));
  const heartsByTag: TrendStack = {
    cats: hbtRaw.cats,
    months: hbtRaw.months.map((m) => ({
      ym: m.ym,
      total: Math.round((m.total / hbtGmax) * 100),
      counts: Object.fromEntries(
        Object.entries(m.counts).map(([k, v]) => [k, Math.round((v / hbtGmax) * 100)])
      )
    }))
  };

  // 트렌드(6개월) — 컨텐츠·하트 월별 집계 수치(노출 OK). 방문은 개발자 전용이라 여기 없음.
  const contentByMonth = new Map<string, number>(monthKeys.map((k) => [k, 0]));
  for (const e of allEvents) {
    if (restIds.has(e.id)) continue;
    const ym = e.date_key.slice(0, 7);
    if (contentByMonth.has(ym)) contentByMonth.set(ym, (contentByMonth.get(ym) ?? 0) + 1);
  }
  const contentCounts = monthKeys.map((k) => contentByMonth.get(k) ?? 0);

  return {
    ok: true,
    data: {
      month: { year: y, month: m },
      content: {
        nextBroadcast,
        thisMonthContent,
        lastMonthContent,
        daysWithContent,
        restDays,
        busiestWeekday,
        quietestWeekday,
        tags
      },
      engagement: { monthHearts, totalHearts, monthly, topTitles },
      trend: {
        months: monthKeys,
        content: contentCounts,
        hearts: monthlyCounts,
        broadcastHours: broadcast.broadcastHours,
        broadcastDaily: broadcast.broadcastDaily,
        broadcastDays: broadcast.broadcastDays,
        contentByTag,
        modifierByTag,
        heartsByTag
      },
      highlight: { topTitle, busiestWeekday }
    }
  };
}
