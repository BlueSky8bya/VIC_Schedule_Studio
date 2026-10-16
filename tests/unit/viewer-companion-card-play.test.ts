import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPANION_CARD_PLAY_EVENT, createCompanionCardPlay } from "@/lib/ui/viewer-companion/card-play";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
function fixture() {
  vi.useFakeTimers();
  const events = new EventTarget(), moved = vi.fn(); events.addEventListener(COMPANION_CARD_PLAY_EVENT, moved);
  vi.stubGlobal("window", events); vi.stubGlobal("getComputedStyle", () => ({ rotate: "2.2deg" }));
  class NodeStub {
    dataset: Record<string, string> = {};
    animations: { cancel: ReturnType<typeof vi.fn>; onfinish?: () => void }[] = [];
    contains(target: unknown) { return target === this; }
    removeAttribute(name: string) { if (name === "data-vc-ruffled") delete this.dataset.vcRuffled; }
    animate() { const animation = { cancel: vi.fn(), onfinish: undefined as (() => void) | undefined }; this.animations.push(animation); return animation; }
  }
  vi.stubGlobal("Node", NodeStub);
  const node = new NodeStub(), play = createCompanionCardPlay();
  return { node: node as unknown as HTMLElement, animations: node.animations, play, moved };
}
describe("bounded cosmetic card recovery", () => {
  it("invalidates each actual motion window, with no wake during the held angle", () => {
    const f = fixture(); f.play.bump(f.node, 1); expect(f.moved).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(6400); expect(f.moved).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100); expect(f.moved).toHaveBeenCalledTimes(2);
    expect(f.play.restore(f.node)).toBe(false);
    expect(f.animations[0].cancel).toHaveBeenCalledOnce(); expect(f.animations).toHaveLength(2);
    f.animations[1].onfinish?.(); expect(f.animations[1].cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("click restores early; scene disposal also owns the recovery animation", () => {
    const f = fixture(); f.play.bump(f.node, -1); expect(f.play.restore(f.node)).toBe(true);
    expect(f.play.restore(f.node)).toBe(false);
    expect(f.node.dataset.vcRuffled).toBeUndefined(); expect(vi.getTimerCount()).toBe(0);
    f.play.clear(); expect(f.animations[1].cancel).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(10000); expect(f.moved).toHaveBeenCalledTimes(2);
  });
  it("a different event target cannot cancel the playful card, and hard stop removes its timeout", () => {
    const f = fixture(); f.play.bump(f.node, 1); expect(f.play.restore(new EventTarget())).toBe(false);
    expect(f.moved).toHaveBeenCalledTimes(1); f.play.clear();
    expect(vi.getTimerCount()).toBe(0); vi.advanceTimersByTime(10000); expect(f.moved).toHaveBeenCalledTimes(1);
  });
});
