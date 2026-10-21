import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACT, describeTarget } from "@/lib/activity/labels";
import { sanitizeMeta, sanitizeTarget } from "@/lib/activity/kinds";
import type { ActivityVisit, UsageRow } from "@/lib/activity/query";

const state = vi.hoisted(() => ({ values: [] as unknown[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: () => {}, useState: (initial: unknown) => [state.values.length ? state.values.shift() : typeof initial === "function" ? (initial as () => unknown)() : initial, () => {}] }));
vi.mock("@/lib/analytics/guard", () => ({ skipAnalyticsClient: () => false }));
vi.mock("@/lib/activity/query", () => ({ getActivityDayAction: vi.fn(), getActivityUsageAction: vi.fn() }));
vi.mock("@/components/developer/scroll-position", () => ({ ScrollPosition: () => null }));
vi.mock("@/components/developer/insights-dashboard", () => ({ deviceLabel: () => "데스크톱", fmtDur: () => "1초", hhmm: () => "00:00", roleColor: () => "#000" }));
afterEach(() => { state.values = []; vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });
const target = "companion-home-wash";
describe("162 explicit wash activity without autonomous care metadata", () => {
  it("uses one fixed semantic control, sanitizes contents and names it in both developer views", async () => {
    expect(ACT[target].area).toBe("빅타민"); expect(sanitizeTarget(target)).toBe(target); expect(sanitizeTarget(target + "#private-personality")).toBe(target);
    expect(sanitizeMeta({ personality: "private-personality", learned: "private-care", foodId: "private-food" })).toBeNull();
    expect(describeTarget("ui.click", target)).toMatchObject({ area: "빅타민", name: "빅타민 샤워패드에서 씻기" });
    vi.stubGlobal("React", await import("react"));
    const { ActivityUsage } = await import("@/components/developer/activity-usage");
    const { ActivityTimeline } = await import("@/components/developer/activity-timeline");
    const rows: UsageRow[] = [{ kind: "ui.click", label: "누름", target, total: 2, roles: { developer: 2 }, auto: false }];
    const at = Date.parse("2026-10-20T15:00:00Z");
    const visit: ActivityVisit = { key: "synthetic-visit", account: "계정 #1", role: "developer", device: "desktop", startMs: at, endMs: at + 2000, items: [{ t: at, kind: "ui.click", label: "누름", target, targetLabel: null, source: "client", meta: null, durMs: null }] };
    state.values = [30, rows, null, false, false, "all", "all", "all", true, false, false, false, { since: "2026-09-21", until: "2026-10-21" }];
    const usage = renderToStaticMarkup(createElement(ActivityUsage, { anchor: "2026-10-21" }));
    state.values = [[visit], [], null, false, new Set([visit.key]), null, true, false, at];
    const timeline = renderToStaticMarkup(createElement(ActivityTimeline, { dateKey: "2026-10-21" }));
    expect(usage).toContain("빅타민 샤워패드에서 씻기"); expect(timeline).toContain("빅타민 샤워패드에서 씻기");
  });
  it("delegated pointer and keyboard activation each emit exactly one human click", async () => {
    vi.useFakeTimers(); const handlers = new Map<string, (event: unknown) => void>(), fetcher = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetcher); vi.stubGlobal("document", { visibilityState: "visible", addEventListener: (name: string, handler: (event: unknown) => void) => handlers.set(name, handler) });
    vi.stubGlobal("window", { addEventListener: () => {}, setTimeout, clearTimeout, sessionStorage: { getItem: () => null } });
    const logger = await import("@/lib/activity/client"); logger.startClickTracking();
    for (const detail of [1, 0]) { const control = { hasAttribute: () => false, getAttribute: (name: string) => name === "data-act" ? target : null, matches: () => false }; handlers.get("click")!({ detail, target: { closest: () => control } }); }
    await vi.advanceTimersByTimeAsync(15000);
    const events = fetcher.mock.calls.flatMap(([, init]) => JSON.parse(init.body).events) as { target: string; meta: unknown; durMs: unknown }[];
    expect(events.map(e => e.target)).toEqual([target, target]); expect(events.every(e => e.meta === null && e.durMs === null)).toBe(true);
  });
});
