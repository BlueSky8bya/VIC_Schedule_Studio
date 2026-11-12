import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  insights: vi.fn(),
  trend: vi.fn(),
  visits: vi.fn(),
  actor: vi.fn()
}));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/lib/auth/actor", () => ({ resolveCurrentActor: mocks.actor }));
vi.mock("@/lib/insights/actions", () => ({
  getInsightsAction: mocks.insights,
  getTrendAction: mocks.trend,
  getVisitTrendsAction: mocks.visits
}));

import {
  buildYearArchive,
  builtBeforeYearEnd,
  canOverwriteYear,
  canPurgeYear,
  monthsToArchive,
  monthsToBuild,
  purgeArchivedYear,
  sanitizeForArchive,
  type ArchivePayload
} from "@/lib/insights/archive";
import { isInsightsSystem, runAsInsightsSystem } from "@/lib/insights/system-context";

// KST 시각을 UTC 밀리초로.
const kst = (iso: string) => Date.parse(`${iso}+09:00`);
const all12 = Array.from({ length: 12 }, (_, i) => i + 1);

afterEach(() => vi.clearAllMocks());

describe("연간 아카이브 달 고르기(KST)", () => {
  it("지난해는 12달, 올해는 지난달까지, 미래·첫 해 이전은 없다", () => {
    const now = kst("2026-11-13T10:00:00");
    expect(monthsToArchive(2026, now)).toEqual(all12.slice(0, 10));
    expect(monthsToArchive(2027, now)).toEqual([]);
    expect(monthsToArchive(2025, now)).toEqual([]);
    expect(monthsToArchive(2026, kst("2027-01-01T00:05:00"))).toEqual(all12);
  });

  it("KST 자정 경계: UTC로는 12/31이어도 KST 1/1이면 지난해 전체", () => {
    // 2026-12-31T15:30Z = 2027-01-01 00:30 KST
    expect(monthsToArchive(2026, Date.parse("2026-12-31T15:30:00Z"))).toEqual(all12);
    // 2026-12-31T14:30Z = 2026-12-31 23:30 KST → 아직 올해, 11월까지
    expect(monthsToArchive(2026, Date.parse("2026-12-31T14:30:00Z"))).toEqual(all12.slice(0, 11));
  });
});

describe("원본 삭제 가드", () => {
  it("올해는 절대 지우지 않는다", () => {
    expect(canPurgeYear(2027, all12, kst("2027-12-31T23:00:00"))).toBe(false);
  });
  it("다음 해 2월 1일 전엔 지우지 않는다", () => {
    expect(canPurgeYear(2026, all12, kst("2027-01-31T23:59:00"))).toBe(false);
    expect(canPurgeYear(2026, all12, kst("2027-02-01T00:00:00"))).toBe(true);
  });
  it("12달이 다 있어야 지운다", () => {
    expect(canPurgeYear(2026, all12.slice(0, 11), kst("2027-03-01T00:00:00"))).toBe(false);
  });
  it("첫 해 이전은 대상이 아니다", () => {
    expect(canPurgeYear(2025, all12, kst("2027-03-01T00:00:00"))).toBe(false);
  });
  it("삭제가 열린 해는 덮어쓰지 않는다", () => {
    expect(canOverwriteYear(2026, kst("2027-01-15T00:00:00"))).toBe(true);
    expect(canOverwriteYear(2026, kst("2027-02-01T00:00:00"))).toBe(false);
  });
});

describe("다시 계산할 달", () => {
  const early = "2026-11-13T01:00:00Z"; // 연말 전 시험본
  const final = "2026-12-31T15:10:00Z"; // 2027-01-01 00:10 KST 자동 실행본
  it("연말 전 시험본만 1월 자동 실행이 한 번 새로 만든다(멱등)", () => {
    expect(builtBeforeYearEnd(2026, early)).toBe(true);
    expect(builtBeforeYearEnd(2026, final)).toBe(false);
    const existing = [
      { month: 1, builtAt: early },
      { month: 2, builtAt: final }
    ];
    expect(monthsToBuild([1, 2, 3], existing, "refresh-early", 2026)).toEqual([1, 3]);
    expect(monthsToBuild([1, 2, 3], existing, "missing", 2026)).toEqual([3]);
    expect(monthsToBuild([1, 2, 3], existing, "all", 2026)).toEqual([1, 2, 3]);
    // 두 번째 실행: 전부 연말 뒤에 만들어졌으면 할 일 없음.
    const after = [1, 2, 3].map((month) => ({ month, builtAt: final }));
    expect(monthsToBuild([1, 2, 3], after, "refresh-early", 2026)).toEqual([]);
  });
});

describe("아카이브는 숫자만", () => {
  it("세션 로그·오늘 수집 상태·다음 방송을 뺀다", () => {
    const payload = {
      insights: { content: { nextBroadcast: { dateKey: "2026-11-14", titles: ["x"] }, thisMonthContent: 3 } },
      trend: { months: ["2026-10"] },
      visits: { recent: [{ t: 1 }], health: { todaySessions: 5, openRate: 0.5, avgStaySec: 9 }, operators: 2 }
    } as unknown as ArchivePayload;
    const out = sanitizeForArchive(payload) as unknown as {
      insights: { content: { nextBroadcast: unknown; thisMonthContent: number } };
      visits: { recent: unknown[]; health: { todaySessions: number }; operators: number };
    };
    expect(out.insights.content.nextBroadcast).toBeNull();
    expect(out.insights.content.thisMonthContent).toBe(3);
    expect(out.visits.recent).toEqual([]);
    expect(out.visits.health.todaySessions).toBe(0);
    expect(out.visits.operators).toBe(2);
  });
});

describe("시스템 문맥", () => {
  it("runAsInsightsSystem 안에서만 참", async () => {
    expect(isInsightsSystem()).toBe(false);
    await expect(runAsInsightsSystem(async () => isInsightsSystem())).resolves.toBe(true);
    expect(isInsightsSystem()).toBe(false);
  });
});

// 가짜 Supabase — 필요한 체인만.
function fakeDb(rows: { month: number; built_at: string }[]) {
  const upserts: unknown[] = [];
  const rpcs: unknown[] = [];
  const db = {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        gte: () => chain,
        lt: () => chain,
        order: () => chain,
        maybeSingle: async () => ({ data: table === "calendars" ? { id: "cal-1" } : null, error: null }),
        upsert: async (row: unknown) => {
          upserts.push(row);
          return { error: null };
        },
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: table === "insights_year_archive" ? rows : [], error: null, count: 0 })
      };
      return chain;
    },
    rpc: async (name: string, args: unknown) => {
      rpcs.push({ name, args });
      return { data: 0, error: null };
    }
  };
  return { db, upserts, rpcs };
}

describe("buildYearArchive", () => {
  it("시스템 문맥으로 화면과 같은 집계를 불러 그 해 달을 upsert한다", async () => {
    const { db, upserts } = fakeDb([]);
    mocks.admin.mockReturnValue(db);
    const seen: boolean[] = [];
    mocks.insights.mockImplementation(async () => {
      seen.push(isInsightsSystem());
      return { ok: true, data: { content: { nextBroadcast: null } } };
    });
    mocks.trend.mockResolvedValue({ ok: true, data: { months: [] } });
    mocks.visits.mockResolvedValue({ ok: true, data: { recent: [], health: {} } });
    const r = await buildYearArchive({ year: 2026, now: kst("2027-01-01T00:10:00"), deadlineMs: Date.now() + 60_000 });
    expect("error" in r).toBe(false);
    if ("error" in r) return;
    expect(r.built).toEqual(all12);
    expect(r.done).toBe(true);
    expect(upserts).toHaveLength(12);
    expect(seen.every(Boolean)).toBe(true);
  });

  it("집계가 실패한 달은 저장하지 않고 failed로 돌려준다", async () => {
    const { db, upserts } = fakeDb([]);
    mocks.admin.mockReturnValue(db);
    mocks.insights.mockResolvedValue({ ok: false, error: "x" });
    const r = await buildYearArchive({ year: 2026, now: kst("2026-03-05T00:00:00") });
    if ("error" in r) throw new Error(r.error);
    expect(r.failed).toEqual([1, 2]);
    expect(upserts).toHaveLength(0);
    expect(r.done).toBe(false);
  });
});

describe("purgeArchivedYear", () => {
  it("연말 전 시험본만 있는 해는 지우지 않는다", async () => {
    const { db, rpcs } = fakeDb(all12.map((month) => ({ month, built_at: "2026-11-13T01:00:00Z" })));
    mocks.admin.mockReturnValue(db);
    const r = await purgeArchivedYear({ year: 2026, now: kst("2027-03-01T00:00:00") });
    expect(r).toEqual({ skipped: "not-eligible" });
    expect(rpcs).toHaveLength(0);
  });

  it("완비된 지난 해는 표마다 0행이 될 때까지 배치로 지운다", async () => {
    const { db, rpcs } = fakeDb(all12.map((month) => ({ month, built_at: "2026-12-31T15:10:00Z" })));
    mocks.admin.mockReturnValue(db);
    const r = await purgeArchivedYear({ year: 2026, now: kst("2027-02-01T00:07:00"), deadlineMs: Date.now() + 60_000 });
    if ("error" in r || "skipped" in r) throw new Error("expected purge");
    expect(r.done).toBe(true);
    expect((rpcs as { args: { p_table: string; p_from: string; p_to: string } }[]).map((x) => x.args)).toEqual([
      { p_table: "activity_event", p_from: "2026-01-01", p_to: "2027-01-01", p_limit: 5000 },
      { p_table: "visit_session", p_from: "2026-01-01", p_to: "2027-01-01", p_limit: 5000 },
      { p_table: "perf_samples", p_from: "2026-01-01", p_to: "2027-01-01", p_limit: 5000 }
    ]);
  });

  it("올해는 2월이 지나도 지우지 않는다", async () => {
    const { db, rpcs } = fakeDb(all12.map((month) => ({ month, built_at: "2027-12-31T15:10:00Z" })));
    mocks.admin.mockReturnValue(db);
    expect(await purgeArchivedYear({ year: 2027, now: kst("2027-06-01T00:00:00") })).toEqual({ skipped: "not-eligible" });
    expect(rpcs).toHaveLength(0);
  });
});

describe("크론 라우트", () => {
  it("비밀이 없거나 틀리면 일하지 않는다", async () => {
    const { GET } = await import("@/app/api/cron/insights-archive/route");
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request("https://x/api/cron/insights-archive"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect(
      (await GET(new Request("https://x/api/cron/insights-archive", { headers: { authorization: "Bearer nope" } }))).status
    ).toBe(401);
    expect(mocks.admin).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
