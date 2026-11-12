import { createSupabaseAdminClient } from "@/lib/auth/admin";
import { kstDayKey } from "@/lib/calendar/month";
import {
  getInsightsAction,
  getTrendAction,
  getVisitTrendsAction,
  type InsightsData,
  type TrendData,
  type VisitTrends
} from "@/lib/insights/actions";
import { runAsInsightsSystem } from "@/lib/insights/system-context";

// 연간 인사이트 아카이브(0160, 2026-11-13 소유자 결정).
//  · 1월 1일(KST)부터 지난해 1~12월을 월별 숫자로 남긴다(첫 자동 실행 2027-01-01 → 2026년).
//  · 원본 통계는 그 해 아카이브가 12달 모두 있을 때만, 다음 해 2월 1일(KST)부터 지운다(한 달 동안 소유자가 확인).
//  · 올해는 절대 지우지 않는다. 지우기 시작한 해의 아카이브는 다시 덮어쓰지 않는다(원본이 비어 0으로 덮인다).
// 집계는 개발자 인사이트와 **같은 함수**를 시스템 문맥으로 부른다 — 화면과 아카이브 숫자가 어긋나지 않는다.

const SLUG = "vic";
export const ARCHIVE_SCHEMA_VERSION = 1;
// 보관함은 **한 해 통째로만** 만든다(2026-11-13 소유자): 12월 31일(KST)이 지난 해만. 일정 기록은 2024년부터라
// 그 해부터 고를 수 있고, 원본 통계(방문·이용·속도)는 2026-06부터라 그 전 해는 일정 숫자만 담긴다.
export const FIRST_ARCHIVE_YEAR = 2024;
export const STATS_START_YEAR = 2026;
// 만든 지 이만큼 지난 보관본만 원본 삭제 근거가 된다 — 지난 해를 손으로 막 만든 직후 곧바로 지워지지 않게(0164).
export const PURGE_MIN_AGE_DAYS = 30;
export const PURGE_TABLES = ["activity_event", "visit_session", "perf_samples"] as const;
const DAY_MS = 86_400_000;

export type ArchivePayload = { insights: InsightsData | null; trend: TrendData | null; visits: VisitTrends | null };
export type ArchiveMonth = { month: number; builtAt: string; payload: ArchivePayload };

export function kstYearMonth(now: number | Date = Date.now()): { year: number; month: number; day: number } {
  const [y, m, d] = kstDayKey(now).split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** 그 해에 아카이브할 달. 끝난 해 = 1~12, 올해·미래 = 없음(12월 31일이 지나야 만든다). */
export function monthsToArchive(year: number, now: number | Date = Date.now()): number[] {
  const cur = kstYearMonth(now);
  if (year < FIRST_ARCHIVE_YEAR || year >= cur.year) return [];
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

/** 그 해가 끝났는가(KST 다음 해 1월 1일 0시 이후) — 보관함 만들기 버튼이 켜지는 조건. */
export function isYearClosed(year: number, now: number | Date = Date.now()): boolean {
  return year < kstYearMonth(now).year;
}

function olderThan(builtAt: string, days: number, now: number | Date): boolean {
  return Date.parse(builtAt) <= +now - days * DAY_MS;
}

/** 원본 삭제가 시작될 수 있는 시점 = 다음 해 2월 1일(KST) 0시. */
export function purgeOpensAt(year: number): string {
  return `${year + 1}-02-01`;
}

/** 원본 삭제 가능: 지난해 이전 · 다음 해 2월 1일이 지남 · 12달 아카이브 완비 · 모든 달이 만든 지 30일 넘음. */
export function canPurgeYear(
  year: number,
  archived: { month: number; builtAt: string }[],
  now: number | Date = Date.now()
): boolean {
  const cur = kstYearMonth(now);
  if (year >= cur.year || year < FIRST_ARCHIVE_YEAR) return false;
  if (kstDayKey(now) < purgeOpensAt(year)) return false;
  const have = new Set(archived.map((r) => r.month));
  for (let m = 1; m <= 12; m++) if (!have.has(m)) return false;
  return archived.every((r) => olderThan(r.builtAt, PURGE_MIN_AGE_DAYS, now));
}

/**
 * 이미 만든 달을 다시 계산해 덮어써도 되는가 — 원본 삭제가 시작됐을 수 있는 해는 빈 원본으로 덮이므로 금지.
 * 삭제는 2월 1일 이후 · 만든 지 30일 넘은 보관본에서만 일어나므로, 그 전이거나 모든 달이 30일 안쪽이면 아직 안전하다.
 */
export function canOverwriteYear(
  year: number,
  archived: { builtAt: string }[] = [],
  now: number | Date = Date.now()
): boolean {
  if (kstDayKey(now) < purgeOpensAt(year)) return true;
  return archived.length > 0 && archived.every((r) => !olderThan(r.builtAt, PURGE_MIN_AGE_DAYS, now));
}

/** 아카이브에는 숫자만 — 세션 한 줄 한 줄(디버깅 로그)과 '오늘' 수집 상태는 뺀다. */
export function sanitizeForArchive(payload: ArchivePayload): ArchivePayload {
  const insights = payload.insights
    ? { ...payload.insights, content: { ...payload.insights.content, nextBroadcast: null } }
    : null;
  const visits = payload.visits
    ? { ...payload.visits, recent: [], health: { todaySessions: 0, openRate: 0, avgStaySec: 0 } }
    : null;
  return { insights, trend: payload.trend, visits };
}

type Db = NonNullable<ReturnType<typeof createSupabaseAdminClient>>;

async function calendarIdOf(db: Db): Promise<string | null> {
  const { data } = await db.from("calendars").select("id").eq("slug", SLUG).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function archivedRowsOf(
  db: Db,
  calendarId: string,
  year: number
): Promise<{ month: number; builtAt: string }[] | null> {
  const { data, error } = await db
    .from("insights_year_archive")
    .select("month, built_at")
    .eq("calendar_id", calendarId)
    .eq("year", year);
  if (error) return null;
  return ((data ?? []) as { month: number; built_at: string }[])
    .map((r) => ({ month: Number(r.month), builtAt: r.built_at }))
    .sort((a, b) => a.month - b.month);
}

/** 그 해가 끝나기 전(KST 다음 해 1/1 0시 전)에 만든 달 = 수동 시험본 — 1월 자동 실행이 한 번 새로 계산해 덮는다. */
export function builtBeforeYearEnd(year: number, builtAt: string): boolean {
  return Date.parse(builtAt) < Date.parse(`${year + 1}-01-01T00:00:00+09:00`);
}

/** 이번 실행에서 계산할 달: 없는 달 + (덮어쓰기 허용 시) 전부 또는 연말 전에 만든 달. */
export function monthsToBuild(
  candidates: number[],
  existing: { month: number; builtAt: string }[],
  mode: "missing" | "all" | "refresh-early",
  year: number
): number[] {
  const byMonth = new Map(existing.map((r) => [r.month, r.builtAt] as const));
  return candidates.filter((m) => {
    const at = byMonth.get(m);
    if (at === undefined) return true;
    if (mode === "all") return true;
    if (mode === "refresh-early") return builtBeforeYearEnd(year, at);
    return false;
  });
}

async function computeMonth(year: number, month: number): Promise<ArchivePayload | null> {
  // nano DB — 세 집계를 동시에 쏘지 않고 차례로. 하나라도 실패하면 그 달은 건너뛰고 다음 실행에서 다시.
  return runAsInsightsSystem(async () => {
    const insights = await getInsightsAction(year, month);
    if (!insights.ok) return null;
    const trend = await getTrendAction(year, month);
    if (!trend.ok) return null;
    const visits = await getVisitTrendsAction(year, month);
    if (!visits.ok) return null;
    return sanitizeForArchive({ insights: insights.data, trend: trend.data, visits: visits.data });
  });
}

export type BuildReport = { year: number; built: number[]; failed: number[]; remaining: number[]; done: boolean };

/**
 * 한 해 아카이브를 만든다. deadline까지만 일하고 남은 달을 돌려준다(크론·버튼이 이어서 부른다).
 * mode: missing = 없는 달만 · all = 전부 다시(개발자 버튼) · refresh-early = 없는 달 + 연말 전에 만든 시험본(1월 자동).
 * 원본 삭제가 열린 해(다음 해 2/1 이후)는 어떤 mode든 없는 달만 — 빈 원본으로 덮어쓰지 않는다.
 */
export async function buildYearArchive(opts: {
  year: number;
  mode?: "missing" | "all" | "refresh-early";
  only?: number[]; // 이어 하기 — 앞 실행이 돌려준 remaining만
  deadlineMs?: number;
  now?: number;
}): Promise<BuildReport | { error: string }> {
  const db = createSupabaseAdminClient();
  if (!db) return { error: "Supabase 서비스 키가 설정되지 않았습니다." };
  const calendarId = await calendarIdOf(db);
  if (!calendarId) return { error: "캘린더를 찾을 수 없습니다." };
  const now = opts.now ?? Date.now();
  const months = monthsToArchive(opts.year, now);
  const have = await archivedRowsOf(db, calendarId, opts.year);
  if (have === null) return { error: "아카이브 표를 읽지 못했어요(0160 적용 여부 확인)." };
  const mode = canOverwriteYear(opts.year, have, now) ? (opts.mode ?? "missing") : "missing";
  const todo = monthsToBuild(months, have, mode, opts.year).filter((m) => !opts.only || opts.only.includes(m));
  const deadline = opts.deadlineMs ?? Date.now() + 20_000;
  const built: number[] = [];
  const failed: number[] = [];
  for (const month of todo) {
    if (Date.now() > deadline) break;
    const payload = await computeMonth(opts.year, month);
    if (!payload) {
      failed.push(month);
      continue;
    }
    const { error } = await db.from("insights_year_archive").upsert(
      {
        calendar_id: calendarId,
        year: opts.year,
        month,
        schema_version: ARCHIVE_SCHEMA_VERSION,
        payload,
        built_at: new Date().toISOString()
      },
      { onConflict: "calendar_id,year,month" }
    );
    if (error) failed.push(month);
    else built.push(month);
  }
  const remaining = todo.filter((m) => !built.includes(m) && !failed.includes(m));
  return { year: opts.year, built, failed, remaining, done: remaining.length === 0 && failed.length === 0 };
}

export async function readYearArchive(year: number): Promise<{ months: ArchiveMonth[] } | { error: string }> {
  const db = createSupabaseAdminClient();
  if (!db) return { error: "Supabase 서비스 키가 설정되지 않았습니다." };
  const calendarId = await calendarIdOf(db);
  if (!calendarId) return { error: "캘린더를 찾을 수 없습니다." };
  const { data, error } = await db
    .from("insights_year_archive")
    .select("month, built_at, payload")
    .eq("calendar_id", calendarId)
    .eq("year", year)
    .order("month");
  if (error) return { error: "아카이브를 불러오지 못했어요." };
  return {
    months: ((data ?? []) as { month: number; built_at: string; payload: ArchivePayload }[]).map((r) => ({
      month: Number(r.month),
      builtAt: r.built_at,
      payload: r.payload
    }))
  };
}

/** 보관함 연도 고르기: 첫 일정이 있는 해(최소 FIRST_ARCHIVE_YEAR)부터 올해까지, 최신이 먼저. */
export async function listArchiveYears(now: number | Date = Date.now()): Promise<number[]> {
  const cur = kstYearMonth(now).year;
  let first = FIRST_ARCHIVE_YEAR;
  const db = createSupabaseAdminClient();
  if (db) {
    const calendarId = await calendarIdOf(db);
    const { data } = calendarId
      ? await db.from("events").select("date_key").eq("calendar_id", calendarId).order("date_key").limit(1)
      : { data: null };
    const firstYear = Number(String((data as { date_key?: string }[] | null)?.[0]?.date_key ?? "").slice(0, 4));
    if (Number.isInteger(firstYear) && firstYear > first) first = firstYear;
  }
  const years: number[] = [];
  for (let y = cur; y >= first; y--) years.push(y);
  return years;
}

export type PurgeReport = { year: number; dryRun: boolean; counts: Record<string, number>; done: boolean };

/** KST 기준 그 해 [1/1, 다음 해 1/1) 원본을 배치로 지운다. dryRun이면 남은 행 수만 센다. */
export async function purgeArchivedYear(opts: {
  year: number;
  dryRun?: boolean;
  deadlineMs?: number;
  now?: number;
}): Promise<PurgeReport | { error: string } | { skipped: string }> {
  const db = createSupabaseAdminClient();
  if (!db) return { error: "Supabase 서비스 키가 설정되지 않았습니다." };
  const calendarId = await calendarIdOf(db);
  if (!calendarId) return { error: "캘린더를 찾을 수 없습니다." };
  const have = await archivedRowsOf(db, calendarId, opts.year);
  if (have === null) return { error: "아카이브 표를 읽지 못했어요." };
  // 연말 전에 만든 시험본만 있는 해는 '완비'로 치지 않는다 — 1월 자동 실행이 새로 계산한 뒤에만 지운다.
  const finalRows = have.filter((r) => !builtBeforeYearEnd(opts.year, r.builtAt));
  if (!canPurgeYear(opts.year, finalRows, opts.now ?? Date.now())) return { skipped: "not-eligible" };
  const from = `${opts.year}-01-01`;
  const to = `${opts.year + 1}-01-01`;
  const counts: Record<string, number> = {};
  if (opts.dryRun) {
    for (const table of PURGE_TABLES) {
      const q =
        table === "perf_samples"
          ? db
              .from(table)
              .select("id", { count: "exact", head: true })
              .gte("created_at", `${from}T00:00:00+09:00`)
              .lt("created_at", `${to}T00:00:00+09:00`)
          : db.from(table).select("day", { count: "exact", head: true }).gte("day", from).lt("day", to);
      const { count } = await q;
      counts[table] = count ?? 0;
    }
    return { year: opts.year, dryRun: true, counts, done: false };
  }
  const deadline = opts.deadlineMs ?? Date.now() + 20_000;
  let done = true;
  for (const table of PURGE_TABLES) {
    counts[table] = 0;
    for (;;) {
      if (Date.now() > deadline) {
        done = false;
        break;
      }
      const { data, error } = await db.rpc("purge_stats_batch", { p_table: table, p_from: from, p_to: to, p_limit: 5000 });
      if (error) {
        done = false;
        break;
      }
      const n = Number(data ?? 0);
      counts[table] += n;
      if (n === 0) break;
    }
    if (!done) break;
  }
  return { year: opts.year, dryRun: false, counts, done };
}

/**
 * 시간별 Workers Cron이 부른다(app/api/cron/insights-archive). 할 일이 없으면 가벼운 조회 몇 개로 끝난다.
 *  ① 지난해 아카이브가 모자라면 이어서 만든다(없는 달 + 연말 전에 만든 시험본을 한 번 새로).
 *  ② 2월 1일이 지났고 12달이 다 있는 지난 해들의 원본을 배치로 지운다.
 */
export async function runInsightsMaintenance(now = Date.now(), budgetMs = 20_000) {
  const deadline = Date.now() + budgetMs;
  const cur = kstYearMonth(now);
  const report: { build?: BuildReport | { error: string }; purge: (PurgeReport | { error: string } | { skipped: string })[] } = {
    purge: []
  };
  const prevYear = cur.year - 1;
  if (prevYear >= FIRST_ARCHIVE_YEAR) {
    const build = await buildYearArchive({ year: prevYear, mode: "refresh-early", deadlineMs: deadline, now });
    if ("error" in build || build.built.length || build.failed.length) report.build = build;
  }
  for (let y = FIRST_ARCHIVE_YEAR; y < cur.year; y++) {
    if (Date.now() > deadline) break;
    if (kstDayKey(now) < purgeOpensAt(y)) continue;
    report.purge.push(await purgeArchivedYear({ year: y, deadlineMs: deadline, now }));
  }
  return report;
}
