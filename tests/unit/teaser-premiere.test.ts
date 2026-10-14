import { describe, expect, it, vi, afterEach } from "vitest";
import { buildPremiereFixture, PREMIERE_CANARY } from "@/lib/schedules/premiere-fixture";
import { singleFlightCache } from "@/lib/schedules/teaser-state-cache";
import { planPremiere, premiereKey, PREMIERE_TIMING } from "@/lib/ui/premiere/plan";
import { createFlashBudget } from "@/lib/ui/premiere/flash-budget";
import { reconcileTeaserReveal } from "@/lib/schedules/teaser-reconcile";

const start = Date.parse("2026-10-14T12:00:00+09:00");
const month = "2026-06";
const entries = (offsets: number[], now = start) => buildPremiereFixture(start, offsets, now).entries;
afterEach(() => vi.useRealTimers());

describe("premiere timeline and multiple releases", () => {
  it.each([[181,"idle"],[180,"prelude"],[149,"filters"],[119,"chrome"],[89,"curtain"],[75,"quake"],[68,"screen"],[60,"build"],[11.8,"eye"],[1,"eye"],[0,"waiting"]])("%ss remaining -> %s", (seconds, phase) => {
    const target = start + Number(seconds) * 1000;
    const snapshot = entries([Number(seconds)], start - 1);
    expect(planPremiere(snapshot, start, month).phase).toBe(phase);
    if (phase !== "idle") expect(planPremiere(snapshot, start, month).target).toBe(target);
  });
  it("keeps distinct countdowns for 1 and 1.5-second gaps; chains only within 15s", () => {
    const plan = planPremiere(entries([10,11,12.5,27.5,43.5]), start, month);
    expect(plan.items).toHaveLength(4);
    expect(new Set(plan.items.map(item => item.revealAt)).size).toBe(4);
  });
  it("supports exact simultaneous cohorts of six without changing their targets", () => {
    const plan = planPremiere(entries([10,10,10,10,10,10]), start, month);
    expect(plan.items).toHaveLength(6);
    expect(new Set(plan.items.map(item => item.revealAt)).size).toBe(1);
  });
  it("never moves to another viewed month and honors explicit dismissal", () => {
    const list = entries([30]);
    expect(planPremiere(list, start, "2026-10").phase).toBe("idle");
    expect(planPremiere(list, start, month, new Set([premiereKey(list[0])])).phase).toBe("idle");
  });
  it("recomputes earlier/later schedules without replaying intermediate phases", () => {
    expect(planPremiere(entries([3600]), start, month).phase).toBe("idle");
    expect(planPremiere(entries([8]), start, month).phase).toBe("eye");
    expect(planPremiere(entries([150]), start, month).phase).toBe("filters");
  });
  it("late released arrivals stay quiet; live confirmations have bounded reading time", () => {
    const released = entries([0], start + 1000);
    expect(planPremiere(released, start + 1000, month).phase).toBe("idle");
    const live = released.map(item => ({ ...item, confirmedAt: start + 1000 }));
    expect(planPremiere(live, start + 1500, month).phase).toBe("reveal");
    expect(planPremiere(live, start + 8000, month).phase).toBe("idle");
  });
  it("data delay gives up focus after five seconds without authorizing content", () => {
    const list = buildPremiereFixture(start, [0], start + 5500, "delay").entries;
    expect(list[0].state).toBe("masked");
    expect(planPremiere(list, start + 5500, month).phase).toBe("idle");
    expect(PREMIERE_TIMING.limit).toBe(90_000);
    expect(PREMIERE_TIMING.rest).toBe(30_000);
  });
});

describe("public synthetic canaries and transition confirmation", () => {
  it("keeps title, body, actual time out of every pre-release fixture DTO", () => {
    const before = JSON.stringify(buildPremiereFixture(start, [10,12], start));
    expect(before).not.toContain(PREMIERE_CANARY);
    expect(before).not.toContain("20:30");
    expect(before).not.toContain("기다려 준");
    const event = entries([10])[0].event;
    expect(event.publicTitle).toBe(""); expect(event.tagIds).toEqual([]);
    expect(event.startsAt).toBe("2026-06-18T00:00:00+09:00");
  });
  it("distinguishes immediate release, deletion, postponement and failure", () => {
    const id = entries([10])[0].id;
    const immediate = buildPremiereFixture(start, [10], start + 9000, "immediate");
    expect(immediate.entries[0].state).toBe("released");
    const deleted = buildPremiereFixture(start, [10], start + 9000, "delete");
    expect(reconcileTeaserReveal([id], { ok: deleted.ok, events: deleted.entries.map(entry => entry.event) }).goneIds).toEqual([id]);
    expect(reconcileTeaserReveal([id], { ok: false, events: [] }).goneIds).toEqual([]);
    const moved = buildPremiereFixture(start, [10], start + 9000, "postpone");
    expect(moved.entries[0].state).toBe("masked");
    expect(Date.parse(moved.entries[0].revealAt!)).toBe(start + 40_000);
  });
});

describe("origin request fanout and composite flash budget", () => {
  it.each([1,100,1000])("%s simultaneous viewers share one origin read", async viewers => {
    const read = vi.fn(async () => { await Promise.resolve(); return { public: true }; });
    const shared = singleFlightCache<{ public: boolean }>();
    const results = await Promise.all(Array.from({ length: viewers }, () => shared("vic:all", read)));
    expect(read).toHaveBeenCalledTimes(1);
    expect(results.every(value => value.public)).toBe(true);
  });
  it("coalesces slow DB requests beyond the normal TTL and recovers from errors", async () => {
    vi.useFakeTimers();
    const shared = singleFlightCache<number>();
    let finish!: (value: number) => void;
    const load = vi.fn(() => new Promise<number>(resolve => { finish = resolve; }));
    const a = shared("a", load, 1000);
    vi.advanceTimersByTime(5000);
    const b = shared("a", load, 1000);
    expect(load).toHaveBeenCalledTimes(1); finish(3);
    expect(await a).toBe(3); expect(await b).toBe(3);
    const fail = vi.fn(async () => { throw new Error("unavailable"); });
    await expect(shared("b", fail)).rejects.toThrow();
    await expect(shared("b", async () => 4)).resolves.toBe(4);
  });
  it("coalesces near-simultaneous big bangs across every source", () => {
    const budget = createFlashBudget();
    expect(budget.request(0)).toBe(true);
    for (const time of [10,90,500,999,1499]) expect(budget.request(time)).toBe(false);
    expect(budget.request(1500)).toBe(true);
  });
});
