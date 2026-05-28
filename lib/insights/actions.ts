"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { getOwnerEmails, normalizeEmail } from "@/lib/auth/config";

// 개발자 전용 "인사이트" 대시보드용 집계. 모든 값은 합계/개수만 — 비공개·owner_private 일정의
// 내용(제목)은 절대 내보내지 않는다(개발자는 owner-only 콘텐츠를 못 본다는 규칙 유지).
// "나만"(owner_private)은 카운트에서도 제외한다(요청).

const SLUG = "vic";

export type InsightsData = {
  content: {
    nextEvent: { dateKey: string; title: string } | null; // 다음 공개(방송) 일정
    thisMonthPublic: number; // 이번 달 방송(공개 일정) 수
    lastMonthPublic: number; // 지난 달 방송 수(추세 비교)
    daysWithStream: number; // 이번 달 방송 있는 날 수
    emptyDays: number; // 이번 달 방송 없는 날 수
    busiestWeekday: number | null; // 이번 달 가장 방송 많은 요일(0=일..6=토)
    // 이번 달 태그 사용 분포(상위) — 실제 태그 색을 함께 보낸다.
    tags: { name: string; count: number; bgColor: string; borderColor: string }[];
  };
  engagement: {
    thisMonthHearts: number; // 이번 달 공개 일정이 받은 하트
    totalHearts: number; // 공개 일정 누적 하트(전체)
    monthly: { ym: string; count: number }[]; // 최근 6개월 일정 하트(오래된→최신)
    topEvents: { title: string; count: number }[]; // 하트 많은 공개 일정 상위
  };
  security: {
    passcodeVersion: number | null; // 비공개 레이어 잠금 암호 버전
    passcodeUpdatedAt: string | null;
    unlockDurationMinutes: number | null; // 잠금 해제 1회 유효 시간(분)
    activeUnlocks: { email: string; expiresAt: string }[]; // 지금 비공개를 연 계정 + 만료
    members: { email: string; manager: boolean; worker: boolean }[]; // 신뢰 멤버 목록
  };
  system: {
    ownerEmails: string[]; // 설정(OWNER_EMAIL)에 등록된 소유자 계정 전부
    dbOwnerEmail: string | null; // DB calendars.owner_id 주 소유자
    coOwnerEmails: string[]; // DB calendar_co_owners 공동 소유자
    bindingOk: boolean; // 설정 주 소유자 = DB 주 소유자 (어긋나면 owner 저장 실패 위험)
    commit: string | null;
    generatedAt: string; // KST ISO
  };
};

export type InsightsResult =
  | { ok: true; data: InsightsData }
  | { ok: false; error: string };

function kstNow(): Date {
  return new Date(Date.now() + 9 * 3600 * 1000);
}
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
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
    // 방문 로그는 보조 기능 — 실패해도 앱 동작에 영향 없음(테이블 미적용 등).
    return { ok: false };
  }
  return { ok: true };
}

export type VisitTrends = {
  ready: boolean; // visit_log 준비(마이그레이션 적용 + 데이터) 여부
  days: { day: string; roles: Record<string, number>; total: number }[]; // 최근 14일
  hours: number[]; // 24칸, 시간대별 방문(최근 30일, KST)
  todayTotal: number;
};
export type VisitTrendsResult =
  | { ok: true; data: VisitTrends }
  | { ok: false; error: string };

export async function getVisitTrendsAction(): Promise<VisitTrendsResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") {
    return { ok: false, error: "개발자만 볼 수 있는 화면입니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }

  const now = kstNow();
  const todayKey = ymd(now);
  const from30 = ymd(new Date(now.getTime() - 29 * 86400000));

  const { data, error } = await supabase
    .from("visit_log")
    .select("day, role, occurred_at")
    .gte("day", from30)
    .order("occurred_at", { ascending: true });

  // 테이블 미적용/데이터 없음 → 친절한 빈 상태로(오류 대신).
  if (error) {
    return {
      ok: true,
      data: { ready: false, days: [], hours: Array(24).fill(0), todayTotal: 0 }
    };
  }

  const rows = (data ?? []) as { day: string; role: string; occurred_at: string }[];

  // 최근 14일 날짜축(빈 날도 0으로 채워 연속 그래프).
  const dayList: string[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    dayList.push(ymd(new Date(now.getTime() - i * 86400000)));
  }
  const dayMap = new Map<string, Record<string, number>>();
  for (const d of dayList) {
    dayMap.set(d, Object.fromEntries(ROLE_ORDER.map((r) => [r, 0])));
  }
  const hours = Array(24).fill(0) as number[];
  let todayTotal = 0;

  for (const row of rows) {
    const roles = dayMap.get(row.day);
    if (roles && row.role in roles) roles[row.role] += 1;
    if (row.day === todayKey) todayTotal += 1;
    // 시간대(KST) 분포 — 최근 30일 전체.
    const t = new Date(row.occurred_at).getTime();
    if (!Number.isNaN(t)) {
      const h = new Date(t + 9 * 3600 * 1000).getUTCHours();
      hours[h] += 1;
    }
  }

  const days = dayList.map((day) => {
    const roles = dayMap.get(day) ?? {};
    const total = Object.values(roles).reduce((s, n) => s + n, 0);
    return { day, roles, total };
  });

  return { ok: true, data: { ready: rows.length > 0, days, hours, todayTotal } };
}

export async function getInsightsAction(): Promise<InsightsResult> {
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
    .select("id, owner_id, title")
    .eq("slug", SLUG)
    .maybeSingle();
  if (!cal) {
    return { ok: false, error: "캘린더를 찾을 수 없습니다." };
  }
  const calendarId = cal.id as string;

  // 이번 달(KST) 범위 + 지난 달 + 오늘 + 하트 6개월 범위.
  const now = kstNow();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
  const nextMonthStart = ymd(new Date(Date.UTC(y, m, 1)));
  const lastMonthStart = ymd(new Date(Date.UTC(y, m - 2, 1)));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const todayKey = ymd(now);
  const nowIso = new Date().toISOString();
  const heartsFromIso = new Date(Date.UTC(y, m - 1 - 5, 1)).toISOString(); // 약 6개월 전 1일
  const curYm = `${y}-${String(m).padStart(2, "0")}`;

  const [
    monthEventsRes,
    lastMonthRes,
    nextEventRes,
    tagRowsRes,
    paletteRes,
    eventHeartRes,
    heartRowsRes,
    unlockRes,
    membersRes,
    passcodeRes,
    coOwnerRes
  ] = await Promise.all([
    supabase
      .from("events")
      .select("date_key, is_public")
      .eq("calendar_id", calendarId)
      .gte("date_key", monthStart)
      .lt("date_key", nextMonthStart),
    supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .eq("calendar_id", calendarId)
      .eq("is_public", true)
      .gte("date_key", lastMonthStart)
      .lt("date_key", monthStart),
    supabase
      .from("events")
      .select("date_key, public_title")
      .eq("calendar_id", calendarId)
      .eq("is_public", true)
      .gte("date_key", todayKey)
      .order("date_key", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("event_tags")
      .select("tag_id, broadcast_tags(display_name, color_key), events!inner(calendar_id, date_key)")
      .eq("events.calendar_id", calendarId)
      .gte("events.date_key", monthStart)
      .lt("events.date_key", nextMonthStart),
    supabase.from("color_palette").select("key, bg_color, border_color").eq("calendar_id", calendarId),
    supabase.rpc("get_event_heart_counts", { p_calendar_id: calendarId }),
    supabase
      .from("event_hearts")
      .select("created_at, events!inner(calendar_id)")
      .eq("events.calendar_id", calendarId)
      .gte("created_at", heartsFromIso),
    supabase
      .from("unlock_sessions")
      .select("user_id, expires_at")
      .eq("calendar_id", calendarId)
      .gt("expires_at", nowIso)
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
      .maybeSingle(),
    supabase.from("calendar_co_owners").select("owner_id").eq("calendar_id", calendarId)
  ]);

  // 콘텐츠: 이번 달 방송(공개 일정) 통계 + 다음 방송.
  const monthRows = (monthEventsRes.data ?? []) as { date_key: string; is_public: boolean }[];
  const publicRows = monthRows.filter((e) => e.is_public);
  const thisMonthPublic = publicRows.length;
  const daysWithStream = new Set(publicRows.map((e) => e.date_key)).size;
  const emptyDays = Math.max(0, daysInMonth - daysWithStream);
  const weekdayCount = Array(7).fill(0) as number[];
  for (const e of publicRows) {
    weekdayCount[new Date(`${e.date_key}T00:00:00Z`).getUTCDay()] += 1;
  }
  const maxWd = Math.max(...weekdayCount);
  const busiestWeekday = maxWd > 0 ? weekdayCount.indexOf(maxWd) : null;
  const nextEv = nextEventRes.data as { date_key: string; public_title: string } | null;
  const nextEvent = nextEv ? { dateKey: nextEv.date_key, title: nextEv.public_title } : null;

  // 팔레트 색 맵(key → 실제 색) — 태그 막대에 진짜 태그 색을 입히기 위함.
  const colorMap = new Map<string, { bg: string; border: string }>();
  for (const c of paletteRes.data ?? []) {
    colorMap.set((c as { key: string }).key, {
      bg: (c as { bg_color: string }).bg_color,
      border: (c as { border_color: string }).border_color
    });
  }
  const tagMap = new Map<
    string,
    { name: string; count: number; bgColor: string; borderColor: string }
  >();
  for (const row of tagRowsRes.data ?? []) {
    const tag = (row as { broadcast_tags?: { display_name?: string; color_key?: string } })
      .broadcast_tags;
    const id = (row as { tag_id: string }).tag_id;
    if (!tag?.display_name) continue;
    const cur = tagMap.get(id);
    if (cur) cur.count += 1;
    else {
      const col = colorMap.get(tag.color_key ?? "");
      tagMap.set(id, {
        name: tag.display_name,
        count: 1,
        bgColor: col?.bg ?? "#cdc6ec",
        borderColor: col?.border ?? "#b3a9dd"
      });
    }
  }
  const tags = [...tagMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  // 참여(하트): 전체 합계 + 인기 일정 + 최근 6개월 월별 + 이번 달.
  const heartCounts = (eventHeartRes.data ?? []) as { event_id: string; count: number }[];
  const totalHearts = heartCounts.reduce((s, r) => s + Number(r.count), 0);
  const topHeart = [...heartCounts].sort((a, b) => Number(b.count) - Number(a.count)).slice(0, 5);
  let topEvents: { title: string; count: number }[] = [];
  if (topHeart.length > 0) {
    const { data: titleRows } = await supabase
      .from("events")
      .select("id, public_title, is_public")
      .in("id", topHeart.map((r) => r.event_id));
    const titleMap = new Map(
      (titleRows ?? [])
        .filter((t) => (t as { is_public?: boolean }).is_public)
        .map((t) => [(t as { id: string }).id, (t as { public_title: string }).public_title])
    );
    topEvents = topHeart
      .map((r) => ({ title: titleMap.get(r.event_id) ?? "", count: Number(r.count) }))
      .filter((e) => e.title);
  }
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const monthlyMap = new Map<string, number>(monthKeys.map((k) => [k, 0]));
  for (const row of heartRowsRes.data ?? []) {
    const t = new Date((row as { created_at: string }).created_at).getTime();
    if (Number.isNaN(t)) continue;
    const k = new Date(t + 9 * 3600 * 1000);
    const ym = `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, "0")}`;
    if (monthlyMap.has(ym)) monthlyMap.set(ym, (monthlyMap.get(ym) ?? 0) + 1);
  }
  const monthly = monthKeys.map((k) => ({ ym: k, count: monthlyMap.get(k) ?? 0 }));
  const thisMonthHearts = monthlyMap.get(curYm) ?? 0;

  // user_id → 이메일 해석(중복 제거 + 캐시).
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

  // 보안: 신뢰 멤버 목록 + 지금 비공개를 연 계정(만료 시각).
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

  // 시스템: 설정 소유자 전부 + DB 주/공동 소유자 + 바인딩 일치 여부.
  const ownerEmails = getOwnerEmails();
  const dbOwnerEmail = await emailFor(cal.owner_id as string | undefined);
  const coOwnerIds = (coOwnerRes.data ?? []).map((c) => (c as { owner_id: string }).owner_id);
  const coOwnerEmails = (await Promise.all(coOwnerIds.map((id) => emailFor(id)))).filter(
    (e): e is string => Boolean(e)
  );
  const bindingOk = Boolean(ownerEmails[0] && dbOwnerEmail && ownerEmails[0] === dbOwnerEmail);

  return {
    ok: true,
    data: {
      content: {
        nextEvent,
        thisMonthPublic,
        lastMonthPublic: lastMonthRes.count ?? 0,
        daysWithStream,
        emptyDays,
        busiestWeekday,
        tags
      },
      engagement: { thisMonthHearts, totalHearts, monthly, topEvents },
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
        coOwnerEmails,
        bindingOk,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        // 실제 UTC 시각 — fmtDateTime이 KST(+9h)로 한 번만 변환한다(이전엔 이중 변환 버그).
        generatedAt: new Date().toISOString()
      }
    }
  };
}
