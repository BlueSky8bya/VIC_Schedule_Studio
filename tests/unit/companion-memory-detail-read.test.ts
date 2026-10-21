import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPANION_PORTRAIT_READY_EVENT } from "@/lib/ui/viewer-companion/memory-catalog";
const hooks = vi.hoisted(() => ({ effect: undefined as (() => void | (() => void)) | undefined }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useRef: (value: unknown) => ({ current: value }), useEffect: (effect: () => void | (() => void)) => { hooks.effect = effect; } }));
import { useCompanionDetailRead } from "@/components/shared/use-companion-detail-read";

describe("visible native portrait reading", () => {
  let canvas: { dataset: Record<string, string> }, element: EventTarget, intersect: (entries: { intersectionRatio: number }[]) => void, cleanup: (() => void) | void;
  const acknowledge = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers(); acknowledge.mockReset(); canvas = { dataset: {} };
    element = Object.assign(new EventTarget(), { isConnected: true, closest: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 200, height: 200 }),
      querySelectorAll: (selector: string) => selector.startsWith("canvas") ? [canvas] : [], contains: (hit: unknown) => hit === element });
    vi.stubGlobal("window", Object.assign(new EventTarget(), { setTimeout, clearTimeout }));
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible", hasFocus: () => true, elementFromPoint: () => element }));
    vi.stubGlobal("getComputedStyle", () => ({ visibility: "visible", opacity: "1" }));
    vi.stubGlobal("IntersectionObserver", class { constructor(callback: typeof intersect) { intersect = callback; } observe() {} disconnect() {} });
    useCompanionDetailRead({ current: element as HTMLDivElement }, true, "behavior:expression:sour", acknowledge);
    cleanup = hooks.effect!(); intersect([{ intersectionRatio: 1 }]);
  });
  afterEach(() => { cleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); });
  it("keeps a cold or failed canvas unread and begins the1200ms dwell only after actual paint", () => {
    vi.advanceTimersByTime(3000); expect(acknowledge).not.toHaveBeenCalled();
    canvas.dataset.portraitReady = "false"; element.dispatchEvent(new Event(COMPANION_PORTRAIT_READY_EVENT));
    vi.advanceTimersByTime(3000); expect(acknowledge).not.toHaveBeenCalled();
    canvas.dataset.portraitReady = "true"; element.dispatchEvent(new Event(COMPANION_PORTRAIT_READY_EVENT));
    vi.advanceTimersByTime(1199); expect(acknowledge).not.toHaveBeenCalled(); vi.advanceTimersByTime(1); expect(acknowledge).toHaveBeenCalledOnce();
    element.dispatchEvent(new Event(COMPANION_PORTRAIT_READY_EVENT)); vi.advanceTimersByTime(3000); expect(acknowledge).toHaveBeenCalledOnce();
  });
  it("does not acknowledge after the detail is hidden or unmounted", () => {
    canvas.dataset.portraitReady = "true"; element.dispatchEvent(new Event(COMPANION_PORTRAIT_READY_EVENT)); vi.advanceTimersByTime(500);
    intersect([{ intersectionRatio: 0 }]); vi.advanceTimersByTime(1200); expect(acknowledge).not.toHaveBeenCalled();
    intersect([{ intersectionRatio: 1 }]); cleanup?.(); cleanup = undefined; vi.advanceTimersByTime(1200); expect(acknowledge).not.toHaveBeenCalled();
  });
});
