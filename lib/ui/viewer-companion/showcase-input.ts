import type { CompanionShowcaseSession } from "./showcase-session";

/** A lease owns one real item's native button. Its paused calendar physics
 * must not launch a second throw on release. No clone, spawn or collection
 * event is involved in this temporary background placement. */
export function bindCompanionShowcaseInput(layer: HTMLElement, session: CompanionShowcaseSession, identify: (node: HTMLElement) => string | undefined, allowed: () => boolean, onComplete: () => void = () => {}) {
  let drag: { id: string; pointer: number; node: HTMLElement; dx: number; dy: number; from: { x: number; y: number } } | undefined;
  const target = (event: Event) => event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("button") : null;
  const owns = (event: Event) => { const node = target(event), id = node && identify(node); return node && id && session.has(id) ? { node, id } : undefined; };
  const stop = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); };
  const down = (event: PointerEvent) => {
    const item = owns(event); if (!item || !allowed() || event.button !== 0) return;
    stop(event); if (drag) return;
    const point = session.point(item.id)!;
    drag = { ...item, pointer: event.pointerId, dx: event.clientX - point.x, dy: event.clientY - point.y, from: { x: point.x, y: point.y } };
    item.node.focus({ preventScroll: true }); item.node.setPointerCapture(event.pointerId);
    item.node.setAttribute("data-showcase-held", "");
  };
  const move = (event: PointerEvent) => {
    if (!drag || drag.pointer !== event.pointerId) return;
    stop(event); session.move(drag.id, { x: event.clientX - drag.dx, y: event.clientY - drag.dy });
  };
  const up = (event: PointerEvent) => {
    if (!drag || drag.pointer !== event.pointerId) return;
    stop(event); const current = drag; drag = undefined;
    if (event.type === "pointerup") session.move(current.id, { x: event.clientX - current.dx, y: event.clientY - current.dy });
    const point = session.point(current.id);
    if (event.type === "pointerup" && point && Math.hypot(point.x - current.from.x, point.y - current.from.y) > 6) onComplete();
    current.node.removeAttribute("data-showcase-held");
    if (current.node.hasPointerCapture(event.pointerId)) current.node.releasePointerCapture(event.pointerId);
  };
  const key = (event: KeyboardEvent) => {
    const item = owns(event); if (!item || !allowed() || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " ", "Enter"].includes(event.key)) return;
    stop(event); const point = session.point(item.id)!, before = { x: point.x, y: point.y };
    session.move(item.id, { x: before.x + (event.key === "ArrowLeft" ? -16 : event.key === "ArrowRight" ? 16 : 0), y: before.y + (event.key === "ArrowUp" ? -16 : event.key === "ArrowDown" ? 16 : 0) });
    const after = session.point(item.id);
    // Each physical arrow press is one completed placement. Held repeats,
    // clamped/no-op keys and plain Space/Enter do not duplicate that action.
    if (!event.repeat && after && Math.hypot(after.x - before.x, after.y - before.y) > .5) onComplete();
  };
  const click = (event: MouseEvent) => { if (owns(event)) stop(event); };
  layer.addEventListener("pointerdown", down, true); layer.addEventListener("pointermove", move, true); layer.addEventListener("pointerup", up, true); layer.addEventListener("pointercancel", up, true); layer.addEventListener("lostpointercapture", up, true);
  layer.addEventListener("keydown", key, true); layer.addEventListener("click", click, true);
  return () => {
    if (drag) { drag.node.removeAttribute("data-showcase-held"); if (drag.node.hasPointerCapture(drag.pointer)) drag.node.releasePointerCapture(drag.pointer); drag = undefined; }
    layer.removeEventListener("pointerdown", down, true); layer.removeEventListener("pointermove", move, true); layer.removeEventListener("pointerup", up, true); layer.removeEventListener("pointercancel", up, true); layer.removeEventListener("lostpointercapture", up, true);
    layer.removeEventListener("keydown", key, true); layer.removeEventListener("click", click, true);
  };
}
