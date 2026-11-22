import { beforeEach, describe, expect, it, vi } from "vitest";

// 고장 알림(0173, 2026-11-23): 평소엔 조용하고, 고장 났을 때만 개발자에게 메일 한 통, 같은 고장은 일주일에 한 번.
const h = vi.hoisted(() => ({
  snapshot: {} as Record<string, unknown> | null,
  state: [] as { kind: string; last_sent_at: string }[],
  admins: [{ email: "dev@example.com" }] as { email: string | null }[],
  upserts: [] as { kind: string; last_sent_at: string }[][],
  mails: [] as { to: string; subject: string; body: string }[],
  configured: true,
  sendOk: true
}));
vi.mock("@/lib/reports/gmail", () => ({
  gmailConfigured: () => h.configured,
  sendGmail: async (to: string, subject: string, body: string) => { h.mails.push({ to, subject, body }); return h.sendOk ? { ok: true } : { ok: false, reason: "send" }; }
}));
vi.mock("@/lib/auth/admin", () => ({
  createSupabaseAdminClient: () => ({
    rpc: async () => (h.snapshot ? { data: h.snapshot, error: null } : { data: null, error: { message: "boom" } }),
    from: (table: string) => ({
      select: async () => ({ data: table === "platform_admins" ? h.admins : h.state, error: null }),
      upsert: async (rows: { kind: string; last_sent_at: string }[]) => { h.upserts.push(rows); return { error: null }; }
    })
  })
}));
import { ALERT_REPEAT_MS, evaluateHealth, runHealthCheck } from "@/lib/health/check";

const NOW = Date.parse("2028-03-10T03:00:00Z");
const hoursAgo = (n: number, from = NOW) => new Date(from - n * 3600_000).toISOString();
const healthy = (at = NOW) => ({
  db_bytes: 180 * 1024 * 1024,
  last_live_at: hoursAgo(30, at),
  last_vod_sync_at: hoursAgo(0.3, at),
  last_session_started_at: hoursAgo(40, at),
  search_graph_at: hoursAgo(9, at),
  cron_failed: {},
  http_total: 72,
  http_bad: 0
});
const kinds = (s: Record<string, unknown>) => evaluateHealth(s, NOW).map((a) => a.kind);

beforeEach(() => {
  h.snapshot = healthy(); h.state = []; h.admins = [{ email: "dev@example.com" }]; h.upserts = []; h.mails = []; h.configured = true; h.sendOk = true;
});

describe("evaluateHealth", () => {
  it("is silent when everything moves", () => expect(kinds(healthy())).toEqual([]));

  it("does not mistake a multi-day live broadcast for a stopped poll", () => {
    // 며칠짜리 방송 중에는 다시보기 수집이 쉬지만 '방송 중' 시각이 매분 찍힌다(실측: 노뱅종 3일차).
    expect(kinds({ ...healthy(), last_vod_sync_at: hoursAgo(60), last_live_at: hoursAgo(0.02) })).toEqual([]);
  });

  it("flags a stopped poll once neither clock moved for a day", () => {
    expect(kinds({ ...healthy(), last_vod_sync_at: hoursAgo(25), last_live_at: hoursAgo(30) })).toEqual(["poll-stopped"]);
    expect(kinds({ ...healthy(), last_vod_sync_at: hoursAgo(23), last_live_at: hoursAgo(30) })).toEqual([]);
  });

  it("flags three weeks without a broadcast only while the poll itself is alive", () => {
    const quiet = { ...healthy(), last_live_at: hoursAgo(22 * 24), last_session_started_at: hoursAgo(22 * 24 + 5) };
    expect(kinds(quiet)).toEqual(["no-broadcast"]);
    expect(kinds({ ...quiet, last_vod_sync_at: hoursAgo(30) })).toEqual(["poll-stopped"]);
  });

  it("flags failing DB jobs, failing DB→site calls, a stale search graph and a nearly full DB", () => {
    expect(kinds({ ...healthy(), cron_failed: { "vic-search-graph": 2 } })).toEqual([]);
    expect(kinds({ ...healthy(), cron_failed: { "vic-search-graph": 2, "vic-perf-retention": 1 } })).toEqual(["db-jobs-failing"]);
    expect(kinds({ ...healthy(), http_total: 72, http_bad: 60 })).toEqual(["db-calls-failing"]);
    expect(kinds({ ...healthy(), http_total: 10, http_bad: 10 })).toEqual([]);
    expect(kinds({ ...healthy(), search_graph_at: hoursAgo(73) })).toEqual(["search-graph-stale"]);
    expect(kinds({ ...healthy(), db_bytes: 399 * 1024 * 1024 })).toEqual([]);
    expect(kinds({ ...healthy(), db_bytes: 400 * 1024 * 1024 })).toEqual(["db-nearly-full"]);
  });

  it("stays silent on an empty snapshot rather than inventing alerts", () => expect(kinds({})).toEqual([]));
});

describe("runHealthCheck", () => {
  it("sends nothing when healthy", async () => {
    expect(await runHealthCheck({ now: NOW })).toMatchObject({ ok: true, mail: "nothing-due", alerts: [] });
    expect(h.mails).toEqual([]);
  });

  it("mails the developer once, remembers it, and stays quiet for a week", async () => {
    h.snapshot = { ...healthy(), db_bytes: 420 * 1024 * 1024 };
    expect(await runHealthCheck({ now: NOW })).toMatchObject({ ok: true, mail: "sent", sent: ["db-nearly-full"] });
    expect(h.mails).toHaveLength(1);
    expect(h.mails[0].to).toBe("dev@example.com");
    expect(h.mails[0].subject).toContain("DB가 거의 찼어요");
    expect(h.upserts[0].map((r) => r.kind)).toEqual(["db-nearly-full"]);

    h.state = [{ kind: "db-nearly-full", last_sent_at: new Date(NOW).toISOString() }];
    h.snapshot = { ...healthy(NOW + 6 * 86400_000), db_bytes: 420 * 1024 * 1024 };
    expect(await runHealthCheck({ now: NOW + 6 * 86400_000 })).toMatchObject({ mail: "nothing-due", alerts: ["db-nearly-full"] });
    expect(h.mails).toHaveLength(1);
    h.snapshot = { ...healthy(NOW + ALERT_REPEAT_MS), db_bytes: 420 * 1024 * 1024 };
    expect(await runHealthCheck({ now: NOW + ALERT_REPEAT_MS })).toMatchObject({ mail: "sent", sent: ["db-nearly-full"] });
    expect(h.mails).toHaveLength(2);
  });

  it("does not remember an alert whose mail failed, so the next run retries", async () => {
    h.snapshot = { ...healthy(), search_graph_at: hoursAgo(100) };
    h.sendOk = false;
    expect(await runHealthCheck({ now: NOW })).toMatchObject({ ok: false, mail: "failed", sent: [] });
    expect(h.upserts).toEqual([]);
  });

  it("reports missing mail setup or recipient without throwing", async () => {
    h.snapshot = { ...healthy(), db_bytes: 420 * 1024 * 1024 };
    h.configured = false;
    expect(await runHealthCheck({ now: NOW })).toMatchObject({ ok: true, mail: "not-configured" });
    h.configured = true; h.admins = [{ email: "not-an-address" }, { email: null }];
    expect(await runHealthCheck({ now: NOW })).toMatchObject({ ok: true, mail: "no-recipient" });
    expect(h.mails).toEqual([]);
  });

  it("sends a test mail on request without recording alert state", async () => {
    expect(await runHealthCheck({ now: NOW, test: true })).toMatchObject({ ok: true, mail: "sent", sent: ["test"] });
    expect(h.mails[0].subject).toContain("시험 메일");
    expect(h.upserts).toEqual([]);
  });

  it("fails closed when the snapshot cannot be read", async () => {
    h.snapshot = null;
    expect(await runHealthCheck({ now: NOW })).toMatchObject({ ok: false, mail: "failed" });
    expect(h.mails).toEqual([]);
  });
});
