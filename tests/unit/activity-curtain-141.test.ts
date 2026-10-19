import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACT, describeTarget } from "@/lib/activity/labels";
import { sanitizeMeta, sanitizeTarget } from "@/lib/activity/kinds";
import { companionCurtainControl, createCompanionCurtainControl } from "@/lib/ui/viewer-companion/home-curtain-control";
import type { ActivityVisit, UsageRow } from "@/lib/activity/query";

const state = vi.hoisted(() => ({ values: [] as unknown[] }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: () => {}, useState: (initial: unknown) => [state.values.length ? state.values.shift() : typeof initial === "function" ? (initial as () => unknown)() : initial, () => {}] }));
vi.mock("@/lib/analytics/guard", () => ({ skipAnalyticsClient: () => false }));
vi.mock("@/lib/activity/query", () => ({ getActivityDayAction: vi.fn(), getActivityUsageAction: vi.fn() }));
vi.mock("@/components/developer/scroll-position", () => ({ ScrollPosition: () => null }));
vi.mock("@/components/developer/insights-dashboard", () => ({ deviceLabel: () => "데스크톱", fmtDur: () => "1초", hhmm: () => "00:00", roleColor: () => "#000" }));

const options = ["shade", "closed", "open"] as const;
const targets = options.map(option => `companion-home-curtain#${option}`);
afterEach(() => { state.values = []; vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); });

describe("141 direct curtain activity; synthetic transport and developer display fixtures", () => {
  it("uses three fixed operations and removes personal contents before transport/storage", () => {
    expect(ACT["companion-home-curtain"].opts).toEqual({ open: "열기", shade: "반쯤 닫기", closed: "닫기" });
    for (const target of targets) {
      expect(sanitizeTarget(target)).toBe(target);
      expect(sanitizeMeta({ title: "private-canary", toyId: "private-toy" })).toBeNull();
      expect(describeTarget("ui.click", target)).toMatchObject({ area: "빅타민" });
      expect(describeTarget("ui.click", target).unnamed).toBeUndefined();
    }
    expect(sanitizeTarget("companion-home-curtain#private-canary")).toBe("companion-home-curtain");
  });

  it("captures each pointer/native-keyboard generated click once; automatic changes never manufacture clicks", async () => {
    vi.useFakeTimers();
    const handlers = new Map<string, (event: unknown) => void>(), fetcher = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetcher);
    vi.stubGlobal("document", { addEventListener: (name: string, listener: (event: unknown) => void) => handlers.set(name, listener), visibilityState: "visible" });
    vi.stubGlobal("window", { addEventListener: () => {}, setTimeout, clearTimeout, sessionStorage: { getItem: () => null } });
    const client = await import("@/lib/activity/client"); client.startClickTracking();
    let now = 0; const control = createCompanionCurtainControl(() => now);
    for (const detail of [1, 0]) {
      for (const option of options) {
        const next = companionCurtainControl(control.read()); expect(next.next).toBe(option);
        const button = { hasAttribute: () => false, getAttribute: (name: string) => name === "data-act" ? "companion-home-curtain" : name === "data-act-opt" ? next.next : null, matches: () => false };
        // The browser's pointer click and key activation both arrive at the
        // same document click delegate. This is a unit DOM boundary, not a
        // claim that a real browser key has been exercised here.
        handlers.get("click")!({ detail, target: { closest: () => button } });
        expect(control.set(option, "human")).toBe(true);
      }
    }
    expect(control.set("shade", "companion")).toBe(false); now = 15001;
    expect(control.set("shade", "companion")).toBe(true);
    await vi.advanceTimersByTimeAsync(15000);
    const events = fetcher.mock.calls.flatMap(([, init]) => JSON.parse(init.body).events) as { target: string; meta: unknown; durMs: unknown }[];
    expect(events.map(event => event.target)).toEqual([...targets, ...targets]);
    expect(events.every(event => event.meta === null && event.durMs === null)).toBe(true);
    expect(JSON.stringify(events)).not.toMatch(/private|sun|sleep|personality|toyId/);
  });

  it("renders all three operations by the shared names in both actual developer cards", async () => {
    vi.stubGlobal("React", await import("react"));
    const { ActivityUsage } = await import("@/components/developer/activity-usage");
    const { ActivityTimeline } = await import("@/components/developer/activity-timeline");
    const rows: UsageRow[] = targets.map(target => ({ kind: "ui.click", label: "누름", target, total: 1, roles: { developer: 1 }, auto: false }));
    const at = Date.parse("2026-10-19T15:00:00Z");
    const visit: ActivityVisit = { key: "synthetic-visit", account: "계정 #1", role: "developer", device: "desktop", startMs: at, endMs: at + 2000, items: targets.map((target, i) => ({ t: at + i * 1000, kind: "ui.click", label: "누름", target, targetLabel: null, source: "client", meta: null, durMs: null })) };
    // Seed the cards' already-authorized query result state. Their real JSX
    // and shared label lookup render below; no server/DB request is executed.
    state.values = [30, rows, null, false, false, "all", "all", "all", true, false, false, false, { since: "2026-09-21", until: "2026-10-20" }];
    const usage = renderToStaticMarkup(createElement(ActivityUsage, { anchor: "2026-10-20" }));
    state.values = [[visit], [], null, false, new Set([visit.key]), null, true, false, at];
    const timeline = renderToStaticMarkup(createElement(ActivityTimeline, { dateKey: "2026-10-20" }));
    for (const name of ["반쯤 닫기", "닫기", "열기"]) {
      expect(usage).toContain(`빅타민 집 커튼 · ${name}`);
      expect(timeline).toContain(`빅타민 집 커튼 · ${name}`);
    }
    expect(usage).not.toContain("이름 미등록"); expect(timeline).not.toContain("이름 미등록");
  });
});
