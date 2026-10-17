"use client";

import { FLIP_MS } from "./flip-motion";
import { COMPANION_CARD_PLAY_EVENT } from "./viewer-companion/card-play";

export const LAYOUT_MOTION_EVENT = "vic:layout-motion";

/** Follow real layout changes through one finite spring lease. No measurement
 * frame remains after settling. Both fixed viewer and local studio coordinates
 * stay with their callers; this only replaces their perpetual tracking loops. */
export function trackPopoverLayout(options: {
  update: () => void;
  elements: () => (HTMLElement | null | undefined)[];
}): () => void {
  let stopped = false;
  let raf = 0;
  let until = 0;
  const lease = Math.max(FLIP_MS + 80, 800);
  const frame = () => {
    raf = 0;
    if (stopped || document.hidden) return;
    options.update();
    if (performance.now() < until) raf = requestAnimationFrame(frame);
  };
  const kick = (ms = lease) => {
    if (stopped || document.hidden) return;
    until = Math.max(until, performance.now() + Math.min(2000, Math.max(0, ms)));
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const changed = () => kick();
  const pointer = (event: PointerEvent) => { if (event.buttons) kick(); };
  const transition = (event: Event) => {
    const target = event.target;
    // Descendant counters/pets can animate forever without moving the anchor.
    // Only the tracked element or its ancestors can renew this lease.
    if (target instanceof HTMLElement && options.elements().some(el => el && (el === target || target.contains(el)))) kick();
  };
  const motion = (event: Event) => {
    const detail = (event as CustomEvent<{ element?: HTMLElement; ms?: number }>).detail;
    if (detail?.element && options.elements().some(el => el && (el === detail.element || detail.element!.contains(el)))) kick((detail.ms ?? FLIP_MS) + 80);
  };
  const visibility = () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; until = 0; }
    else kick();
  };
  const resize = new ResizeObserver(changed);
  const observed = new Set<HTMLElement>();
  for (const element of options.elements()) {
    // A row/cell can move the anchor when its sibling grows, even if the card's
    // own size stays unchanged. Observe the small ancestor chain, not the DOM.
    for (let el = element; el && el !== document.body; el = el.parentElement) {
      if (observed.has(el)) break;
      observed.add(el); resize.observe(el);
    }
  }
  const events = ["resize", "scroll", "click", "input", "keydown", "pointerdown", "pointerup", "vic:panel-section", "vic:side-panel", "vic:companion-panel-side", COMPANION_CARD_PLAY_EVENT];
  for (const name of events) window.addEventListener(name, changed, { capture: true, passive: true });
  window.addEventListener("pointermove", pointer, { capture: true, passive: true });
  window.addEventListener("transitionrun", transition, true);
  window.addEventListener(LAYOUT_MOTION_EVENT, motion);
  document.addEventListener("visibilitychange", visibility);
  window.visualViewport?.addEventListener("resize", changed);
  window.visualViewport?.addEventListener("scroll", changed);
  document.fonts?.addEventListener("loadingdone", changed);
  kick();
  return () => {
    stopped = true; cancelAnimationFrame(raf); resize.disconnect();
    for (const name of events) window.removeEventListener(name, changed, true);
    window.removeEventListener("pointermove", pointer, true);
    window.removeEventListener("transitionrun", transition, true);
    window.removeEventListener(LAYOUT_MOTION_EVENT, motion);
    document.removeEventListener("visibilitychange", visibility);
    window.visualViewport?.removeEventListener("resize", changed);
    window.visualViewport?.removeEventListener("scroll", changed);
    document.fonts?.removeEventListener("loadingdone", changed);
  };
}
