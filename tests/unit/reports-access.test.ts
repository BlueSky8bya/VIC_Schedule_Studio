import { beforeEach, describe, expect, it, vi } from "vitest";

// 사이트 제보함 권한·보관: 보기·처리·삭제·답장 모두 개발자만(2026-11-25 소유자 — 관리자에게는 보이지 않는다),
// 아무도 처리하지 않은 제보도 받은 지 180일 뒤 지워진다(2026-11-23 소유자).
const h = vi.hoisted(() => ({
  role: "viewer" as "viewer" | "owner" | "developer",
  rows: [] as { id: string; images: string[]; done_at: string | null; created_at: string; seen_at: string | null }[],
  removed: [] as string[][],
  deleted: [] as string[],
  sent: [] as string[]
}));

vi.mock("@/lib/auth/actor", () => ({ resolveCurrentActor: async () => ({ role: h.role, isAuthenticated: h.role !== "viewer", email: null }) }));
vi.mock("@/lib/reports/gmail", () => ({ sendGmail: async (to: string) => { h.sent.push(to); return { ok: true }; } }));
vi.mock("@/lib/auth/admin", () => ({
  createSupabaseAdminClient: () => ({
    storage: { from: () => ({ remove: async (paths: string[]) => { h.removed.push(paths); return { error: null }; } }) },
    from: () => {
      const filters: ((r: (typeof h.rows)[number]) => boolean)[] = [];
      let mode: "select" | "delete" | "update" = "select";
      const run = () => {
        const hit = h.rows.filter((r) => filters.every((f) => f(r)));
        if (mode === "delete") { for (const r of hit) h.deleted.push(r.id); h.rows = h.rows.filter((r) => !hit.includes(r)); return { data: null, error: null, count: null }; }
        return { data: hit, error: null, count: hit.length };
      };
      const q: Record<string, unknown> = {};
      q.select = () => q;
      q.delete = () => { mode = "delete"; return q; };
      q.update = () => { mode = "update"; return q; };
      q.limit = () => q;
      q.order = () => q;
      q.lt = (col: "done_at" | "created_at", v: string) => { filters.push((r) => r[col] !== null && (r[col] as string) < v); return q; };
      q.gte = (col: "created_at", v: string) => { filters.push((r) => r[col] >= v); return q; };
      q.is = (col: "done_at" | "seen_at") => { filters.push((r) => r[col] === null); return q; };
      q.eq = (col: "id", v: string) => { filters.push((r) => r[col] === v); return q; };
      q.maybeSingle = async () => ({ data: { reply_email: "viewer@example.com", images: [] }, error: null });
      q.then = (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve);
      return q;
    }
  })
}));

const DAY = 86400_000;
const NOW = Date.parse("2027-06-01T00:00:00Z");
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();

beforeEach(() => {
  h.role = "viewer"; h.rows = []; h.removed = []; h.deleted = []; h.sent = [];
  vi.stubEnv("VISUAL_TEST_FIXTURE", "");
});

describe("report inbox access", () => {
  it("keeps the whole inbox developer-only — the owner can neither count, handle nor reply", async () => {
    const actions = await import("@/lib/reports/actions");
    h.rows = [
      { id: "old", images: [], done_at: null, created_at: "2026-11-20T03:00:00.000Z", seen_at: null },
      { id: "new", images: [], done_at: null, created_at: "2026-11-23T03:00:00.000Z", seen_at: null }
    ];
    for (const role of ["viewer", "owner"] as const) {
      h.role = role;
      expect(await actions.getUnseenReportCountAction()).toBeNull();
      expect((await actions.setReportDoneAction("old", true)).ok).toBe(false);
      expect((await actions.setReportRepliedAction("old", true)).ok).toBe(false);
      expect((await actions.deleteReportAction("old")).ok).toBe(false);
      expect(await actions.sendReplyAction("old", "제목", "본문")).toEqual({ ok: false, reason: "denied" });
    }
    expect(h.sent).toEqual([]);
    expect(h.deleted).toEqual([]);
    h.role = "developer";
    expect(await actions.getUnseenReportCountAction()).toBe(2);
    expect(await actions.sendReplyAction("old", "제목", "본문")).toEqual({ ok: true });
    expect(h.sent).toEqual(["viewer@example.com"]);
  });
});

describe("report retention", () => {
  it("purges done reports after 90 days and unhandled ones after 180 days, files first", async () => {
    const { purgeExpiredReports } = await import("@/lib/reports/report");
    h.rows = [
      { id: "done-old", images: ["a.webp"], done_at: iso(91), created_at: iso(120), seen_at: null },
      { id: "done-fresh", images: [], done_at: iso(10), created_at: iso(300), seen_at: null },
      { id: "open-old", images: ["b.webp", "c.webp"], done_at: null, created_at: iso(181), seen_at: null },
      { id: "open-fresh", images: [], done_at: null, created_at: iso(179), seen_at: null }
    ];
    expect(await purgeExpiredReports(NOW)).toEqual({ deleted: 2 });
    expect(h.deleted.sort()).toEqual(["done-old", "open-old"]);
    expect(h.removed).toEqual([["a.webp"], ["b.webp", "c.webp"]]);
    expect(h.rows.map((r) => r.id).sort()).toEqual(["done-fresh", "open-fresh"]);
  });
});
