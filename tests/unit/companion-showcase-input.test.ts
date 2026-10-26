import { afterEach, expect, it, vi } from "vitest";
import { bindCompanionShowcaseInput, type CompanionShowcaseInputOptions } from "@/lib/ui/viewer-companion/showcase-input";
import type { CompanionShowcaseSession } from "@/lib/ui/viewer-companion/showcase-session";
import { createCompanionHeldShake } from "@/lib/ui/viewer-companion/held-shake";

class InputElement extends EventTarget {
  attributes = new Set<string>(); capture = new Set<number>(); focus = vi.fn();
  child?: InputElement;
  closest() { return this; }
  setPointerCapture(id: number) { this.capture.add(id); }
  hasPointerCapture(id: number) { return this.capture.has(id); }
  releasePointerCapture(id: number) { this.capture.delete(id); }
  setAttribute(name: string) { this.attributes.add(name); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  toggleAttribute(name: string, force: boolean) { if (force) this.attributes.add(name); else this.attributes.delete(name); }
  querySelector() { return this.child ?? this; }
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function fixture(options: CompanionShowcaseInputOptions = {}) {
  vi.stubGlobal("HTMLElement", InputElement);
  const layer = new InputElement(), button = new InputElement(), point = { x: 100, y: 100, width: 44, height: 44, bottomOffset: 0 }, complete = vi.fn();
  const second = new InputElement(), secondPoint = { ...point, x: 250 }, listeners = new Set<() => void>(); layer.child = button;
  vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("innerWidth", 500); vi.stubGlobal("innerHeight", 500); vi.stubGlobal("cancelAnimationFrame", vi.fn());
  let allowed = true;
  const locate = (id: string) => id === "second-item" ? secondPoint : point;
  const session = { has: () => true, visible: () => true, active: () => false, subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); }, present: vi.fn(), point: locate, move: (id: string, next: { x: number; y: number }) => { const at = locate(id); at.x = Math.max(0, Math.min(400, next.x)); at.y = Math.max(0, Math.min(400, next.y)); for (const listener of listeners) listener(); } } as unknown as CompanionShowcaseSession;
  const stop = bindCompanionShowcaseInput(layer as unknown as HTMLElement, session, node => node === second as unknown as HTMLElement ? "second-item" : "local-item", () => allowed, complete, options);
  const send = (type: string, properties: Record<string, unknown> = {}) => {
    const event = new Event(type, { cancelable: true });
    for (const [name, value] of Object.entries({ target: button, button: 0, pointerId: 1, clientX: point.x, clientY: point.y, ...properties })) Object.defineProperty(event, name, { value });
    layer.dispatchEvent(event); return event;
  };
  return { point, button, second, secondPoint, complete, send, stop, session, emit: () => { for (const listener of listeners) listener(); }, block: () => { allowed = false; } };
}

it("records one anonymous completion after a real moved pointer release and ignores its lost-capture/click tail", () => {
  const h = fixture(); h.send("pointerdown"); h.send("pointermove", { clientX: 130, clientY: 145 }); h.send("pointerup", { clientX: 130, clientY: 145 });
  expect(h.point).toMatchObject({ x: 130, y: 145 }); expect(h.complete.mock.calls).toEqual([[]]);
  h.send("lostpointercapture"); h.send("pointerup"); h.send("click"); expect(h.complete).toHaveBeenCalledTimes(1); h.stop();
});

it.each(["pointerdown", "Enter", "ArrowRight", "Delete"])("hands an inactive survivor to ordinary input on %s without consuming or logging that event", input => {
  const adopt = vi.fn(() => true), h = fixture({ onReclaim: adopt, ...(input === "Delete" ? { onDiscard: vi.fn() } : {}) });
  const reclaim = vi.fn((id: string, receive: (point: { x: number; y: number }) => boolean) => receive({ x: h.point.x, y: h.point.y }));
  h.session.reclaim = reclaim;
  const event = input === "pointerdown" ? h.send(input) : h.send("keydown", { key: input, repeat: false });
  expect(event.defaultPrevented).toBe(false); expect(reclaim).toHaveBeenCalledTimes(1);
  expect(adopt).toHaveBeenCalledWith("local-item", { x: 100, y: 100 });
  expect(h.button.capture.size).toBe(0); expect(h.complete).not.toHaveBeenCalled(); h.stop();
});

it("retains showcase capture during appreciation and never reclaims a blocked or unsupported input", () => {
  const adopt = vi.fn(() => true), h = fixture({ item: "toy", onReclaim: adopt }); h.session.reclaim = vi.fn();
  h.send("keydown", { key: "Tab" }); expect(h.session.reclaim).not.toHaveBeenCalled();
  h.send("keydown", { key: "Delete" }); h.send("keydown", { key: "Backspace" }); expect(h.session.reclaim).not.toHaveBeenCalled();
  h.session.active = () => true;
  expect(h.send("pointerdown").defaultPrevented).toBe(true); h.send("pointercancel");
  expect(h.session.reclaim).not.toHaveBeenCalled(); h.session.active = () => false; h.block();
  h.send("pointerdown"); h.send("keydown", { key: "Enter" }); expect(h.session.reclaim).not.toHaveBeenCalled(); expect(adopt).not.toHaveBeenCalled(); h.stop();
});

it.each(["pointerdown", "ArrowRight"])("consumes %s when the ordinary owner cannot reclaim yet", input => {
  const h = fixture({ onReclaim: vi.fn(() => false) }); h.session.reclaim = vi.fn(() => false);
  const event = input === "pointerdown" ? h.send(input) : h.send("keydown", { key: input });
  expect(event.defaultPrevented).toBe(true); expect(h.point).toMatchObject({ x: 100, y: 100 });
  expect(h.button.capture.size).toBe(0); expect(h.complete).not.toHaveBeenCalled(); h.stop();
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
it("distinguishes a real short tap from a drag and keeps petting available with drag OFF", () => {
  const tap = vi.fn(), hold = vi.fn(), h = fixture({ canDrag: () => false, onTap: tap, onHold: hold });
  h.send("pointerdown"); h.send("pointermove", { clientX: 102 }); h.send("pointerup", { clientX: 102 });
  expect(tap).toHaveBeenCalledTimes(1); expect(h.point.x).toBe(100); expect(hold).not.toHaveBeenCalledWith(true); expect(h.complete).not.toHaveBeenCalled(); h.stop();
});
it("keyboard hold moves once, drops on Escape and leaves the next Escape to the appreciation exit", () => {
  const h = fixture(); h.send("keydown", { key: " ", repeat: false }); expect(h.button.attributes.has("data-showcase-held")).toBe(true);
  h.send("keydown", { key: "ArrowRight", repeat: false }); h.send("keydown", { key: "ArrowDown", repeat: false }); expect(h.complete).not.toHaveBeenCalled();
  expect(h.send("keydown", { key: "Escape" }).defaultPrevented).toBe(true); expect(h.complete).toHaveBeenCalledTimes(1); expect(h.button.attributes.has("data-showcase-held")).toBe(false);
  expect(h.send("keydown", { key: "Escape" }).defaultPrevented).toBe(false); h.stop();
});
it("routes Enter petting and food Delete to real handlers without fabricating a placement", () => {
  const activate = vi.fn(), discard = vi.fn(), h = fixture({ pet: true, onActivate: activate, onDiscard: discard });
  h.send("keydown", { key: "Enter", repeat: false }); h.send("keydown", { key: "Enter", repeat: true }); expect(activate).toHaveBeenCalledTimes(1);
  h.send("keydown", { key: "Delete", repeat: false }); h.send("keydown", { key: "Delete", repeat: true }); expect(discard.mock.calls).toEqual([["local-item"]]); expect(h.complete).not.toHaveBeenCalled(); h.stop();
});
it("does not reward canceled taps, held key repeats, stationary hover or the pointer click tail", () => {
  const tap = vi.fn(), activate = vi.fn(), hover = vi.fn(), h = fixture({ pet: true, onTap: tap, onActivate: activate, onHover: hover });
  h.send("pointerdown"); h.send("pointercancel"); h.send("click", { detail: 1 }); expect(tap).not.toHaveBeenCalled(); expect(activate).not.toHaveBeenCalled();
  h.send("pointermove", { pointerType: "mouse", buttons: 0 }); expect(hover).toHaveBeenCalledTimes(1); expect(h.complete).not.toHaveBeenCalled();
  h.send("click", { detail: 0 }); expect(activate).toHaveBeenCalledTimes(1); h.stop();
});
it("consumes actual recent release velocity into one bounded finite flight, then stops its RAF", () => {
  let now = 0, serial = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const frames = new Map<number, FrameRequestCallback>(), flight = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; });
  const h = fixture({ onFlight: flight }); h.session.active = () => true;
  h.send("pointerdown"); now = 20; h.send("pointermove", { clientX: 125, clientY: 90 }); now = 40; h.send("pointermove", { clientX: 150, clientY: 75 }); now = 50; h.send("pointerup", { clientX: 165, clientY: 60 });
  expect(h.complete).toHaveBeenCalledTimes(1); expect(flight).toHaveBeenCalledWith(true, expect.objectContaining({ x: 165, y: 60 }));
  let steps = 0;
  while (frames.size && steps++ < 220) { const batch = [...frames.values()]; frames.clear(); now += 16; for (const callback of batch) callback(now); }
  expect(steps).toBeLessThan(200); expect(frames.size).toBe(0); expect(h.point.y).toBeGreaterThan(300); expect(flight).toHaveBeenLastCalledWith(false, expect.objectContaining({ done: true })); expect(h.complete).toHaveBeenCalledTimes(1); h.stop();
});
it("releases real pointer capture on first Escape, N, blur and appreciation exit without crediting canceled transfers", () => {
  const rest = vi.fn(), h = fixture({ pet: true, onRest: rest });
  h.send("pointerdown"); h.send("pointermove", { clientX: 130 }); h.send("keydown", { key: "Escape" }); expect(h.button.capture.size).toBe(0); expect(h.button.attributes.has("data-showcase-held")).toBe(false);
  h.send("pointerdown"); h.send("pointermove", { clientX: 160 }); h.send("keydown", { key: "n", repeat: false }); expect(rest).toHaveBeenCalledTimes(1); expect(h.button.capture.size).toBe(0);
  h.send("pointerdown"); h.send("pointermove", { clientX: 190 }); window.dispatchEvent(new Event("blur")); expect(h.button.capture.size).toBe(0);
  h.session.active = () => true; h.emit(); h.send("keydown", { key: " ", repeat: false }); h.session.active = () => false; h.emit(); expect(h.button.attributes.has("data-showcase-held")).toBe(false); expect(h.complete).not.toHaveBeenCalled(); h.stop();
});
it("keeps the first real item's finite release moving when another item is grabbed", () => {
  let now = 0, serial = 0; vi.spyOn(performance, "now").mockImplementation(() => now);
  const frames = new Map<number, FrameRequestCallback>(); vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; });
  const h = fixture({ item: "food" }); h.session.active = () => true;
  h.send("pointerdown"); now = 20; h.send("pointermove", { clientX: 125, clientY: 90 }); now = 40; h.send("pointermove", { clientX: 150, clientY: 75 }); now = 50; h.send("pointerup", { clientX: 165, clientY: 60 });
  const before = { x: h.point.x, y: h.point.y }; h.send("pointerdown", { target: h.second, clientX: 250, clientY: 100 });
  const batch = [...frames.values()]; frames.clear(); now += 50; for (const callback of batch) callback(now);
  expect(Math.hypot(h.point.x - before.x, h.point.y - before.y)).toBeGreaterThan(1); expect(frames.size).toBeGreaterThan(0); expect(h.secondPoint.x).toBe(250);
  h.send("pointercancel", { target: h.second }); h.stop();
});
it("does not record a P placement at the identical real foot", () => {
  const release = vi.fn(), h = fixture({ pet: true, onRelease: release }); h.session.active = () => true;
  h.send("keydown", { key: "p", repeat: false }); expect(h.button.attributes.has("data-showcase-placing")).toBe(true);
  const event = new Event("pointerdown", { cancelable: true });
  for (const [name, value] of Object.entries({ button: 0, clientX: 100, clientY: 100 })) Object.defineProperty(event, name, { value });
  document.dispatchEvent(event); expect(h.complete).not.toHaveBeenCalled(); expect(release).not.toHaveBeenCalled(); expect(h.button.attributes.has("data-showcase-placing")).toBe(false); h.stop();
});

it("keeps a fast coalesced release when the parent aggregate and frame delivery are late, without extra care", () => {
  let now = 1000, serial = 0; vi.spyOn(performance, "now").mockImplementation(() => now);
  const frames = new Map<number, FrameRequestCallback>(), flight = vi.fn(), moved = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; });
  const h = fixture({ onFlight: flight, onMove: moved }); h.session.active = () => true;
  h.send("pointerdown", { isTrusted: true, timeStamp: 700 });
  const physical = Array.from({ length: 8 }, (_, index) => ({ isTrusted: true, pointerId: 1, buttons: 1, clientX: 100, clientY: 96 - index * 4, timeStamp: 900 + index * 10 }));
  // The parent's later aggregation time is not another physical input point.
  now = 1200; h.send("pointermove", { isTrusted: true, buttons: 1, timeStamp: 1100, clientX: 100, clientY: 68, getCoalescedEvents: () => physical });
  now = 1350; h.send("pointerup", { isTrusted: true, buttons: 0, timeStamp: 985, clientX: 100, clientY: 68 });
  expect(flight).toHaveBeenCalledWith(true, expect.objectContaining({ x: 100, y: 68 }));
  expect(h.complete).toHaveBeenCalledTimes(1); expect(moved).toHaveBeenCalledTimes(2);
  const batch = [...frames.values()]; frames.clear(); now += 16; for (const callback of batch) callback(now);
  expect(h.point.y).toBeLessThan(68); h.stop();
});

it("delivers clamped physical sample times to held reactions without multiplying action completions", () => {
  let now = 1000; vi.spyOn(performance, "now").mockImplementation(() => now);
  const sample = vi.fn(), hold = vi.fn(), moved = vi.fn(), h = fixture({ onSample: sample, onHold: hold, onMove: moved });
  h.send("pointerdown", { isTrusted: true, timeStamp: 700 });
  now = 1200;
  h.send("pointermove", { isTrusted: true, buttons: 1, timeStamp: 1100, clientX: 800, clientY: 150, getCoalescedEvents: () => [
    { isTrusted: true, pointerId: 1, buttons: 1, clientX: 130, clientY: 120, timeStamp: 900 },
    { isTrusted: true, pointerId: 1, buttons: 1, clientX: 800, clientY: 150, timeStamp: 970 }
  ] });
  expect(hold).toHaveBeenCalledWith(true, 900);
  expect(sample.mock.calls).toEqual([[{ x: 130, y: 120 }, 900], [{ x: 400, y: 150 }, 970]]);
  expect(moved).toHaveBeenCalledTimes(1); expect(h.complete).not.toHaveBeenCalled();
  h.send("pointercancel"); expect(h.complete).not.toHaveBeenCalled(); h.stop();
});

it("cancels a flight reaction before reporting its stopped state instead of inventing a landing", () => {
  let now = 0, serial = 0; vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", () => ++serial);
  const order: string[] = [], h = fixture({ onCancel: () => order.push("cancel"), onFlight: value => order.push(value ? "flying" : "stopped") }); h.session.active = () => true;
  h.send("pointerdown"); now = 20; h.send("pointermove", { clientX: 130 }); now = 40; h.send("pointerup", { clientX: 160 });
  expect(order).toContain("flying"); order.length = 0;
  window.dispatchEvent(new Event("blur"));
  expect(order[0]).toBe("cancel"); expect(order[1]).toBe("stopped"); h.stop();
});

it("keeps an earned real shake available to a normal thrown release", () => {
  let now = 0; vi.spyOn(performance, "now").mockImplementation(() => now); vi.stubGlobal("requestAnimationFrame", () => 1);
  const detector = createCompanionHeldShake(), release = vi.fn((thrown: boolean) => ({ thrown, dizzy: detector.consume(now) }));
  const h = fixture({ onHold: (held, at) => { if (held) detector.begin(h.point.x, h.point.y, at); }, onSample: (point, at) => detector.push(point.x, point.y, at), onCancel: () => detector.reset(), onRelease: release });
  h.session.active = () => true; h.send("pointerdown");
  for (now = 16; now <= 800; now += 16) {
    const leg = Math.floor(now / 200), phase = now / 200 - leg;
    h.send("pointermove", { clientX: 100 + 70 * (leg % 2 ? 1 - phase : phase) });
  }
  now = 800; expect(detector.sample(now).active).toBe(true); h.send("pointerup");
  expect(release).toHaveReturnedWith({ thrown: true, dizzy: true }); expect(h.complete).toHaveBeenCalledTimes(1); h.stop();
});

it("revokes pending flight reactions before a tick sees input or visibility become unavailable", () => {
  let now = 0; vi.spyOn(performance, "now").mockImplementation(() => now);
  const frames: FrameRequestCallback[] = []; vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => { frames.push(frame); return frames.length; });
  const order: string[] = [], release = vi.fn(), h = fixture({ onCancel: () => order.push("cancel"), onFlight: value => order.push(value ? "flying" : "stopped"), onRelease: release });
  h.session.active = () => true;
  h.send("pointerdown"); now = 20; h.send("pointermove", { clientX: 130 }); now = 40; h.send("pointerup", { clientX: 160 });
  expect(order).toContain("flying"); order.length = 0; h.block(); now = 56; frames.shift()!(now);
  expect(order).toEqual(["cancel", "stopped"]); expect(release).toHaveBeenCalledTimes(1); h.stop();
});

it("keeps a genuine physical pause as deliberate placement even when delivery is delayed", () => {
  let now = 1000; vi.spyOn(performance, "now").mockImplementation(() => now);
  const frame = vi.fn(), flight = vi.fn(); vi.stubGlobal("requestAnimationFrame", frame);
  const h = fixture({ onFlight: flight }); h.session.active = () => true;
  h.send("pointerdown", { isTrusted: true, timeStamp: 700 });
  now = 1200; h.send("pointermove", { isTrusted: true, buttons: 1, timeStamp: 970, clientX: 100, clientY: 68, getCoalescedEvents: () => [{ isTrusted: true, pointerId: 1, buttons: 1, clientX: 100, clientY: 100, timeStamp: 900 }, { isTrusted: true, pointerId: 1, buttons: 1, clientX: 100, clientY: 68, timeStamp: 970 }] });
  now = 1450; h.send("pointerup", { isTrusted: true, buttons: 0, timeStamp: 1090, clientX: 100, clientY: 68 });
  expect(frame).not.toHaveBeenCalled(); expect(flight).not.toHaveBeenCalledWith(true, expect.anything()); expect(h.point.y).toBe(68); expect(h.complete).toHaveBeenCalledTimes(1); h.stop();
});

it("cannot turn coalesced movement into a flight after pointer cancellation or input OFF", () => {
  let now = 1000; vi.spyOn(performance, "now").mockImplementation(() => now);
  const frame = vi.fn(); vi.stubGlobal("requestAnimationFrame", frame);
  for (const cancel of [true, false]) {
    const h = fixture(); h.session.active = () => true;
    h.send("pointerdown", { isTrusted: true, timeStamp: 700 });
    now = 1200; h.send("pointermove", { isTrusted: true, buttons: 1, timeStamp: 970, clientX: 100, clientY: 68, getCoalescedEvents: () => [{ isTrusted: true, pointerId: 1, buttons: 1, clientX: 100, clientY: 100, timeStamp: 900 }, { isTrusted: true, pointerId: 1, buttons: 1, clientX: 100, clientY: 68, timeStamp: 970 }] });
    if (cancel) h.send("pointercancel"); else h.block();
    now = 1350; h.send("pointerup", { isTrusted: true, timeStamp: 985 });
    expect(h.complete).not.toHaveBeenCalled(); expect(frame).not.toHaveBeenCalled(); h.stop();
  }
});
