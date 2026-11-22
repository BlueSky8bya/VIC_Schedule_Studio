import { beforeEach, describe, expect, it, vi } from "vitest";

// 사이트 제보함 권한·보관(2026-11-23 소유자): 관리자도 보고 처리할 수 있지만 답장 발송은 개발자만,
// 관리자는 새 안내 이후 제보만 세고, 아무도 처리하지 않은 제보도 받은 지 180일 뒤 지워진다.
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
  it("lets the owner handle reports but keeps reply sending developer-only", async () => {
    const actions = await import("@/lib/reports/actions");
    h.role = "viewer";
    expect(await actions.getUnseenReportCountAction()).toBeNull();
    expect((await actions.deleteReportAction("a")).ok).toBe(false);
    h.role = "owner";
    expect(await actions.getUnseenReportCountAction()).toBe(0);
    expect((await actions.setReportDoneAction("a", true)).ok).toBe(true);
    expect(await actions.sendReplyAction("a", "제목", "본문")).toEqual({ ok: false, reason: "denied" });
    expect(h.sent).toEqual([]);
    h.role = "developer";
    expect(await actions.sendReplyAction("a", "제목", "본문")).toEqual({ ok: true });
    expect(h.sent).toEqual(["viewer@example.com"]);
  });

  it("counts only reports sent under the new notice for the owner", async () => {
    const actions = await import("@/lib/reports/actions");
    h.rows = [
      { id: "old", images: [], done_at: null, created_at: "2026-11-20T03:00:00.000Z", seen_at: null },
      { id: "new", images: [], done_at: null, created_at: "2026-11-23T03:00:00.000Z", seen_at: null }
    ];
    h.role = "owner";
    expect(await actions.getUnseenReportCountAction()).toBe(1);
    h.role = "developer";
    expect(await actions.getUnseenReportCountAction()).toBe(2);
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
