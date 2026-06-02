"use server";

import { createHash } from "node:crypto";
import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { getOwnerEmails, normalizeEmail } from "@/lib/auth/config";
import { canEditSchedule } from "@/lib/permissions/roles";

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
  security: {
    passcodeVersion: number | null;
    passcodeUpdatedAt: string | null;
    unlockDurationMinutes: number | null;
    activeUnlocks: { email: string; expiresAt: string }[];
    members: { email: string; manager: boolean; worker: boolean }[];
    // 비공개를 열 수 있는 사람을 역할별로(매니저 제외 — 비공개 권한 없음). 활성 세션이면 expiresAt·userId가
    // 채워지고(개별 만료용), 없으면 둘 다 null("세션 없음").
    access: {
      owners: AccessPerson[];
      developers: AccessPerson[];
      workers: AccessPerson[];
    };
  };
  system: {
    ownerEmails: string[];
    developerEmails: string[];
    dbOwnerEmail: string | null;
    bindingOk: boolean;
    commit: string | null;
    deployedAt: string; // 빌드(배포) 시각
  };
};

export type InsightsResult = { ok: true; data: InsightsData } | { ok: false; error: string };

// 비공개 접근 자격자 한 명 — 활성 잠금 세션이 있으면 expiresAt(만료시간)·userId가 채워진다.
export type AccessPerson = { email: string; expiresAt: string | null; userId: string | null };

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
// 제목은 첫 줄(첫 엔터 직전)까지만 — 일정 추가 시 엔터로 세부를 다음 줄에 적는 경우 대비.
function firstLine(s: string): string {
  return (s ?? "").split("\n")[0].trim();
}
// 익명 계정 해시 — 같은 계정을 하루 단위로 셀 수 있게만 한다. 단방향(salt+이메일 → sha256)이라
// 원문 이메일/user_id는 저장되지 않는다(개인정보 비저장 원칙 유지). salt는 서버 전용 비밀.
function accountHashOf(email: string): string {
  const salt =
    process.env.VISIT_HASH_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "vic-visit-salt";
  return createHash("sha256").update(`${salt}:${email}`).digest("hex").slice(0, 32);
}

const ROLE_ORDER = ["viewer", "worker", "manager", "owner", "developer"] as const;
const DEVICE_SET = new Set(["desktop", "android", "ios", "mobile"]);
// 트렌드 누적 막대용 역할/기기 카테고리(라벨·색) — 클라이언트 ROLE_META/DEVICE_META와 동일.
const ROLE_TREND_META = [
  { key: "viewer", label: "시청자", color: "#9aa0ab" },
  { key: "worker", label: "작업자", color: "#f59e0b" },
  { key: "manager", label: "매니저", color: "#7c6cf0" },
  { key: "owner", label: "관리자", color: "#34d399" },
  { key: "developer", label: "개발자", color: "#60a5fa" }
];
const DEVICE_TREND_META = [
  { key: "desktop", label: "웹", color: "#6b8cef" },
  { key: "android", label: "안드로이드", color: "#3ddc84" },
  { key: "ios", label: "iOS", color: "#a1a1aa" },
  { key: "mobile", label: "기타", color: "#f59e0b" }
];

// ── 방문/체류 통합 '세션 이벤트' 기록 ──
// 화면이 보이기 시작할 때 한 줄 생성(start) → 하트비트로 last_seen 갱신(touch) → 나갈 때 ended_at
// 확정(end). 재진입하면 또 한 줄(여러 번 기록). 역할/계정은 서버에서 실제 actor로 확인(위조 방지),
// 원문 이메일·user_id는 저장하지 않고 익명 해시만. id는 서버 생성 uuid(추측 불가)라 touch/end는 id로만.
export async function startVisitSession(device: string): Promise<{ ok: boolean; id?: string }> {
  const actor = await resolveCurrentActor(SLUG);
  if (!actor.isAuthenticated) return { ok: false };
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false };
  const safeDevice = DEVICE_SET.has(device) ? device : "desktop";
  const nowIso = new Date().toISOString();
  try {
    const { data, error } = await supabase
      .from("visit_session")
      .insert({
        day: ymd(kstNow()),
        account_hash: actor.email ? accountHashOf(actor.email) : null,
        role: actor.role,
        device: safeDevice,
        started_at: nowIso,
        last_seen_at: nowIso
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false };
    return { ok: true, id: data.id as string };
  } catch {
    return { ok: false };
  }
}

export async function touchVisitSession(id: string): Promise<{ ok: boolean }> {
  if (!id) return { ok: false };
  const actor = await resolveCurrentActor(SLUG);
  if (!actor.isAuthenticated) return { ok: false };
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false };
  try {
    const { error } = await supabase
      .from("visit_session")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", id);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

export async function endVisitSession(id: string): Promise<{ ok: boolean }> {
  if (!id) return { ok: false };
  const actor = await resolveCurrentActor(SLUG);
  if (!actor.isAuthenticated) return { ok: false };
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false };
  try {
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("visit_session")
      .update({ ended_at: nowIso, last_seen_at: nowIso })
      .eq("id", id);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

// ── 세션 이벤트 집계 헬퍼(visit_session 기반, JS에서 계산) ──
// 규모가 작아(스트리머 1명) 행을 받아 JS로 집계한다 — 별도 RPC 불필요. 체류는 초 단위로 정확.
type SessionRow = {
  day: string;
  role: string;
  device: string;
  account_hash: string | null;
  started_at: string;
  last_seen_at: string;
  ended_at: string | null;
};
const KST_MS = 9 * 3600 * 1000;
function sStart(r: SessionRow): number {
  return new Date(r.started_at).getTime();
}
// 유효 종료 = ended_at(없으면 last_seen_at). 최소 1초(0초 방문도 한 조각 잡히게).
function sEnd(r: SessionRow): number {
  const start = sStart(r);
  const raw = new Date(r.ended_at ?? r.last_seen_at).getTime();
  return Number.isFinite(raw) && raw > start ? raw : start + 1000;
}
function sAcct(r: SessionRow): string {
  return r.account_hash ?? "anon";
}
function emptyVisitSlot(): VisitSlot {
  return {
    roles: Object.fromEntries(ROLE_ORDER.map((r) => [r, 0])),
    devices: Object.fromEntries([...DEVICE_SET].map((d) => [d, 0])),
    total: 0
  };
}
function emptyOccSlot(): OccSlot {
  return {
    roles: Object.fromEntries(ROLE_ORDER.map((r) => [r, 0])),
    devices: Object.fromEntries([...DEVICE_SET].map((d) => [d, 0])),
    avg: 0,
    peak: 0
  };
}
async function loadSessions(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  startDay: string,
  endDayExclusive: string
): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from("visit_session")
    .select("day, role, device, account_hash, started_at, last_seen_at, ended_at")
    .gte("day", startDay)
    .lt("day", endDayExclusive);
  return error || !Array.isArray(data) ? [] : (data as SessionRow[]);
}
// reach 슬롯: 방문자=(날짜|계정) 고유, 역할별=(날짜|계정) 고유/역할, 기기별=(날짜|계정|기기) 고유.
// 재진입(같은 날 같은 계정 여러 세션)은 reach에선 1로 합친다(순방문자 의미 유지).
function reachSlot(rows: SessionRow[]): VisitSlot {
  const slot = emptyVisitSlot();
  const seenAll = new Set<string>();
  const seenRole = new Map<string, Set<string>>();
  const seenDev = new Set<string>();
  for (const r of rows) {
    const id = `${r.day}|${sAcct(r)}`;
    if (!seenAll.has(id)) {
      seenAll.add(id);
      slot.total += 1;
    }
    if (r.role in slot.roles) {
      let s = seenRole.get(r.role);
      if (!s) {
        s = new Set();
        seenRole.set(r.role, s);
      }
      if (!s.has(id)) {
        s.add(id);
        slot.roles[r.role] += 1;
      }
    }
    const dk = `${id}|${r.device}`;
    if (r.device in slot.devices && !seenDev.has(dk)) {
      seenDev.add(dk);
      slot.devices[r.device] += 1;
    }
  }
  return slot;
}
// 관측된 일수(세션이 하나라도 있는 KST 날 수) — 월 점유 정규화용.
function observedDayCount(rows: SessionRow[]): number {
  return new Set(rows.map((r) => r.day)).size;
}
// 시간대별(KST 0..23) 평균 동접(=구간 초/3600/관측일수)과 최고 동접(스윕). 세션을 시간 경계로 쪼갠다.
function computeOccupancy(rows: SessionRow[], observedDays: number): OccSlot[] {
  const sec = Array.from({ length: 24 }, () => ({
    role: {} as Record<string, number>,
    device: {} as Record<string, number>,
    total: 0
  }));
  const evs = Array.from({ length: 24 }, () => [] as { t: number; d: number }[]);
  for (const r of rows) {
    let cur = sStart(r);
    const end = sEnd(r);
    while (cur < end) {
      const kst = cur + KST_MS;
      const hourEndUtc = (Math.floor(kst / 3600000) + 1) * 3600000 - KST_MS;
      const segEnd = Math.min(end, hourEndUtc);
      const h = Math.floor(kst / 3600000) % 24;
      const s = (segEnd - cur) / 1000;
      const b = sec[h];
      b.total += s;
      b.role[r.role] = (b.role[r.role] ?? 0) + s;
      b.device[r.device] = (b.device[r.device] ?? 0) + s;
      evs[h].push({ t: cur, d: 1 });
      evs[h].push({ t: segEnd, d: -1 });
      cur = segEnd;
    }
  }
  const denom = 3600 * Math.max(1, observedDays);
  return sec.map((b, h) => {
    const occ = emptyOccSlot();
    occ.avg = b.total / denom;
    for (const role of ROLE_ORDER) occ.roles[role] = (b.role[role] ?? 0) / denom;
    for (const dev of DEVICE_SET) occ.devices[dev] = (b.device[dev] ?? 0) / denom;
    const ev = evs[h].sort((a, b2) => a.t - b2.t || a.d - b2.d);
    let cnt = 0;
    let mx = 0;
    for (const x of ev) {
      cnt += x.d;
      if (cnt > mx) mx = cnt;
    }
    occ.peak = mx;
    return occ;
  });
}
// 관리자(owner) 세션 목록 — 최근 순. 체류는 초 단위(짧으면 UI가 '초'로 표시).
function ownerSessionsFrom(rows: SessionRow[]): OwnerSession[] {
  return rows
    .filter((r) => r.role === "owner")
    .map((r) => {
      const startMs = sStart(r);
      const endMs = sEnd(r);
      const seconds = Math.max(0, Math.round((endMs - startMs) / 1000));
      return {
        device: DEVICE_SET.has(r.device) ? r.device : "desktop",
        startMs,
        endMs,
        minutes: Math.round(seconds / 60),
        seconds
      };
    })
    .filter((s) => Number.isFinite(s.startMs) && Number.isFinite(s.endMs))
    .sort((a, b) => b.startMs - a.startMs);
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
  // 활성 세션을 한 번만 이메일 해석 → activeUnlocks(목록)와 access(역할별 매핑)에서 함께 쓴다.
  const unlockResolved = await Promise.all(
    unlockRows.map(async (u) => ({
      userId: u.user_id,
      email: (await emailFor(u.user_id)) ?? "(알 수 없음)",
      expiresAt: u.expires_at
    }))
  );
  const activeUnlocks = unlockResolved.map((u) => ({ email: u.email, expiresAt: u.expiresAt }));
  const unlockByEmail = new Map(
    unlockResolved.map((u) => [u.email, { userId: u.userId, expiresAt: u.expiresAt }])
  );
  const toAccess = (email: string): AccessPerson => {
    const s = unlockByEmail.get(email);
    return { email, expiresAt: s?.expiresAt ?? null, userId: s?.userId ?? null };
  };
  const passcode = passcodeRes.data as {
    passcode_version?: number;
    passcode_updated_at?: string;
    unlock_duration_minutes?: number;
  } | null;

  const ownerEmails = getOwnerEmails();
  const dbOwnerEmail = await emailFor(cal.owner_id as string | undefined);
  const bindingOk = Boolean(ownerEmails[0] && dbOwnerEmail && ownerEmails[0] === dbOwnerEmail);

  // 비공개 접근 자격자(매니저 제외) — 소유자(env)·개발자(platform_admins)·작업자(신뢰 멤버).
  const { data: adminRows } = await supabase.from("platform_admins").select("email");
  const developerEmails = [
    ...new Set(
      ((adminRows ?? []) as { email?: string }[])
        .map((a) => normalizeEmail(a.email))
        .filter((e): e is string => Boolean(e))
    )
  ];
  const workerEmails = members.filter((m) => m.worker).map((m) => m.email);
  const access = {
    owners: ownerEmails.map(toAccess),
    developers: developerEmails.map(toAccess),
    workers: workerEmails.map(toAccess)
  };

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
      engagement: { monthHearts, totalHearts, monthly, topEvents },
      security: {
        passcodeVersion: passcode?.passcode_version ?? null,
        passcodeUpdatedAt: passcode?.passcode_updated_at ?? null,
        unlockDurationMinutes: passcode?.unlock_duration_minutes ?? null,
        activeUnlocks,
        members,
        access
      },
      system: {
        ownerEmails,
        developerEmails,
        dbOwnerEmail,
        bindingOk,
        commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        // 빌드(배포) 시각 — next.config의 BUILD_TIME(빌드 시점 UTC). 로컬은 현재 시각으로 폴백.
        deployedAt: process.env.BUILD_TIME ?? new Date().toISOString()
      }
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
  visits: number[];
  content: number[]; // 휴뱅 제외 공개 일정
  contentByTag: TrendStack; // 태그별 컨텐츠 6개월(휴뱅 포함)
  heartsByTag: TrendStack; // 하트 받은 태그 6개월(컨텐츠 방영월 기준)
  visitsByRole: TrendStack; // 방문 역할별 6개월(개발자 전용)
  visitsByDevice: TrendStack; // 방문 기기별 6개월(개발자 전용)
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

  const [visitRes, eventsRes, tagsRes, paletteRes, heartsRes] = await Promise.all([
    supabase
      .from("visit_session")
      .select("day, role, device, account_hash, started_at, last_seen_at, ended_at")
      .gte("day", fromStart)
      .lt("day", nextMonthStart),
    supabase
      .from("events")
      .select("id, date_key")
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
    supabase.rpc("get_event_heart_counts", { p_calendar_id: calendarId })
  ]);

  const tagRows2 = (tagsRes.data ?? []) as {
    event_id: string;
    broadcast_tags?: { id?: string; display_name?: string; color_key?: string };
  }[];
  const restIds = new Set<string>();
  for (const row of tagRows2) {
    if (row.broadcast_tags?.display_name === REST_TAG) restIds.add(row.event_id);
  }
  // 월별 방문 = (날짜, 계정) 고유 쌍 수(계정당 하루 1 — 순방문자). 재진입 세션은 1로 합친다.
  const visitRows = (visitRes.data ?? []) as SessionRow[];
  const vMap = new Map(monthKeys.map((k) => [k, 0]));
  const vSeen = new Set<string>();
  for (const row of visitRows) {
    const ym = row.day.slice(0, 7);
    const k = `${row.day}|${sAcct(row)}`;
    if (vSeen.has(k)) continue;
    vSeen.add(k);
    if (vMap.has(ym)) vMap.set(ym, (vMap.get(ym) ?? 0) + 1);
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
  for (const row of tagRows2) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id); // 공개 일정만(비공개는 매핑 없음 → 제외)
    if (!bt?.id || !ym) continue;
    contentTagRows.push({ ym, key: bt.id, n: 1 });
    const cur = tagInfo.get(bt.id);
    if (cur) cur.total += 1;
    else
      tagInfo.set(bt.id, {
        name: bt.display_name ?? "?",
        color: palette.get(bt.color_key ?? "") ?? "#cdc6ec",
        total: 1
      });
  }
  const contentCats = [...tagInfo.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, v]) => ({ key, label: v.name, color: v.color }));

  // 하트 받은 태그 6개월 — 각 일정의 하트(총합)를 그 일정의 방영월·태그에 합산.
  const heartByEvent = new Map<string, number>();
  for (const r of (heartsRes.data ?? []) as { event_id: string; count: number }[]) {
    heartByEvent.set(r.event_id, Number(r.count));
  }
  const heartTagInfo = new Map<string, { name: string; color: string; total: number }>();
  const heartTagRows: { ym: string; key: string; n: number }[] = [];
  for (const row of tagRows2) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id);
    if (!bt?.id || !ym) continue;
    const h = heartByEvent.get(row.event_id) ?? 0;
    if (h <= 0) continue;
    heartTagRows.push({ ym, key: bt.id, n: h });
    const cur = heartTagInfo.get(bt.id);
    if (cur) cur.total += h;
    else
      heartTagInfo.set(bt.id, {
        name: bt.display_name ?? "?",
        color: palette.get(bt.color_key ?? "") ?? "#f7a8c0",
        total: h
      });
  }
  const heartCats = [...heartTagInfo.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([key, v]) => ({ key, label: v.name, color: v.color }));

  // 방문 역할별/기기별 6개월(개발자 전용). 둘 다 순방문자 기준: 역할별=(날짜,계정) 1회,
  // 기기별=(날짜,계정,기기) 1회(한 계정이 웹·iOS면 둘 다 1). 재진입 세션은 합친다.
  const roleRows: { ym: string; key: string; n: number }[] = [];
  const devRows: { ym: string; key: string; n: number }[] = [];
  const roleSeen = new Set<string>();
  const devSeen = new Set<string>();
  for (const row of visitRows) {
    const ym = row.day.slice(0, 7);
    const id = `${row.day}|${sAcct(row)}`;
    const dk = `${id}|${row.device}`;
    if (!devSeen.has(dk)) {
      devSeen.add(dk);
      devRows.push({ ym, key: row.device, n: 1 });
    }
    if (roleSeen.has(id)) continue;
    roleSeen.add(id);
    roleRows.push({ ym, key: row.role, n: 1 });
  }

  return {
    ok: true,
    data: {
      months: monthKeys,
      visits: monthKeys.map((k) => vMap.get(k) ?? 0),
      content: monthKeys.map((k) => cMap.get(k) ?? 0),
      contentByTag: buildTrendStack(monthKeys, contentCats, contentTagRows),
      heartsByTag: buildTrendStack(monthKeys, heartCats, heartTagRows),
      visitsByRole: buildTrendStack(monthKeys, ROLE_TREND_META, roleRows),
      visitsByDevice: buildTrendStack(monthKeys, DEVICE_TREND_META, devRows)
    }
  };
}

type VisitSlot = {
  roles: Record<string, number>;
  devices: Record<string, number>;
  total: number;
};
// 시간대 동시 접속(체류) — roles/devices/avg는 평균 동시 접속(소수 가능, =핑/60), peak는 최고 동시 접속.
export type OccSlot = {
  roles: Record<string, number>;
  devices: Record<string, number>;
  avg: number;
  peak: number;
};
// 관리자(owner) 접속 세션 한 건 — 기기, 시작/종료(epoch ms, KST는 클라에서 +9h), 머문 분(핑 수).
export type OwnerSession = {
  device: string;
  startMs: number;
  endMs: number;
  minutes: number;
  seconds: number; // 초 단위 체류(짧은 방문은 UI가 '초'로 표시)
};
export type VisitTrends = {
  ready: boolean; // visit_log 접근 가능(테이블 적용) 여부
  hasData: boolean; // 이 달 방문 기록이 있는지
  days: ({ day: number } & VisitSlot)[]; // 이 달 1..말일
  weeks: ({ label: string } & VisitSlot)[]; // 1주차..
  hours: VisitSlot[]; // 24칸(KST) — 첫 진입 시각 분포(역할/기기 분해)
  occupancy: OccSlot[]; // 24칸(KST) — 시간대별 평균/최고 동시 접속(체류)
  hasOccupancy: boolean; // presence_ping 핑이 쌓여 점유 그래프를 그릴 수 있는지
  ownerSessions: OwnerSession[]; // 관리자(owner) 접속 세션(이 달, 최근 순) — 개발자 방문 패널 전용
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
  // 그 달 1일의 요일(0=일). 주차를 단순 7일 묶음이 아니라 달력 주(일요일 시작)로 끊기 위함.
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const emptySlot = (): VisitSlot => ({
    roles: Object.fromEntries(ROLE_ORDER.map((r) => [r, 0])),
    devices: Object.fromEntries([...DEVICE_SET].map((d) => [d, 0])),
    total: 0
  });
  const emptyOcc = (): OccSlot => ({
    roles: Object.fromEntries(ROLE_ORDER.map((r) => [r, 0])),
    devices: Object.fromEntries([...DEVICE_SET].map((d) => [d, 0])),
    avg: 0,
    peak: 0
  });
  const emptyDays = () =>
    Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1, ...emptySlot() }));

  const { data, error } = await supabase
    .from("visit_session")
    .select("day, role, device, account_hash, started_at, last_seen_at, ended_at")
    .gte("day", monthStart)
    .lt("day", nextMonthStart);

  if (error) {
    return {
      ok: true,
      data: {
        ready: false,
        hasData: false,
        days: emptyDays(),
        weeks: [],
        hours: Array.from({ length: 24 }, emptySlot),
        occupancy: Array.from({ length: 24 }, emptyOcc),
        hasOccupancy: false,
        ownerSessions: [],
        total: 0
      }
    };
  }
  const rows = (data ?? []) as SessionRow[];

  // 방문수/역할별은 순방문자((날짜,계정) 1회), 기기별은 (날짜,계정,기기) 1회. reachSlot이 처리.
  // 재진입 세션은 reach에선 합쳐지고, 체류(occupancy)·관리자 세션 목록에서 각각 따로 잡힌다.
  const slotFromRows = (group: SessionRow[]): VisitSlot => reachSlot(group);

  const rowsByDay = new Map<number, SessionRow[]>();
  const rowsByWeek = new Map<number, SessionRow[]>();
  for (const row of rows) {
    const d = Number(row.day.slice(8, 10));
    if (d >= 1 && d <= daysInMonth) {
      const arr = rowsByDay.get(d) ?? [];
      arr.push(row);
      rowsByDay.set(d, arr);
    }
    // 달력 주차(일요일 시작): 1일이 무슨 요일인지 더해 끊는다. 예) 5/1=금 → 5/24~30이 5주차라
    // 5/28·5/29가 같은 5주차로 묶인다(이전엔 단순 (d-1)/7이라 28→4주·29→5주로 갈렸음).
    const wi = Math.floor((d - 1 + firstWeekday) / 7);
    const warr = rowsByWeek.get(wi) ?? [];
    warr.push(row);
    rowsByWeek.set(wi, warr);
  }
  const days = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    ...slotFromRows(rowsByDay.get(i + 1) ?? [])
  }));

  // 시간대(KST): 역할/방문은 그 (날짜,계정)의 '첫 진입 시각'에 1회, 기기는 (날짜,계정,기기) 첫 진입에 1회.
  const hours = Array.from({ length: 24 }, emptySlot);
  const firstEntry = new Map<string, { hour: number; role: string; t: number }>();
  const devFirst = new Map<string, { hour: number; device: string; t: number }>();
  for (const row of rows) {
    const t = sStart(row);
    if (!Number.isFinite(t)) continue;
    const hour = Math.floor((t + KST_MS) / 3600000) % 24;
    const id = `${row.day}|${sAcct(row)}`;
    const prev = firstEntry.get(id);
    if (!prev || t < prev.t) firstEntry.set(id, { hour, role: row.role, t });
    const dk = `${id}|${row.device}`;
    const dprev = devFirst.get(dk);
    if (!dprev || t < dprev.t) devFirst.set(dk, { hour, device: row.device, t });
  }
  for (const v of firstEntry.values()) {
    const slot = hours[v.hour];
    if (v.role in slot.roles) slot.roles[v.role] += 1;
    slot.total += 1;
  }
  for (const v of devFirst.values()) {
    const slot = hours[v.hour];
    if (v.device in slot.devices) slot.devices[v.device] += 1;
  }

  const weekCount = Math.ceil((daysInMonth + firstWeekday) / 7);
  const weeks = Array.from({ length: weekCount }, (_, i) => ({
    label: `${i + 1}주`,
    ...slotFromRows(rowsByWeek.get(i) ?? [])
  }));

  // 시간대 동시 접속(체류) — 세션 구간을 시간대별로 쪼개 초 단위로 집계. 평균 동접 = 구간초/(3600×관측일수)
  // ('전형적인 하루' 기준 정규화), 최고 동접 = 그 시간대 내 동시 세션 최댓값(스윕). 1초 방문도 잡힌다.
  const observedDays = observedDayCount(rows);
  const occupancy = computeOccupancy(rows, observedDays);
  const hasOccupancy = rows.length > 0 && occupancy.some((o) => o.avg > 0);
  // 관리자 접속 세션(최근 순) — 세션 행에서 직접(role=owner).
  const ownerSessions = ownerSessionsFrom(rows);

  return {
    ok: true,
    data: {
      ready: true,
      hasData: rows.length > 0,
      days,
      weeks,
      hours,
      occupancy,
      hasOccupancy,
      ownerSessions,
      total: reachSlot(rows).total
    }
  };
}

// 하루치 방문 상세 — 개발자가 달력에서 날짜를 클릭하면 그날 통계를 드릴다운으로 본다.
// 월별(getVisitTrends)과 같은 지표를 '그 하루'로 좁힌 것: 방문 수(역할/기기), 24h 동시 접속, 관리자 세션.
// 기존 RPC에 하루 범위(p_start=그날, p_end=다음날)를 넘겨 재사용 — 새 DB 작업 없음. 개발자 전용.
export type DayVisitDetail = {
  dateKey: string;
  visits: VisitSlot; // 그날 방문 수 + 역할/기기 분해
  occupancy: OccSlot[]; // 24칸(KST) — 그날 시간대별 평균/최고 동시 접속
  hasOccupancy: boolean;
  ownerSessions: OwnerSession[]; // 그날 관리자 접속 세션
  // 그날 '관리자(owner)' 방문 기록 — 세션별. 언제(started_at)·기기·체류(초)·계정(설정된 owner
  // 이메일과 해시 매칭되면 이메일, 아니면 익명 태그). 일반 방문자는 절대 식별되지 않는다.
  ownerVisits: { t: number; device: string; account: string; seconds: number }[];
  // 그날 관리자(owner) 총 체류 초. 세션 합. 매우 짧으면(예: 0~1초) 화면을 사실상 안 본 것.
  ownerSeconds: number;
};
export type DayVisitDetailResult = { ok: true; data: DayVisitDetail } | { ok: false; error: string };

export async function getDayVisitDetailAction(dateKey: string): Promise<DayVisitDetailResult> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") {
    return { ok: false, error: "개발자만 볼 수 있는 화면입니다." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return { ok: false, error: "잘못된 날짜입니다." };
  }
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  }
  const [yy, mm, dd] = dateKey.split("-").map(Number);
  const nextDay = ymd(new Date(Date.UTC(yy, mm - 1, dd + 1))); // 다음 날(day 컬럼은 KST 날짜)

  const rows = await loadSessions(supabase, dateKey, nextDay);

  // 방문 수(역할/기기 분해) = 순방문자, 체류 그래프 = 세션 구간(초), 관리자 세션 = role=owner.
  const visits = reachSlot(rows);
  const occupancy = computeOccupancy(rows, 1);
  const hasOccupancy = rows.length > 0 && occupancy.some((o) => o.avg > 0);
  const ownerSessions = ownerSessionsFrom(rows);

  // 관리자(owner) 방문 기록 — 세션별(여러 번 들어오면 여러 줄). 설정된 owner 이메일과 해시가 맞으면
  // 이메일로, 아니면 익명 #N(일반 방문자는 매칭 집합에 없어 절대 이메일로 안 풀림). 체류는 초 단위.
  const hashToOwnerEmail = new Map(getOwnerEmails().map((e) => [accountHashOf(e), e] as const));
  const acctTag = new Map<string, number>();
  const ownerVisits = rows
    .filter((r) => r.role === "owner")
    .map((r) => {
      const h = r.account_hash ?? "";
      if (!acctTag.has(h)) acctTag.set(h, acctTag.size + 1);
      const startMs = sStart(r);
      return {
        t: startMs,
        device: DEVICE_SET.has(r.device) ? r.device : "desktop",
        account: hashToOwnerEmail.get(h) ?? `계정 #${acctTag.get(h)}`,
        seconds: Math.max(0, Math.round((sEnd(r) - startMs) / 1000))
      };
    })
    .sort((a, b) => a.t - b.t);
  const ownerSeconds = ownerVisits.reduce((sum, v) => sum + v.seconds, 0);

  return {
    ok: true,
    data: { dateKey, visits, occupancy, hasOccupancy, ownerSessions, ownerVisits, ownerSeconds }
  };
}

// 관리자(소유자) 전용 보안 데이터 — 개발자 인사이트 보안 패널과 같되 '개발자' 섹션은 뺀다.
// owner/developer만(서버 검증) — 매니저·작업자에겐 절대 내려가지 않는다(민감: 이메일·세션).
export type OwnerSecurityData = {
  activeUnlockCount: number;
  passcodeVersion: number | null;
  passcodeUpdatedAt: string | null;
  unlockDurationMinutes: number | null;
  access: { owners: AccessPerson[]; developers: AccessPerson[]; workers: AccessPerson[] };
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

  const [unlockRes, membersRes, passcodeRes, adminRes] = await Promise.all([
    supabase
      .from("unlock_sessions")
      .select("user_id, expires_at")
      .eq("calendar_id", calendarId)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true }),
    supabase
      .from("trusted_members")
      .select("email, is_worker, trusted_role")
      .eq("calendar_id", calendarId)
      .eq("is_active", true),
    supabase
      .from("private_layer_settings")
      .select("passcode_version, passcode_updated_at, unlock_duration_minutes")
      .eq("calendar_id", calendarId)
      .maybeSingle(),
    // 개발자(platform_admins) 이메일 — 관리자 화면엔 표시하지 않고, "지금 연 계정" 수에서 제외할 때만 쓴다.
    supabase.from("platform_admins").select("email")
  ]);

  const emailCache = new Map<string, string | null>();
  const emailFor = async (id: string): Promise<string | null> => {
    if (emailCache.has(id)) return emailCache.get(id) ?? null;
    let email: string | null = null;
    try {
      const { data } = await supabase.auth.admin.getUserById(id);
      email = normalizeEmail(data?.user?.email);
    } catch {
      email = null;
    }
    emailCache.set(id, email);
    return email;
  };

  // 관리자 화면은 개발자가 없는 듯 다룬다 → 개발자 세션은 "지금 연 계정" 수에서 처음부터 뺀다.
  const developerEmailSet = new Set(
    ((adminRes.data ?? []) as { email?: string }[])
      .map((a) => normalizeEmail(a.email))
      .filter((e): e is string => Boolean(e))
  );
  const unlockRows = (unlockRes.data ?? []) as { user_id: string; expires_at: string }[];
  const unlockByEmail = new Map<string, { userId: string; expiresAt: string }>();
  let activeNonDevCount = 0;
  for (const u of unlockRows) {
    const e = (await emailFor(u.user_id)) ?? "(알 수 없음)";
    unlockByEmail.set(e, { userId: u.user_id, expiresAt: u.expires_at });
    if (!developerEmailSet.has(e)) activeNonDevCount += 1;
  }
  const toAccess = (email: string): AccessPerson => {
    const s = unlockByEmail.get(email);
    return { email, expiresAt: s?.expiresAt ?? null, userId: s?.userId ?? null };
  };

  const workerEmails = [
    ...new Set(
      ((membersRes.data ?? []) as { email: string; is_worker?: boolean; trusted_role?: string }[])
        .filter((m) => Boolean(m.is_worker ?? m.trusted_role === "worker"))
        .map((m) => m.email)
    )
  ];
  const passcode = passcodeRes.data as {
    passcode_version?: number;
    passcode_updated_at?: string;
    unlock_duration_minutes?: number;
  } | null;

  return {
    ok: true,
    data: {
      activeUnlockCount: activeNonDevCount,
      passcodeVersion: passcode?.passcode_version ?? null,
      passcodeUpdatedAt: passcode?.passcode_updated_at ?? null,
      unlockDurationMinutes: passcode?.unlock_duration_minutes ?? null,
      access: {
        owners: getOwnerEmails().map(toAccess),
        developers: [],
        workers: workerEmails.map(toAccess)
      }
    }
  };
}

// ── 멤버용(관리자·매니저·작업자) 월별 인사이트 — 수치 없는 4패널(일정·참여·트렌드·하이라이트) ──
// 보안 경계: 보안/시스템/방문 원시 데이터는 이 타입에 아예 없다. 바 크기는 0~1 비율만 보내(원시 수치
// 미노출), 허용된 하트 합계(이 달/누적)만 숫자로 준다. 하이라이트의 방문 최다일·시간대는 "날짜·시"만.
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
    contentByTag: TrendStack; // 태그별 컨텐츠 6개월(수치 노출 OK)
    heartsByTag: TrendStack; // 하트 받은 태그 6개월 — 비율만(정규화, 정확 수 숨김)
  };
  highlight: {
    peakDay: string | null; // 방문 최다일(YYYY-MM-DD) — 인원수 없음(방문 수는 민감)
    peakHour: number | null; // 최고 시간대(0~23)
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
  const todayKey = ymd(kstNow());
  const curYm = `${y}-${pad(m)}`;
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  }
  const sixStart = `${monthKeys[0]}-01`;

  const [eventsRes, tagsRes, nextRes, paletteRes, heartsRes, visitRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, date_key, is_public")
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
      .eq("calendar_id", calendarId)
      .eq("is_public", true)
      .gte("date_key", todayKey)
      .order("date_key", { ascending: true })
      .limit(40),
    supabase.from("color_palette").select("key, bg_color, border_color").eq("calendar_id", calendarId),
    supabase.rpc("get_event_heart_counts", { p_calendar_id: calendarId }),
    supabase
      .from("visit_session")
      .select("day, account_hash, started_at")
      .gte("day", monthStart)
      .lt("day", nextMonthStart)
  ]);

  // 휴뱅 일정 id + 태그(6개월) 집계.
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
  for (const row of tagRows) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id);
    if (!bt?.id || !ym) continue;
    ctRows.push({ ym, key: bt.id, n: 1 });
    const cur = ctTagInfo.get(bt.id);
    if (cur) cur.total += 1;
    else
      ctTagInfo.set(bt.id, {
        name: bt.display_name ?? "?",
        color: colorMap.get(bt.color_key ?? "")?.bg ?? "#cdc6ec",
        total: 1
      });
  }
  const contentByTag = buildTrendStack(
    monthKeys,
    [...ctTagInfo.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .map(([key, v]) => ({ key, label: v.name, color: v.color })),
    ctRows
  );

  const tagCount = new Map<string, { name: string; count: number; bgColor: string; borderColor: string }>();
  for (const row of tagRows) {
    const name = row.broadcast_tags?.display_name;
    if (!name || name === REST_TAG || !thisMonthIds.has(row.event_id)) continue;
    const cur = tagCount.get(name);
    if (cur) cur.count += 1;
    else {
      const col = colorMap.get(row.broadcast_tags?.color_key ?? "");
      tagCount.set(name, { name, count: 1, bgColor: col?.bg ?? "#cdc6ec", borderColor: col?.border ?? "#b3a9dd" });
    }
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

  // 하트 받은 태그 6개월 — 비율만(정규화로 정확 수 숨김, 막대 비율·높이만 유지). showNumbers=false.
  const memHeartByEvent = new Map<string, number>(
    heartCounts.map((h) => [h.event_id, Number(h.count)])
  );
  const hbtInfo = new Map<string, { name: string; color: string; total: number }>();
  const hbtRows: { ym: string; key: string; n: number }[] = [];
  for (const row of tagRows) {
    const bt = row.broadcast_tags;
    const ym = eventMonth.get(row.event_id);
    if (!bt?.id || !ym) continue;
    const h = memHeartByEvent.get(row.event_id) ?? 0;
    if (h <= 0) continue;
    hbtRows.push({ ym, key: bt.id, n: h });
    const cur = hbtInfo.get(bt.id);
    if (cur) cur.total += h;
    else
      hbtInfo.set(bt.id, {
        name: bt.display_name ?? "?",
        color: colorMap.get(bt.color_key ?? "")?.bg ?? "#f7a8c0",
        total: h
      });
  }
  const hbtRaw = buildTrendStack(
    monthKeys,
    [...hbtInfo.entries()]
      .sort((a, b) => b[1].total - a[1].total)
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

  // 하이라이트: 방문 최다일·최고 시간대(날짜·시만, 수치 없음). 방문은 계정 단위라 (날짜,계정)당 1회만
  // 세고(최다일=계정 수), 시간대는 그 (날짜,계정)의 '첫 진입 시각'으로 센다.
  const visitRows = (visitRes.data ?? []) as {
    day: string;
    account_hash: string | null;
    started_at: string;
  }[];
  const dayTally = new Map<string, number>();
  const hourTally = Array(24).fill(0) as number[];
  const hlFirst = new Map<string, { hour: number; t: number }>();
  const hlDaySeen = new Set<string>();
  for (const row of visitRows) {
    const id = `${row.day}|${row.account_hash ?? "anon"}`;
    if (!hlDaySeen.has(id)) {
      hlDaySeen.add(id);
      dayTally.set(row.day, (dayTally.get(row.day) ?? 0) + 1);
    }
    const t = new Date(row.started_at).getTime();
    if (Number.isNaN(t)) continue;
    const h = Math.floor((t + KST_MS) / 3600000) % 24;
    const prev = hlFirst.get(id);
    if (!prev || t < prev.t) hlFirst.set(id, { hour: h, t });
  }
  for (const v of hlFirst.values()) hourTally[v.hour] += 1;
  let peakDay: string | null = null;
  let peakDayCount = 0;
  for (const [day, c] of dayTally) {
    if (c > peakDayCount) {
      peakDayCount = c;
      peakDay = day;
    }
  }
  const peakHourCount = Math.max(0, ...hourTally);
  const peakHour = peakHourCount > 0 ? hourTally.indexOf(peakHourCount) : null;

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
      trend: { months: monthKeys, content: contentCounts, hearts: monthlyCounts, contentByTag, heartsByTag },
      highlight: { peakDay, peakHour, topTitle, busiestWeekday }
    }
  };
}
