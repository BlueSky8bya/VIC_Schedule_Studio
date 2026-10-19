import { describe, expect, it, vi } from "vitest";
import { createCompanionFeedCommands, type CompanionFeedCommand } from "@/lib/ui/viewer-companion/feed-command";
import { planCompanionHomeFoodEjection } from "@/lib/ui/viewer-companion/food-toss";
import type { Platform } from "@/lib/ui/viewer-companion/brain";

const source = {}, settings = {}, month = "2026-10";
const context = { source, settings, month, active: true };
const command = (kind: CompanionFeedCommand<object>["kind"] = "apple") => ({ source, settings, month, kind });

describe("126 manual feed waiting for one real geometry completion", () => {
  it("retries an unprepared command once against fresh matching body and food tiers", () => {
    const queue = createCompanionFeedCommands<object>();
    const floor: Platform = { id: "companion-home-floor-food", kind: "floor", x: 132, width: 62, y: 306, manualOnly: true };
    const body: Platform = { ...floor, id: "companion-home-floor", x: 120, width: 120 };
    const outlet = { id: "snack", kind: "apple" as const, x: 247, y: 290 }, viewport = { width: 1440, height: 1050 };
    expect(planCompanionHomeFoodEjection(outlet, [floor], viewport, [], [])).toBeUndefined();
    queue.enqueue(command());
    const attempt = vi.fn(() => expect(planCompanionHomeFoodEjection(outlet, [floor], viewport, [], [body])).toMatchObject({ food: { platformId: floor.id, y: 306 } }));
    queue.complete(context, attempt); queue.complete(context, attempt);
    expect(attempt).toHaveBeenCalledTimes(1); expect(queue.pending()).toBe(false);
  });
  it("preserves a native burst's chosen food order and bounds pending work to eight", () => {
    const queue = createCompanionFeedCommands<object>(), attempts: string[] = [];
    for (const kind of ["apple", "banana", "apple", "banana", "apple", "banana", "apple", "banana"] as const) expect(queue.enqueue(command(kind))).toBe(true);
    expect(queue.enqueue(command())).toBe(false);
    queue.complete(context, request => attempts.push(request.kind));
    expect(attempts).toEqual(["apple", "banana", "apple", "banana", "apple", "banana", "apple", "banana"]);
  });
  it.each([
    ["month", { ...context, month: "2026-11" }],
    ["settings", { ...context, settings: {} }],
    ["remounted source", { ...context, source: {} }],
    ["removed or hidden source", { ...context, source: undefined }],
    ["modal, pause or hidden document", { ...context, active: false }],
  ])("cancels rather than replaying after %s changes", (_reason, current) => {
    const queue = createCompanionFeedCommands<object>(), attempt = vi.fn();
    queue.enqueue(command()); queue.complete(current, attempt); queue.complete(context, attempt);
    expect(attempt).not.toHaveBeenCalled(); expect(queue.pending()).toBe(false);
  });
  it("does not retry an unreachable fresh floor, and clear cancels before completion", () => {
    const queue = createCompanionFeedCommands<object>(), attempt = vi.fn(() => undefined);
    queue.enqueue(command()); queue.complete(context, attempt); queue.complete(context, attempt);
    expect(attempt).toHaveBeenCalledTimes(1);
    queue.enqueue(command()); queue.cancel(); queue.complete(context, attempt);
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
