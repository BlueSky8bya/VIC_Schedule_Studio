import { afterEach, expect, it, vi } from "vitest";
import { createCompanionCardPlay, pivotShift } from "@/lib/ui/viewer-companion/card-play";

// 이어진 일정은 한 몸으로 기운다(2026-11-19): 모든 조각이 같은 축·같은(줄인) 각도로 돌고, 되돌리기도 같이.
// 축은 transform-origin을 덮어쓰지 않고 rotate + translate로 만든다(다른 transform의 기준점 보존).
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

class NodeStub {
  dataset: Record<string, string> = {};
  frames: Keyframe[][] = [];
  animations: { cancel: ReturnType<typeof vi.fn>; onfinish?: () => void }[] = [];
  contains(target: unknown) { return target === this; }
  removeAttribute(name: string) { if (name === "data-vc-ruffled") delete this.dataset.vcRuffled; }
  animate(frames: Keyframe[]) { this.frames.push(frames); const a = { cancel: vi.fn(), onfinish: undefined as (() => void) | undefined }; this.animations.push(a); return a; }
}

it("pivotShift is the exact rigid-rotation correction", () => {
  // 축이 오른쪽 100px: 시계 90° 돌리면 원점은 (100, -100)만큼 옮겨져야 한다.
  const d = pivotShift({ x: 100, y: 0 }, 90);
  expect(d.x).toBeCloseTo(100);
  expect(d.y).toBeCloseTo(-100);
  expect(pivotShift({ x: 0, y: 0 }, 12)).toEqual({ x: 0, y: 0 });
});

it("measures after clearing, tilts every piece around the shared pivot and restores them together", () => {
  vi.useFakeTimers();
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("getComputedStyle", () => ({ rotate: "9deg" }));
  vi.stubGlobal("Node", NodeStub);
  const a = new NodeStub(), b = new NodeStub();
  const play = createCompanionCardPlay();
  play.bump(a as unknown as HTMLElement, 1); // 혼자 기울어 있는 중
  const order: string[] = [];
  const measure = () => {
    order.push(a.animations[0].cancel.mock.calls.length ? "cleared-then-measured" : "measured-while-tilted");
    return { parts: [a, b] as unknown as HTMLElement[], arms: [{ x: 50, y: 0 }, { x: -50, y: 0 }], scale: 0.5 };
  };
  play.bump(a as unknown as HTMLElement, 1, measure);
  expect(order).toEqual(["cleared-then-measured"]);
  const end = a.frames[1][1] as { rotate: string; translate: string; transformOrigin?: string };
  expect(end.rotate).toBe("1.1deg");
  expect(end.transformOrigin).toBeUndefined();
  expect(end.translate).toMatch(/px .*px$/);
  // 묶음의 다른 조각을 눌러도 같이 제자리로 — 잡고 있던 각도(1.1°)에서 0으로.
  expect(play.restore(b as unknown as EventTarget)).toBe(true);
  expect(b.frames[1][0]).toMatchObject({ rotate: "1.1deg" });
  expect(b.frames[1][1]).toMatchObject({ rotate: "0deg", translate: "0.00px 0.00px" });
  a.animations[2].onfinish?.();
  expect(b.animations[1].cancel).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
