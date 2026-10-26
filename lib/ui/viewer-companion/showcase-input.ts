import type { CompanionShowcaseSession, ShowcasePoint } from "./showcase-session";
import { COMPANION_THROW_LIMITS, createCompanionThrow, createCompanionThrowVelocity, stepCompanionThrow, type CompanionThrowVelocity, type CompanionThrowState } from "./throw";
import { createCompanionFoodGravity, createCompanionFoodToss } from "./food-gravity";

export type CompanionShowcaseInputOptions = {
  canDrag?: () => boolean; quiet?: () => boolean; pet?: boolean; tapThrow?: boolean; item?: "food" | "toy";
  onTap?: (elapsed: number) => void; onActivate?: () => void;
  onHover?: (event: PointerEvent) => void; onHoverEnd?: () => void;
  onHold?: (held: boolean, at: number) => void; onGrab?: () => void; onMove?: (from: ShowcasePoint, to: ShowcasePoint) => void;
  onSample?: (point: ShowcasePoint, at: number) => void; onCancel?: () => void;
  onFlight?: (flying: boolean, point?: ShowcasePoint & Partial<Pick<CompanionThrowState, "elapsedMs" | "vy">>) => void;
  onRelease?: (thrown: boolean) => void; onRest?: () => void; onDiscard?: (id: string) => void;
  onReclaim?: (id: string, point: ShowcasePoint) => boolean;
};

/** Real buttons retain pointer capture, keyboard hold/drop and direct
 * responses. A fast real release borrows the normal bounded throw integrator;
 * a deliberate placement stays at its grass depth. No hidden house is woken. */
export function bindCompanionShowcaseInput(layer: HTMLElement, session: CompanionShowcaseSession, identify: (node: HTMLElement) => string | undefined, allowed: () => boolean, onComplete: () => void = () => {}, options: CompanionShowcaseInputOptions = {}) {
  const velocity = createCompanionThrowVelocity();
  let drag: { id: string; pointer: number; node: HTMLElement; dx: number; dy: number; from: ShowcasePoint; at: number; moved: boolean } | undefined;
  let keyboard: { id: string; node: HTMLElement; moved: boolean } | undefined;
  const flights = new Map<string, number>();
  let placing = false;
  const target = (event: Event) => event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("button") : null;
  const owns = (event: Event) => { const node = target(event), id = node && identify(node); return node && id && session.has(id) && session.visible(id) ? { node, id } : undefined; };
  const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const canDrag = () => allowed() && (options.canDrag?.() ?? true);
  // Native input can wait behind a slow painted frame. Keep its physical clock
  // and coalesced history instead of turning delivery lag into a stationary tail.
  // Older/incompatible event clocks and synthetic input retain the existing now.
  const inputAt = (event: PointerEvent, now: number) => event.isTrusted && Number.isFinite(event.timeStamp) && event.timeStamp >= 0 && event.timeStamp <= now ? event.timeStamp : now;
  const inputSamples = (event: PointerEvent, now: number) => {
    const at = inputAt(event, now), samples: { event: PointerEvent; at: number }[] = [];
    if (event.isTrusted && event.type === "pointermove" && typeof event.getCoalescedEvents === "function") {
      for (const sample of event.getCoalescedEvents().slice(-COMPANION_THROW_LIMITS.maxSamples)) {
        if (!sample.isTrusted || sample.pointerId !== event.pointerId || sample.buttons !== event.buttons
          || ![sample.clientX, sample.clientY, sample.timeStamp].every(Number.isFinite) || sample.timeStamp < 0 || sample.timeStamp > at || sample.timeStamp <= (samples.at(-1)?.at ?? -1)) continue;
        samples.push({ event: sample, at: sample.timeStamp });
      }
    }
    // The parent is an aggregate, not an additional physical point. Consume
    // either its genuine history or the parent fallback, never both.
    return samples.length ? samples : [{ event, at }];
  };
  const cancelFlight = (id?: string) => {
    const reset: string[] = [];
    for (const [key, frame] of flights) if (!id || id === key) { cancelAnimationFrame(frame); flights.delete(key); reset.push(key); }
    if (id && !reset.includes(id)) reset.push(id);
    for (const key of reset) { session.present(key); const point = session.point(key); if (point) session.move(key, point); }
    if (reset.length) options.onCancel?.();
    options.onFlight?.(false);
  };
  const held = (node: HTMLElement, value: boolean, at = performance.now()) => { node.toggleAttribute("data-showcase-held", value); options.onHold?.(value, at); };
  const finishKeyboard = (publish = true) => { if (keyboard) { const previous = keyboard; keyboard = undefined; held(previous.node, false); if (publish && previous.moved) { onComplete(); options.onRelease?.(false); } } };
  const cancelHold = () => {
    placing = false; layer.querySelector<HTMLElement>("[data-showcase-placing]")?.removeAttribute("data-showcase-placing"); finishKeyboard(false);
    if (drag) { const previous = drag; drag = undefined; held(previous.node, false); if (previous.node.hasPointerCapture(previous.pointer)) previous.node.releasePointerCapture(previous.pointer); }
    velocity.reset(); options.onHoverEnd?.(); options.onCancel?.();
  };
  const releaseFlight = (id: string, release?: CompanionThrowVelocity) => {
    const point = session.point(id), impulse = release ?? velocity.release(performance.now());
    if (!point || !session.active() || options.quiet?.() || Math.hypot(impulse.vx, impulse.vy) < 120) return false;
    const bounds = { left: point.width / 2, right: innerWidth - point.width / 2, top: point.height - point.bottomOffset, bottom: innerHeight - 8 - point.bottomOffset };
    let state = createCompanionThrow(point, impulse, bounds), previousAt = performance.now();
    if (!state) return false;
    const began = previousAt;
    const foodVy = Math.max(-Math.sqrt(3600 * Math.max(0, point.y - bounds.top)), Math.max(-480, Math.min(140, impulse.vy)));
    const seconds = (-foodVy + Math.sqrt(foodVy ** 2 + 3600 * Math.max(0, bounds.bottom - point.y))) / 1800;
    const target = { x: Math.max(bounds.left, Math.min(bounds.right, point.x + impulse.vx * seconds)), y: bounds.bottom };
    const food = options.item === "food" ? createCompanionFoodToss(point, target, began, { height: 0, contactX: target.x, velocityY: foodVy }) : undefined;
    let impact: ReturnType<typeof createCompanionFoodGravity> | undefined;
    const tick = (now: number) => {
      flights.delete(id);
      if (!allowed() || !session.active() || !session.has(id) || document.hidden || options.quiet?.()) { options.onCancel?.(); session.present(id); const point = session.point(id); if (point) session.move(id, point); options.onFlight?.(false); return; }
      if (food) {
        const sample = food.sample(now); session.present(id, sample); session.move(id, sample);
        if (sample.active) flights.set(id, requestAnimationFrame(tick)); else options.onFlight?.(false, sample);
        return;
      }
      if (!impact) {
        state = stepCompanionThrow(state!, Math.min(80, Math.max(0, now - previousAt)), [], bounds).state; previousAt = now;
        if (options.item === "toy") {
          // The ordinary toy flight rocks around its own painted centre;
          // viewport-floor recovery borrows its existing finite impact sampler.
          session.present(id, { rotation: Math.sin(state.elapsedMs / 1000 * 5) * 30, scaleX: 1, scaleY: 1 });
          if (state.done) impact = createCompanionFoodGravity({ x: state.x, y: state.y - 3 }, state, now);
        }
        options.onFlight?.(!state.done, state); session.move(id, state);
      }
      if (impact) {
        const sample = impact.sample(now); session.present(id, sample); session.move(id, sample);
        if (sample.active) flights.set(id, requestAnimationFrame(tick));
      } else if (!state!.done) flights.set(id, requestAnimationFrame(tick));
    };
    options.onFlight?.(true, point); flights.set(id, requestAnimationFrame(tick)); return true;
  };
  const down = (event: PointerEvent) => {
    const item = owns(event); if (!item || !allowed() || event.button !== 0) return;
    if (!session.active() && options.onReclaim) {
      if (!session.reclaim(item.id, point => options.onReclaim!(item.id, point))) stop(event);
      return;
    }
    stop(event); if (drag) return;
    cancelFlight(item.id); finishKeyboard(); options.onHoverEnd?.(); session.present(item.id);
    const point = session.point(item.id)!;
    drag = { ...item, pointer: event.pointerId, dx: event.clientX - point.x, dy: event.clientY - point.y, from: { x: point.x, y: point.y }, at: performance.now(), moved: false };
    velocity.begin(point.x, point.y, inputAt(event, performance.now())); if (canDrag()) options.onGrab?.(); item.node.focus({ preventScroll: true }); item.node.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!drag) { if (owns(event) && allowed()) options.onHover?.(event); return; }
    if (drag.pointer !== event.pointerId) return;
    stop(event); if (!canDrag()) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.dx - drag.from.x, event.clientY - drag.dy - drag.from.y) <= 6) return;
    const samples = inputSamples(event, performance.now());
    if (!drag.moved) { drag.moved = true; held(drag.node, true, samples[0].at); }
    const before = session.point(drag.id); if (!before) return;
    const from = { x: before.x, y: before.y };
    for (const sample of samples) {
      // Use the same canonical bounds as the final drawing. Historical points
      // update only the bounded sampler; painters and care see one current move.
      session.move(drag.id, { x: sample.event.clientX - drag.dx, y: sample.event.clientY - drag.dy }, false);
      const point = session.point(drag.id)!; velocity.push(point.x, point.y, sample.at); options.onSample?.({ x: point.x, y: point.y }, sample.at);
    }
    const after = session.point(drag.id)!; session.move(drag.id, after); options.onMove?.(from, after);
  };
  const up = (event: PointerEvent) => {
    if (!drag || drag.pointer !== event.pointerId) return;
    stop(event); if (event.type === "pointerup") move(event);
    const current = drag; drag = undefined; held(current.node, false);
    if (current.node.hasPointerCapture(event.pointerId)) current.node.releasePointerCapture(event.pointerId);
    if (event.type !== "pointerup" || !allowed()) { velocity.reset(); options.onCancel?.(); return; }
    if (current.moved) { const thrown = releaseFlight(current.id, velocity.release(inputAt(event, performance.now()))); onComplete(); options.onRelease?.(thrown); }
    else { velocity.reset(); if (options.tapThrow && canDrag()) { const thrown = releaseFlight(current.id, { vx: 35, vy: -130 }); onComplete(); options.onRelease?.(thrown); } else options.onTap?.(performance.now() - current.at); }
  };
  const key = (event: KeyboardEvent) => {
    const item = owns(event); if (!item || !allowed()) return;
    const arrows = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key);
    if (!session.active() && options.onReclaim && (arrows || [" ", "Enter"].includes(event.key) || options.onDiscard && ["Delete", "Backspace"].includes(event.key))) {
      if (!session.reclaim(item.id, point => options.onReclaim!(item.id, point))) stop(event);
      return;
    }
    if (event.key === "Escape") { if (keyboard || placing || drag) { stop(event); if (keyboard) finishKeyboard(); cancelHold(); } return; }
    if (options.onDiscard && ["Delete", "Backspace"].includes(event.key)) { stop(event); if (!event.repeat) { cancelFlight(item.id); cancelHold(); options.onDiscard(item.id); } return; }
    if (options.pet && event.key.toLowerCase() === "n" && options.onRest) { stop(event); if (!event.repeat) { cancelFlight(item.id); cancelHold(); options.onRest(); } return; }
    if (options.pet && event.key === "Enter") { stop(event); if (!event.repeat) { finishKeyboard(); options.onActivate?.(); } return; }
    if (options.pet && event.key.toLowerCase() === "p" && canDrag()) { stop(event); if (!event.repeat) { const next = !placing; cancelFlight(item.id); cancelHold(); placing = next; item.node.toggleAttribute("data-showcase-placing", placing); } return; }
    if (!arrows && ![" ", "Enter"].includes(event.key)) return;
    stop(event); if (!canDrag()) return; cancelFlight(item.id);
    if (!arrows) { if (event.repeat) return; if (keyboard?.id === item.id) finishKeyboard(); else { finishKeyboard(); keyboard = { ...item, moved: false }; options.onGrab?.(); held(item.node, true); } return; }
    const point = session.point(item.id)!, before = { x: point.x, y: point.y };
    session.move(item.id, { x: before.x + (event.key === "ArrowLeft" ? -16 : event.key === "ArrowRight" ? 16 : 0), y: before.y + (event.key === "ArrowUp" ? -16 : event.key === "ArrowDown" ? 16 : 0) });
    const after = session.point(item.id);
    if (after && Math.hypot(after.x - before.x, after.y - before.y) > .5) { options.onMove?.(before, after); if (keyboard?.id === item.id) keyboard.moved = true; else if (!event.repeat) { onComplete(); options.onRelease?.(false); } }
  };
  const place = (event: PointerEvent) => {
    if (!placing || !session.active() || !canDrag() || event.button !== 0 || event.target instanceof HTMLElement && event.target.closest("button,input,select,textarea,[role=dialog]")) return;
    stop(event); placing = false; const node = layer.querySelector<HTMLElement>("[data-showcase-pet]"); node?.removeAttribute("data-showcase-placing");
    const before = session.point("pet"), origin = before ? { x: before.x, y: before.y } : undefined;
    session.move("pet", { x: event.clientX, y: event.clientY }); const after = session.point("pet");
    if (origin && after && Math.hypot(after.x - origin.x, after.y - origin.y) > .5) { onComplete(); options.onRelease?.(false); }
    node?.focus({ preventScroll: true });
  };
  const click = (event: MouseEvent) => { if (owns(event)) { stop(event); if (event.detail === 0 && allowed()) options.onActivate?.(); } };
  const leave = () => options.onHoverEnd?.();
  const visibility = () => {
    if (!document.hidden) return;
    cancelFlight(); cancelHold();
  };
  let wasActive = session.active();
  const off = session.subscribe(() => { const active = session.active(), exited = wasActive && !active; wasActive = active; if (exited) { cancelFlight(); cancelHold(); } });
  const blur = () => { cancelFlight(); cancelHold(); };
  layer.addEventListener("pointerdown", down, true); layer.addEventListener("pointermove", move, true); layer.addEventListener("pointerup", up, true); layer.addEventListener("pointercancel", up, true); layer.addEventListener("lostpointercapture", up, true); layer.addEventListener("pointerleave", leave, true);
  layer.addEventListener("keydown", key, true); layer.addEventListener("click", click, true); document.addEventListener("pointerdown", place, true); document.addEventListener("visibilitychange", visibility); window.addEventListener("blur", blur);
  return () => {
    off(); cancelFlight(); cancelHold();
    layer.removeEventListener("pointerdown", down, true); layer.removeEventListener("pointermove", move, true); layer.removeEventListener("pointerup", up, true); layer.removeEventListener("pointercancel", up, true); layer.removeEventListener("lostpointercapture", up, true); layer.removeEventListener("pointerleave", leave, true);
    layer.removeEventListener("keydown", key, true); layer.removeEventListener("click", click, true); document.removeEventListener("pointerdown", place, true); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("blur", blur);
  };
}
