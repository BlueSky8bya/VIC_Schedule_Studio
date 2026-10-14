import { expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const cache = vi.hoisted(() => ({ stale: false, snapshot: null as unknown, pending: [] as Promise<unknown>[] }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...args: unknown[]) => Promise<unknown>) => (...args: unknown[]) => {
  if (cache.stale) { cache.pending.push(fn(...args)); return Promise.resolve(cache.snapshot); }
  return fn(...args);
} }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/auth/config", () => ({ isSupabaseConfigured: () => true }));
const { loadPublicTeaserState } = await import("@/lib/schedules/public-loader");
const row = {
  id: "00000000-0000-4000-8000-000000000001", date_key: "2026-06-18", end_date_key: null,
  start_time: "20:30:00", end_time: null, is_all_day: false, is_tentative: true, is_support: false,
  support_kind: null, support_url: "https://synthetic-sensitive.invalid", link_next: null,
  public_title: "HIDDEN_CANARY", public_description: "BODY_CANARY", status: "scheduled", sort_order: 0,
  category: "collab", event_tags: [{ tag_id: "SECRET_TAG", is_primary: true, sort_order: 0 }],
  teaser: true, teaser_reveal_at: "2026-10-14T12:00:00+09:00", hidden: true,
  owner_email: "synthetic-owner@example.invalid", private_memo: "OWNER_PRIVATE_CANARY"
};
it("honors DB masking even when the application is past T; extra DB fields never cross", async () => {
  rpc.mockResolvedValueOnce({ data: { sampledAtDbMs: Date.parse("2026-10-14T13:00:00+09:00"), rows: [row] }, error: null });
  const result = await loadPublicTeaserState("vic", row.id);
  expect(result.ok).toBe(true);
  expect(result.entries[0].state).toBe("masked");
  expect(result.entries[0].event.teaser).toBe(true);
  const json = JSON.stringify(result);
  for (const secret of ["HIDDEN_CANARY", "BODY_CANARY", "SECRET_TAG", "20:30", "synthetic-owner", "OWNER_PRIVATE_CANARY", "synthetic-sensitive"]) expect(json).not.toContain(secret);
});
it("fails closed on unavailable RPC/configuration and does not claim deletion", async () => {
  rpc.mockClear();
  rpc.mockResolvedValueOnce({ data: null, error: { message: "RPC missing" } });
  expect((await loadPublicTeaserState("vic", "00000000-0000-4000-8000-000000000002")).ok).toBe(false);
  expect((await loadPublicTeaserState("vic", "00000000-0000-4000-8000-000000000002")).ok).toBe(false);
  expect(rpc).toHaveBeenCalledTimes(1);
});
it("rejects invalid calendar/id keys before querying the DB", async () => {
  rpc.mockClear();
  expect((await loadPublicTeaserState("other-calendar")).ok).toBe(false);
  expect((await loadPublicTeaserState("vic", "unbounded-query")).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});

it("coalesces origin reads when Data Cache returns stale values before its background refresh finishes", async () => {
  const id = "00000000-0000-4000-8000-000000000004";
  rpc.mockResolvedValue({ data: { sampledAtDbMs: Date.now(), rows: [] }, error: null });
  cache.snapshot = await loadPublicTeaserState("vic", id);
  rpc.mockClear();
  cache.stale = true;
  const time = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1500);
  try {
    // Sequential cached responses do not overlap in the outer single-flight;
    // all background callbacks still share the real DB request/window.
    for (let i = 0; i < 100; i++) await loadPublicTeaserState("vic", id);
    await Promise.all(cache.pending);
    expect(rpc).toHaveBeenCalledTimes(1);
  } finally { time.mockRestore(); cache.stale = false; cache.pending = []; }
});
