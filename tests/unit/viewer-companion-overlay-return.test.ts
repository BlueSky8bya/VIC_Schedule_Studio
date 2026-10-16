import { describe, expect, it } from "vitest";
import { COMPANION_RETURN_SETTLE_MS, createCompanionOverlayReturn } from "@/lib/ui/viewer-companion/overlay-return";
import { COMPANION_TIMING as T } from "@/lib/ui/viewer-companion/timing";

const from = { x: 120, y: 700, scale: 44 / 76 }, target = { x: 800, y: 360, scale: 1 };
describe("explicit guest-drop display return", () => {
  it("keeps a user-dropped guest's horizontal position while its scale and feet settle onto fresh support", () => {
    const released = { x: 419.75, y: 480.5, scale: .72 }, support = { x: released.x, y: 760, scale: 1 };
    const bridge = createCompanionOverlayReturn(released, 100, false, 520);
    expect(bridge.sample(120, support, false).point).toEqual(released);
    const frames = Array.from({ length: 73 }, (_, i) => bridge.sample(140 + i * 16, support, true));
    expect(frames.every(frame => frame.point.x === released.x)).toBe(true);
    expect(frames.some(frame => frame.point.y > released.y && frame.point.y < support.y)).toBe(true);
    expect(frames.some(frame => frame.point.scale > released.scale && frame.point.scale < 1)).toBe(true);
    expect(frames.at(-1)).toMatchObject({ done: true, expired: false, point: support });
  });
  it("keeps the actual perch and scale through waking, then travels and settles before decisions", () => {
    const bridge = createCompanionOverlayReturn(from, 100, true, 520);
    const travelStart = 100 + T.presenceWake;
    expect(bridge.sample(100, target, true).point).toEqual(from);
    expect(bridge.sample(travelStart - 1, target, true).point).toEqual(from);
    const middle = bridge.sample(travelStart + 260, target, true);
    expect(middle.progress).toBe(.5); expect(middle.point.x).toBe(460); expect(middle.phase).toBe("return");
    expect(bridge.sample(travelStart + 520, target, true)).toMatchObject({ point: target, phase: "settle", done: false });
    expect(bridge.sample(travelStart + 520 + COMPANION_RETURN_SETTLE_MS - 1, target, true).done).toBe(false);
    expect(bridge.sample(travelStart + 520 + COMPANION_RETURN_SETTLE_MS, target, true).done).toBe(true);
  });
  it("waits for the real geometry without starting a new journey on every delivery", () => {
    const bridge = createCompanionOverlayReturn(from, 0, false, 520);
    expect(bridge.sample(240, target, false).point).toEqual(from);
    expect(bridge.sample(300, target, true).point).toEqual(from);
    expect(bridge.sample(560, target, true).progress).toBe(.5);
    expect(bridge.sample(820, { ...target, y: 400 }, true).point.y).toBe(400);
    expect(bridge.sample(1170, target, true).done).toBe(true);
  });
  it("expires missing support rather than holding a visible creature forever", () => {
    const bridge = createCompanionOverlayReturn(from, 0, true, 520);
    expect(bridge.sample(999, target, false)).toMatchObject({ done: false, expired: false });
    expect(bridge.sample(1000, target, false)).toMatchObject({ done: true, expired: true });
  });
  it("stops at the last display if the actual return support disappears", () => {
    const bridge = createCompanionOverlayReturn(from, 0, false, 520);
    bridge.sample(0, target, true);
    const shown = bridge.sample(420, target, true).point;
    expect(bridge.sample(430, { ...target, y: 9000 }, false)).toMatchObject({ point: shown, expired: true, done: true });
  });
  it("skips wake/travel for reduced graphics but retains a short decision cooldown", () => {
    const bridge = createCompanionOverlayReturn(from, 0, true, 520);
    expect(bridge.sample(0, target, true, true)).toMatchObject({ point: target, phase: "settle", done: false });
    expect(bridge.sample(350, target, true, true).done).toBe(true);
  });
  it("can seed a reopened window from the current mid-return display", () => {
    const bridge = createCompanionOverlayReturn(from, 0, false, 520);
    bridge.sample(0, target, true);
    const current = bridge.sample(420, target, true).point;
    const replacement = createCompanionOverlayReturn(current, 420, false, 520);
    expect(replacement.sample(420, target, true).point).toEqual(current);
    expect(current.scale).toBeGreaterThan(from.scale); expect(current.scale).toBeLessThan(1);
  });
});
