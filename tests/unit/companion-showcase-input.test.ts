import { afterEach, expect, it, vi } from "vitest";
import { bindCompanionShowcaseInput } from "@/lib/ui/viewer-companion/showcase-input";
import type { CompanionShowcaseSession } from "@/lib/ui/viewer-companion/showcase-session";

class InputElement extends EventTarget {
  attributes = new Set<string>(); capture = new Set<number>(); focus = vi.fn();
  closest() { return this; }
  setPointerCapture(id: number) { this.capture.add(id); }
  hasPointerCapture(id: number) { return this.capture.has(id); }
  releasePointerCapture(id: number) { this.capture.delete(id); }
  setAttribute(name: string) { this.attributes.add(name); }
  removeAttribute(name: string) { this.attributes.delete(name); }
}
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  vi.stubGlobal("HTMLElement", InputElement);
  const layer = new InputElement(), button = new InputElement(), point = { x: 100, y: 100 }, complete = vi.fn();
  let allowed = true;
  const session = { has: () => true, point: () => point, move: (_id: string, next: { x: number; y: number }) => { point.x = Math.max(0, Math.min(400, next.x)); point.y = Math.max(0, Math.min(400, next.y)); } } as unknown as CompanionShowcaseSession;
  const stop = bindCompanionShowcaseInput(layer as unknown as HTMLElement, session, () => "local-item", () => allowed, complete);
  const send = (type: string, properties: Record<string, unknown> = {}) => {
    const event = new Event(type, { cancelable: true });
    for (const [name, value] of Object.entries({ target: button, button: 0, pointerId: 1, clientX: point.x, clientY: point.y, ...properties })) Object.defineProperty(event, name, { value });
    layer.dispatchEvent(event); return event;
  };
  return { point, complete, send, stop, session, block: () => { allowed = false; } };
}

it("records one anonymous completion after a real moved pointer release and ignores its lost-capture/click tail", () => {
  const h = fixture(); h.send("pointerdown"); h.send("pointermove", { clientX: 130, clientY: 145 }); h.send("pointerup", { clientX: 130, clientY: 145 });
  expect(h.point).toEqual({ x: 130, y: 145 }); expect(h.complete.mock.calls).toEqual([[]]);
  h.send("lostpointercapture"); h.send("pointerup"); h.send("click"); expect(h.complete).toHaveBeenCalledTimes(1); h.stop();
});
it("does not log a no-motion tap, canceled transfer or unmount", () => {
  const h = fixture(); h.send("pointerdown"); h.send("pointerup"); expect(h.complete).not.toHaveBeenCalled();
  h.send("pointerdown"); h.send("pointermove", { clientX: 160 }); h.send("pointercancel"); expect(h.complete).not.toHaveBeenCalled();
  h.send("pointerdown"); h.send("pointermove", { clientY: 180 }); h.stop(); expect(h.complete).not.toHaveBeenCalled();
});
it("records each physical arrow press once while repeats, clamped keys and Space/Enter add no duplicate", () => {
  const h = fixture(); h.send("keydown", { key: "ArrowRight", repeat: false }); expect(h.point.x).toBe(116); expect(h.complete).toHaveBeenCalledTimes(1);
  h.send("keydown", { key: "ArrowRight", repeat: true }); expect(h.point.x).toBe(132); expect(h.complete).toHaveBeenCalledTimes(1);
  h.send("keydown", { key: " ", repeat: false }); h.send("keydown", { key: "Enter", repeat: false }); expect(h.complete).toHaveBeenCalledTimes(1);
  h.point.x = 400; h.send("keydown", { key: "ArrowRight", repeat: false }); expect(h.complete).toHaveBeenCalledTimes(1);
  h.block(); h.send("keydown", { key: "ArrowLeft", repeat: false }); expect(h.point.x).toBe(400); h.stop();
});
it("does not turn autonomous position or lifecycle updates into a direct action", () => {
  const h = fixture(); h.session.move("local-item", { x: 240, y: 220 }); h.send("click"); expect(h.complete).not.toHaveBeenCalled(); h.stop();
});
