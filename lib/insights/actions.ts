"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { getOwnerEmails, normalizeEmail } from "@/lib/auth/config";

// 개발자 전용 "월별 인사이트" — 보고 있는 달(year/month) 기준 집계.
// 모든 값은 합계/개수만 — 비공개·owner_private 일정의 내용은 절대 내보내지 않는다.
// "나만"(owner_private)은 카운트 제외. "휴뱅"(방송을 안 한 표시) 태그가 붙은 일정은
// 콘텐츠/방송 집계에서 제외한다.

const SLUG = "vic";
const REST_TAG = "휴뱅";

export type InsightsData = {
  month: { year: number; month: number };
  content: {
    nextBroadcast: { dateKey: string; titles: string[] } | null; // 다음 방송(휴뱅 제외, 같은 날 여러 개)
    thisMonthContent: number; // 이번 달 컨텐츠 수(공개·휴뱅 제외)
    lastMonthContent: number; // 지난 달(추세 비교)
    daysWithContent: number; // 컨텐츠 있는 날 수
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
  security: {
    passcodeVersion: number | null;
    passcodeUpdatedAt: string | null;
    unlockDurationMinutes: number | null;
    activeUnlocks: { email: string; expiresAt: string }[];
    members: { email: string; manager: boolean; worker: boolean }[];
  };
  system: {
    ownerEmails: string[];
    dbOwnerEmail: string | null;
    bindingOk: boolean;
    commit: string | null;
    generatedAt: string;
  };
};

export type InsightsResult = { ok: true; data: InsightsData } | { ok: false; error: string };

function kstNow(): Date {
  return new Date(Date.now() + 9 * 3600 * 1000);
}
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

const ROLE_ORDER = ["viewer", "worker", "manager", "owner", "developer"] as const;
const DEVICE_SET = new Set(["desktop", "android", "ios", "mobile"]);

// 방문 1회 기록(브라우저가 하루 1회 호출). 역할은 서버에서 실제 actor로 다시 확인해 위조를 막고,
// 기기/세션 식별자만 클라이언트에서 받는다. 개인정보(이메일·user_id)는 저장하지 않는다.
export async function logVisitAction(
  device: string,
  sessionHash: string
): Promise<{ ok: boolean }> {
  const actor = await resolveCurrentActor(SLUG);
  if (!actor.isAuthenticated) return { ok: false };
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false };
  const safeDevice = DEVICE_SET.has(device) ? device : "desktop";
  const safeHash = (sessionHash || "").slice(0, 64) || `${Date.now()}`;
  try {
    await supabase.from("visit_log").insert({
      day: ymd(kstNow()),
      role: actor.role,
      device: safeDevice,
      session_hash: safeHash
    });
  } catch {
    return { ok: false };
  }
  return { ok: true };
}

export async function getInsightsAction(year: number, month: number): Promise<InsightsResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") {
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
  const todayKey = ymd(kstNow());
  const curYm = `${y}-${pad(m)}`;

  const [eventsRangeRes, tagsRangeRes, nextRes, paletteRes, heartCountsRes, unlockRes, membersRes, passcodeRes] =
    await Promise.all([
      supabase
        .from("events")
        .select("id, date_key, is_public")
        .eq("calendar_id", calendarId)
        .gte("date_key", lastMonthStart)
        .lt("date_key", nextMonthStart),
      supabase
        .from("event_tags")
        .select("event_id, broadcast_tags(display_name, color_key), events!inner(calendar_id, date_key)")
        .eq("events.calendar_id", calendarId)
        .gte("events.date_key", monthStart)
        .lt("events.date_key", nextMonthStart),
      supabase
        .from("events")
        .select("date_key, public_title, event_tags(broadcast_tags(display_name))")
        .eq("calendar_id", calendarId)
        .eq("is_public", true)
        .gte("date_key", todayKey)
        .order("date_key", { ascending: true })
        .limit(40),
      supabase.from("color_palette").select("key, bg_color, border_color").eq("calendar_id", calendarId),
      supabase.rpc("get_event_heart_counts", { p_calendar_id: calendarId }),
      supabase
        .from("unlock_sessions")
        .select("user_id, expires_at")
        .eq("calendar_id", calendarId)
        .gt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true }),
      supabase
        .from("trusted_members")
        .select("email, is_manager, is_worker, trusted_role")
        .eq("calendar_id", calendarId)
        .eq("is_active", true),
      supabase
        .from("private_layer_settings")
        .select("passcode_version, passcode_updated_at, unlock_duration_minutes")
        .eq("calendar_id", calendarId)
        .maybeSingle()
    ]);

  // 휴뱅(방송 안 함) 일정 id 집합 — 콘텐츠/방송 집계에서 제외.
  const tagsRange = (tagsRangeRes.data ?? []) as {
    event_id: string;
    broadcast_tags?: { display_name?: string; color_key?: string };
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
  const tagMap = new Map<string, { name: string; count: number; bgColor: string; borderColor: string }>();
  for (const row of tagsRange) {
    const name = row.broadcast_tags?.display_name;
    if (!name || name === REST_TAG) continue;
    if (!thisMonthContentIds.has(row.event_id)) continue;
    const cur = tagMap.get(name);
    if (cur) cur.count += 1;
    else {
      const col = colorMap.get(row.broadcast_tags?.color_key ?? "");
      tagMap.set(name, {
        name,
        count: 1,
        bgColor: col?.bg ?? "#cdc6ec",
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
    list.push(ev.public_title);
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
      topThisMonth.push({ title: info.title, count: Number(h.count) });
    }
  }
  const monthly = monthKeys.map((k) => ({ ym: k, count: monthlyMap.get(k) ?? 0 }));
  const topEvents = topThisMonth.sort((a, b) => b.count - a.count).slice(0, 5);

  // 이메일 해석.
  const emailCache = new Map<string, string | null>();
  async function emailFor(id: string | null | undefined): Promise<string | null> {
    if (!id) return null;
    if (emailCache.has(id)) return emailCache.get(id) ?? null;
    let email: string | null = null;
    try {
      const { data } = await supabase!.auth.admin.getUserById(id);
      email = normalizeEmail(data?.user?.email);
    } catch {
      email = null;
    }
    emailCache.set(id, email);
    return email;
  }

  const members = (membersRes.data ?? []).map((mem) => {
    const role = (mem as { trusted_role?: string }).trusted_role;
    return {
      email: (mem as { email: string }).email,
      manager: Boolean((mem as { is_manager?: boolean }).is_manager ?? role === "manager"),
      worker: Boolean((mem as { is_worker?: boolean }).is_worker ?? role === "worker")
    };
  });
  const unlockRows = (unlockRes.data ?? []) as { user_id: string; expires_at: string }[];
  const activeUnlocks = await Promise.all(
    unlockRows.map(async (u) => ({
      email: (await emailFor(u.user_id)) ?? "(알 수 없음)",
      expiresAt: u.expires_at
    }))
  );
  const passcode = passcodeRes.data as {
    passcode_version?: number;
    passcode_updated_at?: string;
    unlock_duration_minutes?: number;
  } | null;

  const ownerEmails = getOwnerEmails();
  const dbOwnerEmail = await emailFor(cal.owner_id as string | undefined);
  const bindingOk = Boolean(ownerEmails[0] && dbOwnerEmail && ownerEmails[0] === dbOwnerEmail);

  return {
    ok: true,
    data: {
      month: { year: y, month: m },
      content: {
        nextBroadcast,
        thisMonthContent,
        lastMonthContent,
        daysWithContent,
        busiestWeekday,
        quietestWeekday,
        tags
      },
      engagement: { monthHearts, totalHearts, monthly, topEvents },
      security: {
        passcodeVersion: passcode?.passcode_version ?? null,
        passcodeUpdatedAt: passcode?.passcode_updated_at ?? null,
        unlockDurationMinutes: passcode?.unlock_duration_minutes ?? null,
        activeUnlocks,
        members
      },
      system: {
        ownerEmails,
        dbOwnerEmail,
        bindingOk,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        generatedAt: new Date().toISOString()
      }
    }
  };
}

export type TrendData = {
  months: string[]; // 6개월(YYYY-MM, 오래된→최신, 타깃 월로 끝남)
  visits: number[];
  content: number[]; // 휴뱅 제외 공개 일정
};
export type TrendResult = { ok: true; data: TrendData } | { ok: false; error: string };

// 트렌드 패널용 — 방문·컨텐츠의 최근 6개월 월별 추이. (하트 6개월은 getInsightsAction이 이미 줌.)
export async function getTrendAction(year: number, month: number): Promise<TrendResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") {
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

  const [visitRes, eventsRes, tagsRes] = await Promise.all([
    supabase.from("visit_log").select("day").gte("day", fromStart).lt("day", nextMonthStart),
    supabase
      .from("events")
      .select("id, date_key")
      .eq("calendar_id", calendarId)
      .eq("is_public", true)
      .gte("date_key", fromStart)
      .lt("date_key", nextMonthStart),
    supabase
      .from("event_tags")
      .select("event_id, broadcast_tags(display_name), events!inner(calendar_id, date_key)")
      .eq("events.calendar_id", calendarId)
      .gte("events.date_key", fromStart)
      .lt("events.date_key", nextMonthStart)
  ]);

  const restIds = new Set<string>();
  for (const row of tagsRes.data ?? []) {
    if ((row as { broadcast_tags?: { display_name?: string } }).broadcast_tags?.display_name === REST_TAG) {
      restIds.add((row as { event_id: string }).event_id);
    }
  }
  const vMap = new Map(monthKeys.map((k) => [k, 0]));
  for (const row of visitRes.data ?? []) {
    const ym = (row as { day: string }).day.slice(0, 7);
    if (vMap.has(ym)) vMap.set(ym, (vMap.get(ym) ?? 0) + 1);
  }
  const cMap = new Map(monthKeys.map((k) => [k, 0]));
  for (const e of eventsRes.data ?? []) {
    if (restIds.has((e as { id: string }).id)) continue;
    const ym = (e as { date_key: string }).date_key.slice(0, 7);
    if (cMap.has(ym)) cMap.set(ym, (cMap.get(ym) ?? 0) + 1);
  }

  return {
    ok: true,
    data: {
      months: monthKeys,
      visits: monthKeys.map((k) => vMap.get(k) ?? 0),
      content: monthKeys.map((k) => cMap.get(k) ?? 0)
    }
  };
}

export type VisitTrends = {
  ready: boolean; // visit_log 접근 가능(테이블 적용) 여부
  hasData: boolean; // 이 달 방문 기록이 있는지
  days: { day: number; roles: Record<string, number>; total: number }[]; // 이 달 1..말일
  weeks: { label: string; roles: Record<string, number>; total: number }[]; // 1주차..
  hours: number[]; // 24칸(KST)
  total: number; // 이 달 방문 총합
};
export type VisitTrendsResult = { ok: true; data: VisitTrends } | { ok: false; error: string };

export async function getVisitTrendsAction(
  year: number,
  month: number
): Promise<VisitTrendsResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") {
    return { ok: false, error: "개발자만 볼 수 있는 화면입니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }

  const y = year;
  const m = month;
  const monthStart = `${y}-${pad(m)}-01`;
  const nextMonthStart = ymd(new Date(Date.UTC(y, m, 1)));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const emptyDays = () =>
    Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      roles: Object.fromEntries(ROLE_ORDER.map((r) => [r, 0])),
      total: 0
    }));

  const { data, error } = await supabase
    .from("visit_log")
    .select("day, role, occurred_at")
    .gte("day", monthStart)
    .lt("day", nextMonthStart);

  if (error) {
    return {
      ok: true,
      data: { ready: false, hasData: false, days: emptyDays(), weeks: [], hours: Array(24).fill(0), total: 0 }
    };
  }
  const rows = (data ?? []) as { day: string; role: string; occurred_at: string }[];

  const days = emptyDays();
  const weekMap = new Map<number, { roles: Record<string, number>; total: number }>();
  const hours = Array(24).fill(0) as number[];
  for (const row of rows) {
    const d = Number(row.day.slice(8, 10));
    if (d >= 1 && d <= daysInMonth) {
      const slot = days[d - 1];
      if (row.role in slot.roles) slot.roles[row.role] += 1;
      slot.total += 1;
    }
    const wi = Math.floor((d - 1) / 7); // 0~4 → 1주차~5주차
    const wk = weekMap.get(wi) ?? { roles: Object.fromEntries(ROLE_ORDER.map((r) => [r, 0])), total: 0 };
    if (row.role in wk.roles) wk.roles[row.role] += 1;
    wk.total += 1;
    weekMap.set(wi, wk);
    const t = new Date(row.occurred_at).getTime();
    if (!Number.isNaN(t)) hours[new Date(t + 9 * 3600 * 1000).getUTCHours()] += 1;
  }
  const weekCount = Math.ceil(daysInMonth / 7);
  const weeks = Array.from({ length: weekCount }, (_, i) => {
    const wk = weekMap.get(i) ?? { roles: Object.fromEntries(ROLE_ORDER.map((r) => [r, 0])), total: 0 };
    return { label: `${i + 1}주`, roles: wk.roles, total: wk.total };
  });

  return {
    ok: true,
    data: { ready: true, hasData: rows.length > 0, days, weeks, hours, total: rows.length }
  };
}
