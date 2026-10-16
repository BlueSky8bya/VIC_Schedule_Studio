import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CurrentActor } from "@/lib/auth/actor";

const mocks = vi.hoisted(() => ({ actor: vi.fn(), admin: vi.fn(), owners: vi.fn() }));
vi.mock("@/lib/auth/actor", () => ({ resolveCurrentActor: mocks.actor }));
vi.mock("@/lib/auth/admin", () => ({ createSupabaseAdminClient: mocks.admin }));
vi.mock("@/lib/auth/config", () => ({ getOwnerEmails: mocks.owners }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "user-agent": "Synthetic desktop" }) }));
vi.mock("next/server", () => ({ after: () => { throw new Error("No request lifecycle in this unit test"); } }));

import { recordActivityBatch } from "@/lib/activity/record";
import { getActivityDayAction, getActivityUsageAction } from "@/lib/activity/query";
import { accountHashOf } from "@/lib/insights/account-hash";

// These tests execute the real writer/query functions with synthetic actors and
// an in-memory Supabase boundary. They never prove production login or DB RLS.
const DAY = "2026-06-11";
const VISIT = "12345678-1234-4234-8234-123456789abc";
const CANARY = "synthetic-sensitive-canary@example.test";
const ACTIONS = [
  "companion-home-open", "companion-home-close", "companion-home-fold#close", "companion-home-call",
  "companion-food-spawn", "companion-food-move", "companion-food-discard", "companion-food-clear",
  "companion-pet", "companion-drag", "companion-bonk", "companion-rest", "companion-find",
  "companion-extract", "companion-heart-clear"
] as const;
const SETTINGS = [
  "settings-tab#companion", "settings-companion-tab#affection", "companion-enabled#on",
  "companion-roam#off", "companion-jump#on", "companion-sleep#off", "companion-heart-prank#on",
  "companion-card-prank#on", "companion-hide#off", "companion-panel-prank#on",
  "companion-drag-enabled#on", "companion-petting-enabled#on", "companion-feeding-enabled#on",
  "companion-speed#lively", "companion-animal#cat", "companion-personality#affectionate",
  "companion-learning-enabled#off", "companion-learning-reset"
] as const;
const ADJACENT_ACTIONS = [
  "companion-card-restore", "tag-filter-fold#open", "tag-filter-fold#close",
  "season-panel-fold#open", "season-panel-fold#close", "premiere-resume", "premiere-other-month",
  "premiere-exit#calendar", "premiere-exit#dismiss", "premiere-read", "premiere-cheer",
  "premiere-rehearsal", "dt-hope"
] as const;
type DataRow = Record<string, unknown>;
type Read = { table: string; columns: string; filters: { method: string; args: unknown[] }[] };

function database(data: Record<string, DataRow[]> = {}) {
  const reads: Read[] = [];
  const writes: { table: string; rows: DataRow[] }[] = [];
  const rpc = vi.fn<(name: string, args: unknown) => Promise<{ data: null; error: null }>>()
    .mockResolvedValue({ data: null, error: null });
  const from = vi.fn((table: string) => ({
    insert: async (rows: DataRow[]) => { writes.push({ table, rows }); return { data: null, error: null }; },
    select: (columns: string) => {
      const read: Read = { table, columns, filters: [] }; reads.push(read);
      const chain: Record<string, unknown> = {};
      for (const method of ["eq", "gte", "lte", "in", "not", "order"]) {
        chain[method] = (...args: unknown[]) => { read.filters.push({ method, args }); return chain; };
      }
      chain.range = async (start: number, end: number) => ({ data: (data[table] ?? []).slice(start, end + 1), error: null });
      return chain;
    }
  }));
  return { from, rpc, reads, writes };
}

function actor(role: CurrentActor["role"], authenticated = true): CurrentActor {
  return { role, isAuthenticated: authenticated, email: authenticated ? "synthetic-actor@example.test" : null };
}
const click = (target: string) => ({ kind: "ui.click" as const, target, visitKey: VISIT });
let db: ReturnType<typeof database>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  // UTC is still June 10: the stored/query day must use the KST June 11 boundary.
  vi.setSystemTime(new Date("2026-06-10T15:00:01.000Z"));
  vi.stubEnv("VISIT_HASH_SALT", "synthetic-unit-salt-companion-078");
  vi.stubEnv("VISUAL_TEST_FIXTURE", "");
  vi.stubEnv("PRIVACY_RETENTION_CLEANUP_ENABLED", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unit test must not make a network request"); }));
  db = database();
  mocks.actor.mockResolvedValue(actor("developer"));
  mocks.admin.mockReturnValue(db);
  mocks.owners.mockReturnValue([]);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("companion activity writer boundary", () => {
  it("preserves all fixed gestures and current settings through the real batch writer", async () => {
    const targets = [...ACTIONS, ...SETTINGS, ...ADJACENT_ACTIONS];
    expect(await recordActivityBatch(targets.map(click), { device: "desktop" })).toBe(targets.length);
    expect(mocks.actor).toHaveBeenCalledOnce();
    expect(mocks.actor).toHaveBeenCalledWith("vic");
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0].table).toBe("activity_event");
    expect(db.writes[0].rows.map(row => row.target)).toEqual(targets);
    for (const row of db.writes[0].rows) {
      expect(row).toEqual({ day: DAY, visit_key: VISIT, account_hash: accountHashOf("synthetic-actor@example.test"),
        role: "developer", device: "desktop", source: "client", kind: "ui.click", target: row.target,
        meta: null, dur_ms: null, diag: false });
    }
    expect(db.rpc).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["owner", "developer"] as const)("stores %s gestures as internal timeline rows", async role => {
    mocks.actor.mockResolvedValue(actor(role));
    expect(await recordActivityBatch([click("companion-pet"), click("companion-bonk"), click("companion-drag")])).toBe(3);
    expect(db.writes[0].rows).toHaveLength(3);
    expect(db.writes[0].rows.every(row => row.role === role && row.account_hash === accountHashOf("synthetic-actor@example.test"))).toBe(true);
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it.each(["viewer", "anon", "unknown"] as const)("folds %s gestures into identity-free daily counts", async role => {
    mocks.actor.mockResolvedValue(role === "anon" ? actor("viewer", false) : { ...actor("viewer"), roleUncertain: role === "unknown" });
    expect(await recordActivityBatch([click("companion-pet"), click("companion-pet"), click("companion-drag")])).toBe(3);
    expect(db.writes).toEqual([]);
    expect(db.rpc).toHaveBeenCalledOnce();
    expect(db.rpc).toHaveBeenCalledWith("bump_activity_counts", { p_rows: [
      { day: DAY, role, kind: "ui.click", target: "companion-pet", n: 2 },
      { day: DAY, role, kind: "ui.click", target: "companion-drag", n: 1 }
    ] });
    expect(JSON.stringify(db.rpc.mock.calls)).not.toContain("synthetic-actor");
    expect(JSON.stringify(db.rpc.mock.calls)).not.toContain(VISIT);
    expect(JSON.stringify(db.rpc.mock.calls)).not.toContain("account_hash");
  });

  it("drops client-forged server kinds while sanitizing sensitive payloads before persistence", async () => {
    const valid = { ...click(`companion-pet#${CANARY}`), visitKey: CANARY,
      meta: { title: CANARY, body: CANARY, nickname: CANARY, x: 127, y: 42, foodId: CANARY, on: true }, durMs: 42.4 };
    const forged = { ...click("companion-drag"), kind: "event.update" as never };
    expect(await recordActivityBatch([valid, forged], { device: CANARY })).toBe(1);
    expect(db.writes[0].rows).toEqual([{ day: DAY, visit_key: null,
      account_hash: accountHashOf("synthetic-actor@example.test"), role: "developer", device: "desktop",
      source: "client", kind: "ui.click", target: "companion-pet", meta: { on: true }, dur_ms: 42, diag: false }]);
    expect(JSON.stringify(db.writes)).not.toContain(CANARY);
  });

  it("does not fall through to real storage if admin configuration is unavailable", async () => {
    mocks.admin.mockReturnValue(null);
    await recordActivityBatch([click("companion-pet")]);
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("companion activity query boundary", () => {
  it.each(["viewer", "anon", "owner"] as const)("rejects %s from both developer-only reads before creating a DB client", async role => {
    mocks.actor.mockResolvedValue(actor(role === "anon" ? "viewer" : role, role !== "anon"));
    expect(await getActivityDayAction(DAY)).toEqual({ ok: false, error: "개발자만 볼 수 있는 화면입니다." });
    expect(await getActivityUsageAction(30, DAY)).toEqual({ ok: false, error: "개발자만 볼 수 있는 화면입니다." });
    expect(mocks.admin).not.toHaveBeenCalled();
  });

  it("merges observed internal/viewer/anonymous uses without inventing unobserved zero-use features", async () => {
    db = database({
      activity_event: [
        { kind: "ui.click", target: "companion-pet", role: "developer" },
        { kind: "ui.click", target: "companion-pet", role: "owner" },
        { kind: "ui.click", target: "companion-bonk", role: "developer" },
        { kind: "ui.click", target: null, role: "developer" }
      ],
      activity_daily_count: [
        { kind: "ui.click", target: "companion-pet", role: "viewer", count: 3 },
        { kind: "ui.click", target: "companion-pet", role: "anon", count: 4 },
        { kind: "ui.click", target: "companion-drag", role: "anon", count: 2 }
      ]
    });
    mocks.admin.mockReturnValue(db);
    const result = await getActivityUsageAction(7);
    expect(result).toEqual({ ok: true, days: 7, since: "2026-06-05", until: DAY, rows: [
      { kind: "ui.click", label: "누름", target: "companion-bonk", roles: { developer: 1 }, total: 1, auto: false },
      { kind: "ui.click", label: "누름", target: "companion-drag", roles: { anon: 2 }, total: 2, auto: false },
      { kind: "ui.click", label: "누름", target: "companion-pet", roles: { developer: 1, owner: 1, viewer: 3, anon: 4 }, total: 9, auto: false }
    ] });
    expect(db.reads).toHaveLength(2);
    for (const read of db.reads) {
      expect(read.filters).toEqual(expect.arrayContaining([
        { method: "gte", args: ["day", "2026-06-05"] }, { method: "lte", args: ["day", DAY] },
        { method: "in", args: ["kind", ["ui.click", "section.enter", "route.enter"]] }
      ]));
    }
    expect(db.reads[0].filters).toContainEqual({ method: "eq", args: ["diag", false] });
    expect(db.writes).toEqual([]); expect(db.rpc).not.toHaveBeenCalled();
  });

  it("honors an explicit past-day anchor instead of using today's date", async () => {
    expect(await getActivityUsageAction(7, "2026-05-31")).toEqual({ ok: true, rows: [], days: 7, since: "2026-05-25", until: "2026-05-31" });
    for (const read of db.reads) expect(read.filters).toContainEqual({ method: "lte", args: ["day", "2026-05-31"] });
  });

  it("returns pet/bonk/move timeline items in order with their fixed IDs and no schedule-title join", async () => {
    const targets = ["companion-pet", "companion-bonk", "companion-drag"];
    db = database({ activity_event: targets.map((target, index) => ({
      occurred_at: `2026-06-10T15:00:0${index}.000Z`, visit_key: VISIT,
      account_hash: "synthetic-opaque-hash", role: "developer", device: "desktop", source: "client",
      kind: "ui.click", target, meta: null, dur_ms: null
    })) });
    mocks.admin.mockReturnValue(db);
    const result = await getActivityDayAction(DAY);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    expect(result.total).toBe(3); expect(result.visits).toHaveLength(1);
    expect(result.visits[0]).toMatchObject({ key: VISIT, role: "developer", account: "계정 #1", device: "desktop" });
    expect(result.visits[0].items.map(item => ({ kind: item.kind, label: item.label, target: item.target, source: item.source, targetLabel: item.targetLabel }))).toEqual(
      targets.map(target => ({ kind: "ui.click", label: "누름", target, source: "client", targetLabel: null }))
    );
    expect(db.reads.map(read => read.table)).toEqual(["activity_event", "visit_session"]);
    expect(db.reads[0].filters).toContainEqual({ method: "eq", args: ["day", DAY] });
    expect(db.reads[0].filters).toContainEqual({ method: "eq", args: ["diag", false] });
    expect(db.writes).toEqual([]); expect(db.rpc).not.toHaveBeenCalled();
  });
});
