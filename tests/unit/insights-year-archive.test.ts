import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  insights: vi.fn(),
  trend: vi.fn(),
  actor: vi.fn()
}));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/lib/auth/actor", () => ({ resolveCurrentActor: mocks.actor }));
vi.mock("@/lib/insights/actions", () => ({
  getInsightsAction: mocks.insights,
  getTrendAction: mocks.trend
}));

import {
  buildYearArchive,
  builtBeforeYearEnd,
  canOverwriteYear,
  canPurgeYear,
  isYearClosed,
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
  it("끝난 해만 통째로 12달 — 올해·미래·첫 해(2024) 이전은 없다", () => {
    const now = kst("2026-11-13T10:00:00");
    expect(monthsToArchive(2026, now)).toEqual([]);
    expect(monthsToArchive(2027, now)).toEqual([]);
    expect(monthsToArchive(2025, now)).toEqual(all12);
    expect(monthsToArchive(2024, now)).toEqual(all12);
    expect(monthsToArchive(2023, now)).toEqual([]);
    expect(monthsToArchive(2026, kst("2027-01-01T00:05:00"))).toEqual(all12);
    expect(isYearClosed(2026, now)).toBe(false);
    expect(isYearClosed(2025, now)).toBe(true);
  });

  it("KST 자정 경계: UTC로는 12/31이어도 KST 1/1이면 지난해 전체", () => {
    // 2026-12-31T15:30Z = 2027-01-01 00:30 KST
    expect(monthsToArchive(2026, Date.parse("2026-12-31T15:30:00Z"))).toEqual(all12);
    // 2026-12-31T14:30Z = 2026-12-31 23:30 KST → 아직 끝나지 않은 해
    expect(monthsToArchive(2026, Date.parse("2026-12-31T14:30:00Z"))).toEqual([]);
  });
});

describe("원본 삭제 가드", () => {
  const rows = (builtAt: string, months = all12) => months.map((month) => ({ month, builtAt }));
  const autoBuilt = "2026-12-31T15:10:00Z"; // 2027-01-01 00:10 KST 자동 실행본
  it("올해는 절대 지우지 않는다", () => {
    expect(canPurgeYear(2027, rows("2027-01-02T00:00:00Z"), kst("2027-12-31T23:00:00"))).toBe(false);
  });
  it("다음 해 2월 1일 전엔 지우지 않는다", () => {
    expect(canPurgeYear(2026, rows(autoBuilt), kst("2027-01-31T23:59:00"))).toBe(false);
    expect(canPurgeYear(2026, rows(autoBuilt), kst("2027-02-01T00:00:00"))).toBe(true);
  });
  it("12달이 다 있어야 지운다", () => {
    expect(canPurgeYear(2026, rows(autoBuilt, all12.slice(0, 11)), kst("2027-03-01T00:00:00"))).toBe(false);
  });
  it("첫 해(2024) 이전은 대상이 아니다", () => {
    expect(canPurgeYear(2023, rows("2024-01-02T00:00:00Z"), kst("2027-03-01T00:00:00"))).toBe(false);
  });
  it("손으로 막 만든 지난 해는 30일이 지나야 지운다", () => {
    // 2026-11-13에 2025를 만들면 이미 2026-02-01이 지났지만, 보관본이 30일 묵어야 한다.
    const manual = "2026-11-13T01:00:00Z";
    expect(canPurgeYear(2025, rows(manual), kst("2026-11-13T12:00:00"))).toBe(false);
    expect(canPurgeYear(2025, rows(manual), kst("2026-12-12T09:00:00"))).toBe(false);
    expect(canPurgeYear(2025, rows(manual), kst("2026-12-13T11:00:00"))).toBe(true);
    // 한 달이라도 30일 안쪽이면 그 해 전체를 미룬다.
    const mixed = [...rows(manual, all12.slice(0, 11)), { month: 12, builtAt: "2026-12-10T00:00:00Z" }];
    expect(canPurgeYear(2025, mixed, kst("2026-12-20T00:00:00"))).toBe(false);
  });
  it("삭제가 시작될 수 있는 해는 덮어쓰지 않는다", () => {
    expect(canOverwriteYear(2026, rows(autoBuilt), kst("2027-01-15T00:00:00"))).toBe(true);
    expect(canOverwriteYear(2026, rows("2027-01-20T00:00:00Z"), kst("2027-02-05T00:00:00"))).toBe(true); // 만든 지 30일 안
    expect(canOverwriteYear(2026, rows(autoBuilt), kst("2027-02-05T00:00:00"))).toBe(false);
    // 2월 1일이 지난 뒤 손으로 만든 지난 해: 30일 동안은 다시 만들 수 있다.
    expect(canOverwriteYear(2025, rows("2026-11-13T01:00:00Z"), kst("2026-11-20T00:00:00"))).toBe(true);
    expect(canOverwriteYear(2025, [], kst("2026-11-20T00:00:00"))).toBe(false);
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
  it("다음 방송을 빼고, 방문 집계(2026-11-13 철수)는 담지 않는다", () => {
    const payload = {
      insights: { content: { nextBroadcast: { dateKey: "2026-11-14", titles: ["x"] }, thisMonthContent: 3 } },
      trend: { months: ["2026-10"] },
      visits: { recent: [{ t: 1 }], operators: 2 }
    } as unknown as ArchivePayload;
    const out = sanitizeForArchive(payload) as unknown as {
      insights: { content: { nextBroadcast: unknown; thisMonthContent: number } };
      trend: { months: string[] };
    };
    expect(out.insights.content.nextBroadcast).toBeNull();
    expect(out.insights.content.thisMonthContent).toBe(3);
    expect(out.trend.months).toEqual(["2026-10"]);
    expect(Object.keys(out).sort()).toEqual(["insights", "trend"]);
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
    const r = await buildYearArchive({ year: 2025, now: kst("2026-03-05T00:00:00"), deadlineMs: Date.now() + 60_000 });
    if ("error" in r) throw new Error(r.error);
    expect(r.failed).toEqual(all12);
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
